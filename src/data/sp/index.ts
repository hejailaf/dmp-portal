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
import { assertTransition, TransitionError, type TransitionCtx } from '@/domain/status'
import { computeDueDate, slaDaysFor } from '@/domain/sla'
import { nextRef } from '@/domain/ref'
import { applyDerivations, summarizeLines } from '@/domain/field-map'
import { isEmptyLine, validateCommentBody, validateForSubmit } from '@/domain/schemas'
import type {
  DataProvider,
  DraftLineInput,
  ProvisionResult,
  RequestDetail,
  RequestScope,
} from '../provider'
import { listPath, spDelete, spGet, spMerge, spPost, spPostRaw } from './client'
import { DMP_GROUPS, LIST_SPECS } from './schema'
import {
  filterByScope,
  mapAudit,
  mapComment,
  mapLine,
  mapRequest,
  rolesFromGroups,
  type AuthoredItem,
  type LineItem,
  type RequestItem,
} from './mapping'

// SharePointProvider — Phase 2, built to the Phase-0 findings (nometadata
// writes only, on-demand digest). Enforces the SAME domain guards as the
// MockProvider: transition permissions, self-claim rule, empty-line pruning
// at submit, and applyDerivations on every line write.

const REQUESTS = 'DMP_Requests'
const LINES = 'DMP_RequestLines'
const COMMENTS = 'DMP_Comments'
const AUDIT = 'DMP_AuditLog'

const REQUEST_SELECT =
  '$select=Id,Title,RequestStatus,RequesterLogin,RequesterName,AssigneeLogin,AssigneeName,Created,SubmittedAt,DueDate,CompletedAt,SlaDays,Description,RejectReason,LineSummary'
const LINE_SELECT = '$select=Id,RequestId,ObjectType,LineAction,LineOrder,FieldData'

const item = (list: string, id: string | number) => `${listPath(list)}/items(${Number(id)})`

export class SharePointProvider implements DataProvider {
  private mePromise?: Promise<User>

  private me(): Promise<User> {
    return (this.mePromise ??= (async () => {
      const u = await spGet(
        '/_api/web/currentuser?$expand=Groups&$select=Id,Title,Email,LoginName,Groups/Title',
      )
      return {
        id: u.LoginName as string,
        displayName: u.Title as string,
        email: (u.Email as string) ?? '',
        roles: rolesFromGroups(((u.Groups ?? []) as { Title: string }[]).map((g) => g.Title)),
      }
    })())
  }

  private ctxFor(me: User, req: Request): TransitionCtx {
    return {
      roles: me.roles,
      isOwner: req.requesterId === me.id,
      isAssignee: req.assigneeId === me.id,
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.me()
  }

  private async fetchRequest(id: string): Promise<Request> {
    return mapRequest((await spGet(`${item(REQUESTS, id)}?${REQUEST_SELECT}`)) as RequestItem)
  }

  private async fetchLines(id: string): Promise<RequestLine[]> {
    const data = await spGet(
      `${listPath(LINES)}/items?${LINE_SELECT}&$filter=RequestId eq ${Number(id)}&$orderby=LineOrder&$top=4999`,
    )
    return ((data.value ?? []) as LineItem[]).map(mapLine)
  }

  async listRequests(scope: RequestScope): Promise<Request[]> {
    const me = await this.me()
    if (scope === 'all' && !me.roles.includes('admin'))
      throw new Error('Only admins can list all requests')
    const data = await spGet(`${listPath(REQUESTS)}/items?${REQUEST_SELECT}&$orderby=Id desc&$top=4999`)
    return filterByScope(((data.value ?? []) as RequestItem[]).map(mapRequest), scope, me)
  }

  async getRequest(id: string): Promise<RequestDetail> {
    const [me, request] = await Promise.all([this.me(), this.fetchRequest(id)])
    if (request.status === 'Draft' && request.requesterId !== me.id && !me.roles.includes('admin'))
      throw new Error('This draft is only visible to its requester')
    return { request, lines: await this.fetchLines(id) }
  }

  /** The request's DCR ref — only for child-item Titles (SharePoint list UI). */
  private async refOf(requestId: string): Promise<string> {
    const data = await spGet(`${item(REQUESTS, requestId)}?$select=Title`)
    return (data.Title as string) ?? ''
  }

  // Child-item Titles start with the request ref so admins can find (and
  // hand-delete) a request's rows straight in the SharePoint list UI. The
  // app itself never reads these Titles — it filters by RequestId.
  private async writeAudit(
    requestId: string,
    event: AuditEvent,
    oldValue?: string,
    newValue?: string,
    ref?: string,
  ) {
    const r = ref ?? (await this.refOf(requestId))
    await spPost(`${listPath(AUDIT)}/items`, {
      Title: `${r} ${event}`.trim(),
      RequestId: Number(requestId),
      Event: event,
      OldValue: oldValue ?? '',
      NewValue: newValue ?? '',
    })
  }

  /** Replace all lines of a request (derivations always applied — same rule as the mock). */
  private async writeLines(requestId: string, ref: string, lines: DraftLineInput[]) {
    const existing = await spGet(
      `${listPath(LINES)}/items?$select=Id&$filter=RequestId eq ${Number(requestId)}&$top=4999`,
    )
    for (const it of (existing.value ?? []) as { Id: number }[]) {
      await spDelete(item(LINES, it.Id))
    }
    let order = 0
    for (const l of lines) {
      order += 1
      await spPost(`${listPath(LINES)}/items`, {
        Title: `${ref} ${l.objectType} ${l.action}`.trim(),
        RequestId: Number(requestId),
        ObjectType: l.objectType,
        LineAction: l.action,
        LineOrder: order,
        FieldData: JSON.stringify(applyDerivations(l.objectType, l.fieldData)),
      })
    }
  }

  private async allRefs(): Promise<string[]> {
    const data = await spGet(`${listPath(REQUESTS)}/items?$select=Title&$top=4999`)
    return ((data.value ?? []) as { Title: string }[]).map((i) => i.Title)
  }

  async createRequest(lines: DraftLineInput[], description: string): Promise<Request> {
    const me = await this.me()
    if (!me.roles.includes('requester') && !me.roles.includes('admin'))
      throw new Error('Only requesters can create requests')
    const year = new Date().getFullYear()
    let ref = nextRef(await this.allRefs(), year)
    const created = await spPost(`${listPath(REQUESTS)}/items`, {
      Title: ref,
      RequestStatus: 'Draft',
      RequesterLogin: me.id,
      RequesterName: me.displayName,
      Description: description.trim(),
      LineSummary: summarizeLines(lines),
    })
    const id = String(created.Id)
    // tiny ref-collision window (no server to serialize numbering): re-check
    // after create and renumber once if two requests grabbed the same ref
    const dupes = await spGet(
      `${listPath(REQUESTS)}/items?$select=Id&$filter=Title eq '${ref}'&$top=10`,
    )
    if (((dupes.value ?? []) as unknown[]).length > 1) {
      ref = nextRef(await this.allRefs(), year)
      await spMerge(item(REQUESTS, id), { Title: ref })
    }
    await this.writeLines(id, ref, lines)
    await this.writeAudit(id, 'Created', undefined, undefined, ref)
    return this.fetchRequest(id)
  }

  async updateDraft(id: string, lines: DraftLineInput[], description: string): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    if (req.status !== 'Draft') throw new Error('Only drafts can be edited')
    if (req.requesterId !== me.id && !me.roles.includes('admin'))
      throw new Error('Only the requester can edit this draft')
    await this.writeLines(id, req.ref, lines)
    await spMerge(item(REQUESTS, id), {
      Description: description.trim(),
      LineSummary: summarizeLines(lines),
    })
    await this.writeAudit(id, 'DraftUpdated')
    return this.fetchRequest(id)
  }

  async submitRequest(id: string): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    let lines = await this.fetchLines(id)
    // empty (never-filled) lines are pruned at submit, not validated
    for (const l of lines.filter(isEmptyLine)) await spDelete(item(LINES, l.id))
    lines = lines.filter((l) => !isEmptyLine(l))
    const validation = validateForSubmit(lines, req.description)
    if (!validation.ok)
      throw new Error(validation.requestErrors[0] ?? 'Request has validation errors — fix the lines first')
    const t = assertTransition(this.ctxFor(me, req), req.status, 'Waiting to be started')
    const submittedAt = new Date().toISOString()
    const slaDays = slaDaysFor(lines)
    await spMerge(item(REQUESTS, id), {
      RequestStatus: 'Waiting to be started',
      SubmittedAt: submittedAt,
      DueDate: computeDueDate(submittedAt, slaDays),
      SlaDays: slaDays,
      RejectReason: '',
      LineSummary: summarizeLines(lines),
    })
    await this.writeAudit(id, t.event, 'Draft', 'Waiting to be started', req.ref)
    return this.fetchRequest(id)
  }

  async assignRequest(id: string, assigneeId: string): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    if (req.status !== 'Waiting to be started' && req.status !== 'In process')
      throw new Error(`Cannot assign a request in status "${req.status}"`)
    const isAdmin = me.roles.includes('admin')
    const isSelfClaim = me.roles.includes('maintainer') && assigneeId === me.id && !req.assigneeId
    if (!isAdmin && !isSelfClaim)
      throw new TransitionError('Maintainers may only claim unassigned requests for themselves')
    const assignee =
      assigneeId === me.id ? me : (await this.listAssignableUsers()).find((u) => u.id === assigneeId)
    if (!assignee) throw new Error('Unknown maintainer')
    await spMerge(item(REQUESTS, id), { AssigneeLogin: assignee.id, AssigneeName: assignee.displayName })
    await this.writeAudit(id, 'Assigned', req.assigneeName, assignee.displayName, req.ref)
    return this.fetchRequest(id)
  }

  async setStatus(id: string, to: RequestStatus): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    const t = assertTransition(this.ctxFor(me, req), req.status, to)
    if (to === 'Rejected') throw new Error('Use rejectRequest — a reject reason is required')
    const patch: Record<string, unknown> = { RequestStatus: to }
    if (to === 'Completed') patch.CompletedAt = new Date().toISOString()
    if (t.event === 'Reopened') {
      // back to draft: SLA is recomputed at the next submit
      Object.assign(patch, { SubmittedAt: null, DueDate: null, SlaDays: null })
    }
    await spMerge(item(REQUESTS, id), patch)
    await this.writeAudit(id, t.event, req.status, to, req.ref)
    return this.fetchRequest(id)
  }

  async rejectRequest(id: string, reason: string): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    if (!reason.trim()) throw new Error('A reject reason is required')
    const t = assertTransition(this.ctxFor(me, req), req.status, 'Rejected')
    await spMerge(item(REQUESTS, id), { RequestStatus: 'Rejected', RejectReason: reason.trim() })
    await this.writeAudit(id, t.event, req.status, reason.trim(), req.ref)
    return this.fetchRequest(id)
  }

  async addComment(id: string, body: string): Promise<Comment> {
    const bodyError = validateCommentBody(body)
    if (bodyError) throw new Error(bodyError)
    const [me, ref] = await Promise.all([this.me(), this.refOf(id)])
    const created = await spPost(`${listPath(COMMENTS)}/items`, {
      Title: ref,
      RequestId: Number(id),
      Body: body.trim(),
    })
    await this.writeAudit(id, 'CommentAdded', undefined, undefined, ref)
    return {
      id: String(created.Id),
      requestId: id,
      authorId: me.id,
      authorName: me.displayName,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }
  }

  async listComments(id: string): Promise<Comment[]> {
    const data = await spGet(
      `${listPath(COMMENTS)}/items?$select=Id,RequestId,Body,Created,Author/Title&$expand=Author&$filter=RequestId eq ${Number(id)}&$orderby=Id&$top=4999`,
    )
    return ((data.value ?? []) as AuthoredItem[]).map(mapComment)
  }

  async addAttachment(id: string, file: File): Promise<Attachment> {
    const safe = file.name.replace(/[\\/:*?"<>|#%&~]/g, '-')
    const created = await spPostRaw(
      `${item(REQUESTS, id)}/AttachmentFiles/add(FileName='${encodeURIComponent(safe.replace(/'/g, "''"))}')`,
      await file.arrayBuffer(),
    )
    await this.writeAudit(id, 'AttachmentAdded', undefined, safe)
    return { fileName: safe, url: (created.ServerRelativeUrl as string) ?? '', size: file.size }
  }

  async listAttachments(id: string): Promise<Attachment[]> {
    const data = await spGet(`${item(REQUESTS, id)}/AttachmentFiles`)
    return ((data.value ?? []) as { FileName: string; ServerRelativeUrl: string }[]).map((a) => ({
      fileName: a.FileName,
      url: a.ServerRelativeUrl,
    }))
  }

  async appendAudit(entry: {
    requestId: string
    event: AuditEvent
    oldValue?: string
    newValue?: string
  }): Promise<void> {
    await this.writeAudit(entry.requestId, entry.event, entry.oldValue, entry.newValue)
  }

  async listAudit(id: string): Promise<AuditEntry[]> {
    const data = await spGet(
      `${listPath(AUDIT)}/items?$select=Id,RequestId,Event,OldValue,NewValue,Created,Author/Title&$expand=Author&$filter=RequestId eq ${Number(id)}&$orderby=Id&$top=4999`,
    )
    return ((data.value ?? []) as AuthoredItem[]).map(mapAudit)
  }

  async provisionLists(): Promise<ProvisionResult[]> {
    const results: ProvisionResult[] = []
    for (const spec of LIST_SPECS) {
      try {
        let created = false
        try {
          await spGet(`${listPath(spec.title)}?$select=Title`)
        } catch {
          await spPost('/_api/web/lists', { Title: spec.title, BaseTemplate: 100 })
          created = true
        }
        if (spec.versioning) {
          // VERIFY-ON-SITE: list-property MERGE with plain JSON (same write
          // family the spike proved for items; surfaced here if it differs)
          await spMerge(listPath(spec.title), { EnableVersioning: true })
        }
        const before = await spGet(`${listPath(spec.title)}/fields?$select=InternalName&$top=500`)
        const existing = new Set(
          ((before.value ?? []) as { InternalName: string }[]).map((f) => f.InternalName),
        )
        const added: string[] = []
        for (const f of spec.fields) {
          if (existing.has(f.internalName)) continue
          await spPost(`${listPath(spec.title)}/fields/createfieldasxml`, {
            parameters: { SchemaXml: f.schemaXml, Options: 8 }, // 8 = use Name as internal name
          })
          added.push(f.internalName)
        }
        const after = await spGet(`${listPath(spec.title)}/fields?$select=InternalName&$top=500`)
        const afterSet = new Set(
          ((after.value ?? []) as { InternalName: string }[]).map((f) => f.InternalName),
        )
        const missing = spec.fields.filter((f) => !afterSet.has(f.internalName)).map((f) => f.internalName)
        if (missing.length) {
          results.push({ list: spec.title, status: 'missing', detail: `Missing fields: ${missing.join(', ')}` })
        } else {
          results.push({
            list: spec.title,
            status: created || added.length ? 'created' : 'ok',
            detail: added.length ? `Added fields: ${added.join(', ')}` : 'All fields present',
          })
        }
      } catch (e) {
        results.push({ list: spec.title, status: 'error', detail: e instanceof Error ? e.message : String(e) })
      }
    }
    return results
  }

  async listAssignableUsers(): Promise<User[]> {
    const data = await spGet(
      `/_api/web/sitegroups/getbyname('${encodeURIComponent(DMP_GROUPS.maintainer)}')/users?$select=Title,Email,LoginName&$top=500`,
    )
    return ((data.value ?? []) as { Title: string; Email?: string; LoginName: string }[]).map((u) => ({
      id: u.LoginName,
      displayName: u.Title,
      email: u.Email ?? '',
      roles: ['maintainer' as const],
    }))
  }
}

export function createSharePointProvider(): DataProvider {
  return new SharePointProvider()
}

/** Provision-screen extra: do the three DMP groups exist? (Groups are created manually per LIST_SETUP.md.) */
export async function checkDmpGroups(): Promise<{ name: string; exists: boolean }[]> {
  const data = await spGet('/_api/web/sitegroups?$select=Title&$top=500')
  const titles = new Set(((data.value ?? []) as { Title: string }[]).map((g) => g.Title))
  return Object.values(DMP_GROUPS).map((name) => ({ name, exists: titles.has(name) }))
}

/**
 * Provision-screen extra: spike-style write cycle on the scratch list —
 * including DELETE, the one verb Phase 0 did not exercise.
 */
export async function runConnectionSelfTest(): Promise<string[]> {
  const log: string[] = []
  try {
    await spGet(`${listPath('DMP_Spike')}?$select=Title`)
    log.push('Scratch list DMP_Spike exists')
  } catch {
    await spPost('/_api/web/lists', { Title: 'DMP_Spike', BaseTemplate: 100 })
    log.push('Created scratch list DMP_Spike')
  }
  const created = await spPost(`${listPath('DMP_Spike')}/items`, {
    Title: `self-test ${new Date().toISOString()}`,
  })
  log.push(`Created item ${created.Id}`)
  await spMerge(item('DMP_Spike', created.Id), { Title: 'self-test (updated)' })
  log.push('MERGE update OK')
  await spPostRaw(
    `${item('DMP_Spike', created.Id)}/AttachmentFiles/add(FileName='selftest.txt')`,
    new TextEncoder().encode('DMP connection self-test').buffer as ArrayBuffer,
  )
  log.push('Attachment OK')
  await spDelete(item('DMP_Spike', created.Id))
  log.push('DELETE OK — all verbs verified on this site')
  return log
}
