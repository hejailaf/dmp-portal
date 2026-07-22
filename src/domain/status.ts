import type { AuditEvent, RequestStatus, Role } from './types'

// The status workflow as an explicit transition table (spec §4.3):
//
//   Draft → Waiting to be started → In process → Completed
//   Rejected reachable from Waiting / In process (reason required)
//   Rejected → Draft (reopen — user decision 2026-07-16)
//   Returned reachable from Waiting / In process (user decision 2026-07-21):
//     the maintainer sends it back for changes; the requester EDITS directly
//     (no reopen) and resubmits → Waiting. Unlike reject, submittedAt stays
//     and the due date is extended by the returned interval (SLA pause).
//
// Who may do what:
//   - requester: submit / reopen / resubmit their own request
//   - maintainer: start / complete / return requests assigned to them
//   - admin: every transition (reject stays admin-only, per spec §4.2)

export interface TransitionCtx {
  roles: Role[]
  isOwner?: boolean // current user created the request
  isAssignee?: boolean // current user is the assignee
}

export interface Transition {
  from: RequestStatus
  to: RequestStatus
  event: AuditEvent
  /** UI label for the action button */
  label: string
  allowed: (ctx: TransitionCtx) => boolean
}

const admin = (c: TransitionCtx) => c.roles.includes('admin')
const owningRequester = (c: TransitionCtx) =>
  admin(c) || (c.roles.includes('requester') && !!c.isOwner)
const assignedMaintainer = (c: TransitionCtx) =>
  admin(c) || (c.roles.includes('maintainer') && !!c.isAssignee)

export const TRANSITIONS: Transition[] = [
  { from: 'Draft', to: 'Waiting to be started', event: 'Submitted', label: 'Submit', allowed: owningRequester },
  { from: 'Waiting to be started', to: 'In process', event: 'StatusChanged', label: 'Start work', allowed: assignedMaintainer },
  { from: 'In process', to: 'Completed', event: 'StatusChanged', label: 'Mark completed', allowed: assignedMaintainer },
  { from: 'Waiting to be started', to: 'Rejected', event: 'Rejected', label: 'Reject', allowed: admin },
  { from: 'In process', to: 'Rejected', event: 'Rejected', label: 'Reject', allowed: admin },
  { from: 'Rejected', to: 'Draft', event: 'Reopened', label: 'Reopen as draft', allowed: owningRequester },
  { from: 'Waiting to be started', to: 'Returned', event: 'Returned', label: 'Return to requester', allowed: assignedMaintainer },
  { from: 'In process', to: 'Returned', event: 'Returned', label: 'Return to requester', allowed: assignedMaintainer },
  { from: 'Returned', to: 'Waiting to be started', event: 'Submitted', label: 'Resubmit', allowed: owningRequester },
]

/** Statuses from which no further transition exists. Rejected is reopenable, so only Completed is terminal. */
export const TERMINAL_STATUSES: readonly RequestStatus[] = ['Completed']

export function findTransition(from: RequestStatus, to: RequestStatus): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to)
}

export function canTransition(ctx: TransitionCtx, from: RequestStatus, to: RequestStatus): boolean {
  const t = findTransition(from, to)
  return !!t && t.allowed(ctx)
}

/** Transitions the given user may perform from the given status (drives the action buttons). */
export function availableTransitions(ctx: TransitionCtx, from: RequestStatus): Transition[] {
  return TRANSITIONS.filter((t) => t.from === from && t.allowed(ctx))
}

export class TransitionError extends Error {}

/** Throws unless the transition is both legal and permitted — data layer must call this, not just the UI. */
export function assertTransition(ctx: TransitionCtx, from: RequestStatus, to: RequestStatus): Transition {
  const t = findTransition(from, to)
  if (!t) throw new TransitionError(`Illegal transition: "${from}" → "${to}"`)
  if (!t.allowed(ctx)) throw new TransitionError(`Not permitted: "${from}" → "${to}"`)
  return t
}
