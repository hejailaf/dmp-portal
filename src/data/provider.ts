import type {
  Attachment,
  AuditEntry,
  AuditEvent,
  Comment,
  Request,
  RequestLine,
  RequestStatus,
  User,
} from '@/domain/types'

// The provider seam (spec §5): one interface, two implementations
// (MockProvider for offline development, SharePointProvider for the real
// site), selected by VITE_DATA_PROVIDER. The UI only ever talks to this.

export type RequestScope = 'mine' | 'queue' | 'unassigned' | 'all'

export interface RequestDetail {
  request: Request
  lines: RequestLine[]
}

export interface DraftLineInput {
  objectType: RequestLine['objectType']
  action: RequestLine['action']
  order: number
  fieldData: Record<string, string>
}

export interface ProvisionResult {
  list: string
  status: 'ok' | 'created' | 'missing' | 'error'
  detail?: string
}

export interface DataProvider {
  getCurrentUser(): Promise<User>
  listRequests(scope: RequestScope): Promise<Request[]>
  getRequest(id: string): Promise<RequestDetail>
  /** Creates a Draft. Draft lines may be incomplete — full validation happens at submit. */
  createRequest(lines: DraftLineInput[], description: string): Promise<Request>
  updateDraft(id: string, lines: DraftLineInput[], description: string): Promise<Request>
  /** Validates lines, enforces the state machine, computes SLA/due date. */
  submitRequest(id: string): Promise<Request>
  /** Admin: assign anyone. Maintainer: may only claim an unassigned request for themselves. */
  assignRequest(id: string, assigneeId: string): Promise<Request>
  setStatus(id: string, to: RequestStatus): Promise<Request>
  rejectRequest(id: string, reason: string): Promise<Request>
  addComment(id: string, body: string): Promise<Comment>
  listComments(id: string): Promise<Comment[]>
  addAttachment(id: string, file: File): Promise<Attachment>
  listAttachments(id: string): Promise<Attachment[]>
  appendAudit(entry: {
    requestId: string
    event: AuditEvent
    oldValue?: string
    newValue?: string
  }): Promise<void>
  listAudit(id: string): Promise<AuditEntry[]>
  /** Admin diagnostics: verify/create the four DMP lists. */
  provisionLists(): Promise<ProvisionResult[]>
  /** Candidates for the assignment dropdown (added beyond spec §5 — assignment needs a target). */
  listAssignableUsers(): Promise<User[]>
}
