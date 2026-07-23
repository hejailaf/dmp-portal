// Admin dashboard aggregation (spec §6): KPI counts + per-maintainer
// performance, computed client-side from the full request list at render
// time — no stored rollups, no scheduled jobs (same rule as SLA/overdue).
import { isOverdue } from './sla'
import type { Request } from './types'

interface DashboardKpis {
  total: number
  waiting: number
  inProcess: number
  completed: number
  overdue: number
  unassigned: number
  withdrawn: number
}

interface MaintainerStats {
  id: string
  name: string
  /** Waiting + In process requests currently assigned to them. */
  open: number
  completed: number
  /** % of measurable completions with completedAt <= dueDate; undefined when none. */
  onTimePct?: number
  /** Mean of (completedAt - submittedAt) in days, 1 decimal; undefined when none. */
  avgCycleDays?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export type DashboardWindow = 'all' | 'month' | 'quarter'

/**
 * Time-window pre-filter for the dashboard: keeps requests SUBMITTED in the
 * current calendar month/quarter ('all' = identity). Unsubmitted drafts drop
 * out of windowed views — they have no submit date to fall inside one.
 */
export function filterByWindow(
  requests: Request[],
  window: DashboardWindow,
  now: Date = new Date(),
): Request[] {
  if (window === 'all') return requests
  const start =
    window === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  return requests.filter((r) => r.submittedAt && new Date(r.submittedAt) >= start)
}

export function computeDashboard(
  requests: Request[],
  now: Date = new Date(),
): { kpis: DashboardKpis; maintainers: MaintainerStats[] } {
  const kpis: DashboardKpis = {
    total: requests.length,
    waiting: 0,
    inProcess: 0,
    completed: 0,
    overdue: 0,
    unassigned: 0,
    withdrawn: 0,
  }

  interface Acc {
    name: string
    open: number
    completed: number
    onTime: number
    measurableOnTime: number
    cycleDaysSum: number
    measurableCycles: number
  }
  const byMaintainer = new Map<string, Acc>()

  for (const r of requests) {
    if (r.status === 'Waiting to be started') kpis.waiting += 1
    if (r.status === 'In process') kpis.inProcess += 1
    if (r.status === 'Completed') kpis.completed += 1
    if (isOverdue(r, now)) kpis.overdue += 1
    if (r.status === 'Waiting to be started' && !r.assigneeId) kpis.unassigned += 1
    if (r.status === 'Withdrawn') kpis.withdrawn += 1

    if (!r.assigneeId) continue
    // withdrawn requests keep their assignee but are no maintainer workload —
    // they must not create all-zero performance rows
    if (r.status === 'Withdrawn') continue
    let acc = byMaintainer.get(r.assigneeId)
    if (!acc) {
      acc = {
        name: r.assigneeName ?? r.assigneeId,
        open: 0,
        completed: 0,
        onTime: 0,
        measurableOnTime: 0,
        cycleDaysSum: 0,
        measurableCycles: 0,
      }
      byMaintainer.set(r.assigneeId, acc)
    }
    if (r.status === 'Waiting to be started' || r.status === 'In process') acc.open += 1
    if (r.status === 'Completed') {
      acc.completed += 1
      // legacy Completed items predating the CompletedAt column are counted
      // above but excluded from the two ratios (nothing to measure)
      if (r.completedAt && r.dueDate) {
        acc.measurableOnTime += 1
        if (r.completedAt <= r.dueDate) acc.onTime += 1
      }
      if (r.completedAt && r.submittedAt) {
        acc.measurableCycles += 1
        acc.cycleDaysSum +=
          (new Date(r.completedAt).getTime() - new Date(r.submittedAt).getTime()) / DAY_MS
      }
    }
  }

  const maintainers: MaintainerStats[] = [...byMaintainer.entries()]
    .map(([id, a]) => ({
      id,
      name: a.name,
      open: a.open,
      completed: a.completed,
      onTimePct:
        a.measurableOnTime > 0 ? Math.round((a.onTime / a.measurableOnTime) * 100) : undefined,
      avgCycleDays:
        a.measurableCycles > 0
          ? Math.round((a.cycleDaysSum / a.measurableCycles) * 10) / 10
          : undefined,
    }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))

  return { kpis, maintainers }
}
