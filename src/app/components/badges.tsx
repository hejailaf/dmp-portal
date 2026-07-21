import { Check } from 'lucide-react'
import type { Request, RequestStatus } from '@/domain/types'
import { daysUntilDue, isOverdue } from '@/domain/sla'
import { Badge } from './ui/badge'
import { S } from '../strings'

const STATUS_VARIANT: Record<RequestStatus, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  Draft: 'neutral',
  'Waiting to be started': 'amber',
  'In process': 'blue',
  Returned: 'amber', // with the requester — action needed, like Waiting
  Completed: 'green',
  Rejected: 'red',
}

/** Badge label follows reality: waiting shows "Submitted"/"Assigned" by assignee presence. */
export function StatusBadge({ status, assigneeId }: { status: RequestStatus; assigneeId?: string }) {
  return <Badge variant={STATUS_VARIANT[status]}>{S.statusLabel(status, !!assigneeId)}</Badge>
}

/**
 * Lifecycle track for the detail header: past steps get a check, the
 * current one the familiar status pill, future ones sit muted. The stored
 * "Waiting to be started" spans TWO display steps — Submitted, then
 * Assigned (user decision 2026-07-21). Rejected/Returned are branches, not
 * stages — they render as short Draft → <branch> tracks.
 */
export function StatusStepper({ status, assigneeId }: { status: RequestStatus; assigneeId?: string }) {
  interface Step {
    label: string
    state: 'past' | 'current' | 'future'
  }
  let steps: Step[]
  if (status === 'Rejected' || status === 'Returned') {
    steps = [
      { label: S.status.Draft, state: 'past' },
      { label: S.statusLabel(status, !!assigneeId), state: 'current' },
    ]
  } else {
    const labels = [
      S.status.Draft,
      S.statusLabel('Waiting to be started', false), // Submitted
      S.statusLabel('Waiting to be started', true), // Assigned
      S.status['In process'],
      S.status.Completed,
    ]
    const current =
      status === 'Draft'
        ? 0
        : status === 'Waiting to be started'
          ? assigneeId
            ? 2
            : 1
          : status === 'In process'
            ? 3
            : 4
    steps = labels.map((label, i) => ({
      label,
      state: i < current ? 'past' : i === current ? 'current' : 'future',
    }))
  }
  const variant = STATUS_VARIANT[status]
  return (
    <div className="flex flex-wrap items-center gap-y-1" aria-label={S.statusLabel(status, !!assigneeId)}>
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          {i > 0 && (
            <span
              className={`mx-2 h-px w-6 ${step.state !== 'future' ? 'bg-[var(--border-strong)]' : 'bg-border'}`}
            />
          )}
          {step.state === 'past' ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-[var(--teal)]" />
              {step.label}
            </span>
          ) : step.state === 'current' ? (
            <Badge variant={variant}>{step.label}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground/70">{step.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/** SLA countdown / overdue badge — derived at render time, never stored. */
export function SlaBadge({ request }: { request: Pick<Request, 'status' | 'dueDate'> }) {
  if (!request.dueDate) return null
  if (request.status === 'Completed' || request.status === 'Rejected') return null
  if (isOverdue(request)) {
    return <Badge variant="red">{S.sla.overdue(-daysUntilDue(request.dueDate))}</Badge>
  }
  const days = daysUntilDue(request.dueDate)
  return (
    <Badge variant={days <= 1 ? 'amber' : 'outline'}>
      {days <= 0 ? S.sla.dueToday : S.sla.dueIn(days)}
    </Badge>
  )
}
