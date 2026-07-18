import type {
  Attachment,
  AuditEntry,
  AuditEvent,
  Comment,
  Request,
  RequestStatus,
  User,
} from '@/domain/types'
import { assertTransition, TransitionError, type TransitionCtx } from '@/domain/status'
import { computeDueDate, slaDaysFor } from '@/domain/sla'
import { nextRef } from '@/domain/ref'
import { applyDerivations, summarizeLines } from '@/domain/field-map'
import { isEmptyLine, validateForSubmit } from '@/domain/schemas'
import type {
  DataProvider,
  DraftLineInput,
  ProvisionResult,
  RequestDetail,
  RequestScope,
} from '../provider'
import { buildSeed, DEFAULT_USER_ID, SEED_USERS, type MockDb } from './seed'

// MockProvider — first-class, not a stub (spec §5): the whole app runs on it
// at home. In-memory + localStorage persistence, seeded demo data, artificial
// latency, and a role switcher (see mockControls) to exercise all roles.

const DB_KEY = 'dmp-mock-db-v1'
const USER_KEY = 'dmp-mock-user'

const sleep = () => new Promise((r) => setTimeout(r, 200 + Math.random() * 200))
const newId = () => crypto.randomUUID()

function loadDb(): MockDb {
  const raw = localStorage.getItem(DB_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as MockDb
    } catch {
      // corrupted — reseed
    }
  }
  const db = buildSeed()
  localStorage.setItem(DB_KEY, JSON.stringify(db))
  return db
}

export class MockProvider implements DataProvider {
  private db: MockDb = loadDb()

  private save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.db))
  }

  private me(): User {
    const id = localStorage.getItem(USER_KEY) ?? DEFAULT_USER_ID
    return SEED_USERS.find((u) => u.id === id) ?? SEED_USERS[0]
  }

  private ctxFor(req: Request): TransitionCtx {
    const me = this.me()
    return {
      roles: me.roles,
      isOwner: req.requesterId === me.id,
      isAssignee: req.assigneeId === me.id,
    }
  }

  private mustGet(id: string): Request {
    const req = this.db.requests.find((r) => r.id === id)
    if (!req) throw new Error(`Request ${id} not found`)
    return req
  }

  private writeAudit(requestId: string, event: AuditEvent, oldValue?: string, newValue?: string) {
    const me = this.me()
    this.db.audit.push({
      id: newId(),
      requestId,
      event,
      actorId: me.id,
      actorName: me.displayName,
      oldValue,
      newValue,
      at: new Date().toISOString(),
    })
  }

  async getCurrentUser(): Promise<User> {
    await sleep()
    return this.me()
  }

  async listRequests(scope: RequestScope): Promise<Request[]> {
    await sleep()
    const me = this.me()
    const all = [...this.db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    switch (scope) {
      case 'mine':
        return all.filter((r) => r.requesterId === me.id)
      case 'queue':
        return all.filter((r) => r.assigneeId === me.id && r.status !== 'Draft')
      case 'unassigned':
        return all.filter((r) => r.status === 'Waiting to be started' && !r.assigneeId)
      case 'all':
        if (!me.roles.includes('admin')) throw new Error('Only admins can list all requests')
        return all
    }
  }

  async getRequest(id: string): Promise<RequestDetail> {
    await sleep()
    const request = this.mustGet(id)
    const me = this.me()
    // drafts are private to their requester (and admins)
    if (request.status === 'Draft' && request.requesterId !== me.id && !me.roles.includes('admin'))
      throw new Error('This draft is only visible to its requester')
    const lines = this.db.lines
      .filter((l) => l.requestId === id)
      .sort((a, b) => a.order - b.order)
    return { request, lines }
  }

  async createRequest(lines: DraftLineInput[]): Promise<Request> {
    await sleep()
    const me = this.me()
    if (!me.roles.includes('requester') && !me.roles.includes('admin'))
      throw new Error('Only requesters can create requests')
    const id = newId()
    const req: Request = {
      id,
      ref: nextRef(this.db.requests.map((r) => r.ref), new Date().getFullYear()),
      status: 'Draft',
      requesterId: me.id,
      requesterName: me.displayName,
      createdAt: new Date().toISOString(),
      lineSummary: summarizeLines(lines),
    }
    this.db.requests.push(req)
    this.replaceLines(id, lines)
    this.writeAudit(id, 'Created')
    this.save()
    return req
  }

  private replaceLines(requestId: string, lines: DraftLineInput[]) {
    this.db.lines = this.db.lines.filter((l) => l.requestId !== requestId)
    this.db.lines.push(
      // derivations re-applied on save so stored data is always consistent
      // with the correlation table, even if a client bypassed the UI
      ...lines.map((l, i) => ({
        ...l,
        id: newId(),
        requestId,
        order: i + 1,
        fieldData: applyDerivations(l.objectType, l.fieldData),
      })),
    )
  }

  async updateDraft(id: string, lines: DraftLineInput[]): Promise<Request> {
    await sleep()
    const req = this.mustGet(id)
    const ctx = this.ctxFor(req)
    if (req.status !== 'Draft') throw new Error('Only drafts can be edited')
    if (!ctx.isOwner && !ctx.roles.includes('admin'))
      throw new Error('Only the requester can edit this draft')
    this.replaceLines(id, lines)
    req.lineSummary = summarizeLines(lines)
    this.writeAudit(id, 'DraftUpdated')
    this.save()
    return req
  }

  async submitRequest(id: string): Promise<Request> {
    await sleep()
    const req = this.mustGet(id)
    // empty (never-filled) lines are pruned at submit, not validated
    const lines = this.db.lines
      .filter((l) => l.requestId === id && !isEmptyLine(l))
      .map((l, i) => ({ ...l, order: i + 1 }))
    this.db.lines = [...this.db.lines.filter((l) => l.requestId !== id), ...lines]
    req.lineSummary = summarizeLines(lines)
    const validation = validateForSubmit(lines)
    if (!validation.ok) throw new Error('Request has validation errors — fix the lines first')
    const t = assertTransition(this.ctxFor(req), req.status, 'Waiting to be started')
    req.status = 'Waiting to be started'
    req.submittedAt = new Date().toISOString()
    req.slaDays = slaDaysFor(lines)
    req.dueDate = computeDueDate(req.submittedAt, req.slaDays)
    req.rejectReason = undefined // resubmit after reopen clears the old reason
    this.writeAudit(id, t.event, 'Draft', req.status)
    this.save()
    return req
  }

  async assignRequest(id: string, assigneeId: string): Promise<Request> {
    await sleep()
    const req = this.mustGet(id)
    const me = this.me()
    const assignee = SEED_USERS.find((u) => u.id === assigneeId)
    if (!assignee) throw new Error(`Unknown user ${assigneeId}`)
    if (req.status !== 'Waiting to be started' && req.status !== 'In process')
      throw new Error(`Cannot assign a request in status "${req.status}"`)
    const isAdmin = me.roles.includes('admin')
    const isSelfClaim = me.roles.includes('maintainer') && assigneeId === me.id && !req.assigneeId
    if (!isAdmin && !isSelfClaim)
      throw new TransitionError('Maintainers may only claim unassigned requests for themselves')
    const old = req.assigneeName
    req.assigneeId = assignee.id
    req.assigneeName = assignee.displayName
    this.writeAudit(id, 'Assigned', old, assignee.displayName)
    this.save()
    return req
  }

  async setStatus(id: string, to: RequestStatus): Promise<Request> {
    await sleep()
    const req = this.mustGet(id)
    const t = assertTransition(this.ctxFor(req), req.status, to)
    if (to === 'Rejected') throw new Error('Use rejectRequest — a reject reason is required')
    const from = req.status
    req.status = to
    if (t.event === 'Reopened') {
      // back to draft: SLA is recomputed at the next submit
      req.submittedAt = undefined
      req.slaDays = undefined
      req.dueDate = undefined
    }
    this.writeAudit(id, t.event, from, to)
    this.save()
    return req
  }

  async rejectRequest(id: string, reason: string): Promise<Request> {
    await sleep()
    const req = this.mustGet(id)
    if (!reason.trim()) throw new Error('A reject reason is required')
    const t = assertTransition(this.ctxFor(req), req.status, 'Rejected')
    const from = req.status
    req.status = 'Rejected'
    req.rejectReason = reason.trim()
    this.writeAudit(id, t.event, from, reason.trim())
    this.save()
    return req
  }

  async addComment(id: string, body: string): Promise<Comment> {
    await sleep()
    if (!body.trim()) throw new Error('Comment cannot be empty')
    this.mustGet(id)
    const me = this.me()
    const comment: Comment = {
      id: newId(),
      requestId: id,
      authorId: me.id,
      authorName: me.displayName,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }
    this.db.comments.push(comment)
    this.writeAudit(id, 'CommentAdded')
    this.save()
    return comment
  }

  async listComments(id: string): Promise<Comment[]> {
    await sleep()
    return this.db.comments
      .filter((c) => c.requestId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async addAttachment(id: string, file: File): Promise<Attachment> {
    await sleep()
    this.mustGet(id)
    // ponytail: dataURL in localStorage, 1 MB cap — fine for demo, SP holds real files
    if (file.size > 1_000_000) throw new Error('Mock attachments are capped at 1 MB')
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsDataURL(file)
    })
    const att = { fileName: file.name, url, size: file.size }
    ;(this.db.attachments[id] ??= []).push(att)
    this.writeAudit(id, 'AttachmentAdded', undefined, file.name)
    this.save()
    return att
  }

  async listAttachments(id: string): Promise<Attachment[]> {
    await sleep()
    return this.db.attachments[id] ?? []
  }

  async appendAudit(entry: {
    requestId: string
    event: AuditEvent
    oldValue?: string
    newValue?: string
  }): Promise<void> {
    await sleep()
    this.writeAudit(entry.requestId, entry.event, entry.oldValue, entry.newValue)
    this.save()
  }

  async listAudit(id: string): Promise<AuditEntry[]> {
    await sleep()
    return this.db.audit
      .filter((a) => a.requestId === id)
      .sort((a, b) => a.at.localeCompare(b.at))
  }

  async provisionLists(): Promise<ProvisionResult[]> {
    await sleep()
    return ['DMP_Requests', 'DMP_RequestLines', 'DMP_Comments', 'DMP_AuditLog'].map((list) => ({
      list,
      status: 'ok',
      detail: 'MockProvider — nothing to provision',
    }))
  }

  async listAssignableUsers(): Promise<User[]> {
    await sleep()
    return SEED_USERS.filter((u) => u.roles.includes('maintainer'))
  }
}

/** Dev-only controls for the role switcher — not part of the DataProvider seam. */
export const mockControls = {
  listUsers: () => SEED_USERS,
  currentUserId: () => localStorage.getItem(USER_KEY) ?? DEFAULT_USER_ID,
  setCurrentUser(id: string) {
    localStorage.setItem(USER_KEY, id)
    window.location.reload()
  },
  resetDemoData() {
    localStorage.removeItem(DB_KEY)
    window.location.reload()
  },
}
