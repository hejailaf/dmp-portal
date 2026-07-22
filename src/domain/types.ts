// Core domain types. This module (and everything under src/domain) is pure
// TypeScript: no React, no SharePoint, no browser APIs. It is the single
// source of truth for statuses, roles, and entity shapes.

export const OBJECT_TYPES = ['EQUIPMENT', 'FLOC', 'BOM_LINKAGE', 'PM'] as const
export type ObjectType = (typeof OBJECT_TYPES)[number]

export const LINE_ACTIONS = ['ADD', 'CHANGE', 'DELETE'] as const
export type LineAction = (typeof LINE_ACTIONS)[number]

export const STATUSES = [
  'Draft',
  'Waiting to be started',
  'In process',
  'Returned',
  'Completed',
  'Rejected',
] as const
export type RequestStatus = (typeof STATUSES)[number]

export type Role = 'requester' | 'maintainer' | 'admin'

export interface User {
  id: string
  displayName: string
  email: string
  roles: Role[]
}

export interface Request {
  id: string
  ref: string // DCR-YYNNNN
  /**
   * One-line title — required to submit, free while drafting. Convention
   * (2026-07-21): reference documents go in ATTACHMENTS, remarks in
   * COMMENTS — never in the description.
   */
  description: string
  status: RequestStatus
  requesterId: string
  requesterName: string
  assigneeId?: string
  assigneeName?: string
  createdAt: string // ISO datetime
  submittedAt?: string
  slaDays?: number
  dueDate?: string
  completedAt?: string // stamped on the transition to Completed (Phase 3)
  /**
   * Set while the request is Returned to the requester; cleared on resubmit.
   * The SLA clock pauses over this interval — resubmit extends dueDate by
   * (resubmittedAt − returnedAt). SubmittedAt is NOT reset (unlike reject).
   */
  returnedAt?: string
  /** Reject OR return reason — the requester sees it; cleared on reopen/resubmit. */
  rejectReason?: string
  lineSummary: string // denormalized, for list views
}

export interface RequestLine {
  id: string
  requestId: string
  objectType: ObjectType
  action: LineAction
  order: number
  // SAP field values keyed by FieldDef.key — stored as a JSON blob (never as
  // list columns) so the field map stays config-driven. Validated by Zod.
  fieldData: Record<string, string>
}

export interface Comment {
  id: string
  requestId: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export const AUDIT_EVENTS = [
  'Created',
  'DraftUpdated',
  'Submitted',
  'Assigned',
  'StatusChanged',
  'Rejected',
  'Returned',
  'Reopened',
  'CommentAdded',
  'AttachmentAdded',
] as const
export type AuditEvent = (typeof AUDIT_EVENTS)[number]

export interface AuditEntry {
  id: string
  requestId: string
  event: AuditEvent
  actorId: string
  actorName: string
  oldValue?: string
  newValue?: string
  at: string
}

export interface Attachment {
  fileName: string
  url: string
  size?: number
}
