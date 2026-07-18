import type { AuditEntry, AuditEvent, Comment, Request, RequestLine, RequestStatus, Role, User } from '@/domain/types'
import type { RequestScope } from '../provider'
import { DMP_GROUPS } from './schema'

// Pure list-item ↔ domain mapping + shared filtering rules. Everything in
// this file is unit-tested at home; the provider stays a thin I/O shell.

export interface RequestItem {
  Id: number
  Title: string
  RequestStatus?: string
  RequesterLogin?: string
  RequesterName?: string
  AssigneeLogin?: string
  AssigneeName?: string
  Created: string
  SubmittedAt?: string | null
  DueDate?: string | null
  CompletedAt?: string | null
  SlaDays?: number | null
  Description?: string | null
  RejectReason?: string | null
  LineSummary?: string | null
}

export interface LineItem {
  Id: number
  RequestId: number
  ObjectType?: string
  LineAction?: string
  LineOrder?: number
  FieldData?: string | null
}

export interface AuthoredItem {
  Id: number
  RequestId: number
  Created: string
  Author?: { Title?: string } | null
  Body?: string | null
  Event?: string
  OldValue?: string | null
  NewValue?: string | null
}

export function mapRequest(item: RequestItem): Request {
  return {
    id: String(item.Id),
    ref: item.Title,
    description: item.Description ?? '',
    status: (item.RequestStatus ?? 'Draft') as RequestStatus,
    requesterId: item.RequesterLogin ?? '',
    requesterName: item.RequesterName ?? '',
    assigneeId: item.AssigneeLogin || undefined,
    assigneeName: item.AssigneeName || undefined,
    createdAt: item.Created,
    submittedAt: item.SubmittedAt ?? undefined,
    dueDate: item.DueDate ?? undefined,
    completedAt: item.CompletedAt ?? undefined,
    slaDays: item.SlaDays ?? undefined,
    rejectReason: item.RejectReason || undefined,
    lineSummary: item.LineSummary ?? '',
  }
}

export function mapLine(item: LineItem): RequestLine {
  let fieldData: Record<string, string> = {}
  try {
    const parsed = JSON.parse(item.FieldData ?? '{}')
    if (parsed && typeof parsed === 'object') fieldData = parsed
  } catch {
    // corrupted blob — surface an empty line rather than crashing the page
  }
  return {
    id: String(item.Id),
    requestId: String(item.RequestId),
    objectType: (item.ObjectType ?? 'EQUIPMENT') as RequestLine['objectType'],
    action: (item.LineAction ?? 'ADD') as RequestLine['action'],
    order: item.LineOrder ?? 0,
    fieldData,
  }
}

export function mapComment(item: AuthoredItem): Comment {
  return {
    id: String(item.Id),
    requestId: String(item.RequestId),
    authorId: '',
    authorName: item.Author?.Title ?? '',
    body: item.Body ?? '',
    createdAt: item.Created,
  }
}

export function mapAudit(item: AuthoredItem): AuditEntry {
  return {
    id: String(item.Id),
    requestId: String(item.RequestId),
    event: (item.Event ?? 'Created') as AuditEvent,
    actorId: '',
    actorName: item.Author?.Title ?? '',
    oldValue: item.OldValue || undefined,
    newValue: item.NewValue || undefined,
    at: item.Created,
  }
}

/** Roles from SharePoint group titles — exact names from docs/LIST_SETUP.md. */
export function rolesFromGroups(groupTitles: string[]): Role[] {
  const roles: Role[] = []
  if (groupTitles.includes(DMP_GROUPS.requester)) roles.push('requester')
  if (groupTitles.includes(DMP_GROUPS.maintainer)) roles.push('maintainer')
  if (groupTitles.includes(DMP_GROUPS.admin)) roles.push('admin')
  return roles
}

/** Same scope + draft-privacy rules as the MockProvider, shared client-side. */
export function filterByScope(requests: Request[], scope: RequestScope, me: User): Request[] {
  const isAdmin = me.roles.includes('admin')
  switch (scope) {
    case 'mine':
      return requests.filter((r) => r.requesterId === me.id)
    case 'queue':
      return requests.filter((r) => r.assigneeId === me.id && r.status !== 'Draft')
    case 'unassigned':
      return requests.filter((r) => r.status === 'Waiting to be started' && !r.assigneeId)
    case 'all':
      // drafts stay private to their requester even for the all view minus admins
      return isAdmin ? requests : requests.filter((r) => r.status !== 'Draft' || r.requesterId === me.id)
  }
}
