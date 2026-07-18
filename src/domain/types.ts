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
  status: RequestStatus
  requesterId: string
  requesterName: string
  assigneeId?: string
  assigneeName?: string
  createdAt: string // ISO datetime
  submittedAt?: string
  slaDays?: number
  dueDate?: string
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
