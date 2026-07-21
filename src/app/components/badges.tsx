import { Check } from 'lucide-react'
import type { Request, RequestStatus } from '@/domain/types'
import { daysUntilDue, isOverdue } from '@/domain/sla'
import { Badge } from './ui/badge'
import { S } from '../strings'

const STATUS_VARIANT: Record<RequestStatus, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  Draft: 'neutral',
  'Waiting to be started': 'amber',
  'In process': 'blue',
  Completed: 'green',
  Rejected: 'red',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{S.status[status]}</Badge>
}

/**
 * Lifecycle track for the detail header: past steps get a check, the
 * current one the familiar status pill, future ones sit muted. Rejected is
 * a branch, not a stage — it renders as a short Draft → Rejected track.
 */
export function StatusStepper({ status }: { status: RequestStatus }) {
  const track: RequestStatus[] =
    status === 'Rejected'
      ? ['Draft', 'Rejected']
      : ['Draft', 'Waiting to be started', 'In process', 'Completed']
  const current = track.indexOf(status)
  return (
    <div className="flex flex-wrap items-center gap-y-1" aria-label={S.status[status]}>
      {track.map((step, i) => (
        <div key={step} className="flex items-center">
          {i > 0 && (
            <span
              className={`mx-2 h-px w-6 ${i <= current ? 'bg-[var(--border-strong)]' : 'bg-border'}`}
            />
          )}
          {i < current ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-[var(--teal)]" />
              {S.status[step]}
            </span>
          ) : i === current ? (
            <StatusBadge status={step} />
          ) : (
            <span className="text-xs text-muted-foreground/70">{S.status[step]}</span>
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
