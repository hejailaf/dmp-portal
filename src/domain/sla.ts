import type { LineAction, Request, RequestLine } from './types'

// SLA config — calendar days per action type (spec §4.4). configurable:
// tune these values to match site SLAs; nothing else needs to change.
const SLA_DAYS: Record<LineAction, number> = {
  ADD: 5,
  CHANGE: 3,
  DELETE: 2,
}

/** The max across a request's lines governs the whole request. */
export function slaDaysFor(lines: Pick<RequestLine, 'action'>[]): number {
  if (lines.length === 0) throw new Error('Cannot compute SLA for a request with no lines')
  return Math.max(...lines.map((l) => SLA_DAYS[l.action]))
}

/** DueDate = SubmittedAt + slaDays calendar days (plain ms arithmetic — timezone-independent). */
export function computeDueDate(submittedAt: string, slaDays: number): string {
  return new Date(new Date(submittedAt).getTime() + slaDays * 86_400_000).toISOString()
}

/**
 * Overdue is DERIVED at render time — no scheduled jobs exist anywhere.
 * A request is overdue while it is actively waiting/in work past its due date.
 */
export function isOverdue(
  req: Pick<Request, 'status' | 'dueDate'>,
  now: Date = new Date(),
): boolean {
  if (!req.dueDate) return false
  if (req.status !== 'Waiting to be started' && req.status !== 'In process') return false
  return new Date(req.dueDate).getTime() < now.getTime()
}

/**
 * SLA pause for the Returned flow: the due date grows by exactly the time
 * the request spent with the requester. SubmittedAt is not touched.
 */
export function extendDueDate(dueDate: string, returnedAt: string, resubmittedAt: string): string {
  const paused = new Date(resubmittedAt).getTime() - new Date(returnedAt).getTime()
  return new Date(new Date(dueDate).getTime() + Math.max(0, paused)).toISOString()
}

/** Whole days until due (negative = overdue by that many days). For SLA countdown badges. */
export function daysUntilDue(dueDate: string, now: Date = new Date()): number {
  return Math.ceil((new Date(dueDate).getTime() - now.getTime()) / 86_400_000)
}
