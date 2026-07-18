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
