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
import { computeDueDate, extendDueDate, slaDaysFor } from '@/domain/sla'
import { nextRef } from '@/domain/ref'
import { normalizeFieldData, summarizeLines } from '@/domain/field-map'
import { isEmptyLine, validateAttachment, validateCommentBody, validateForSubmit } from '@/domain/schemas'
import type {
  DataProvider,
  DraftLineInput,
  ProvisionResult,
  RequestDetail,
  RequestScope,
} from '../provider'
import { listPath, spDelete, spGet, spMerge, spPost, webUrl } from './client'
import { notify } from './email'
import { PMDC_GROUPS, LIST_SPECS, REQUESTS_LIST } from './schema'
import {
  filterByScope,
  mapAudit,
  hasAddListItems,
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
// at submit, and normalizeFieldData on every line read and write.

const REQUESTS = REQUESTS_LIST
const LINES = 'PMDC_RequestLines'
const COMMENTS = 'PMDC_Comments'
const AUDIT = 'PMDC_AuditLog'

const REQUEST_SELECT =
  '$select=Id,Title,RequestStatus,RequesterLogin,RequesterName,AssigneeLogin,AssigneeName,Created,SubmittedAt,DueDate,CompletedAt,ReturnedAt,SlaDays,Description,RejectReason,LineSummary'
const LINE_SELECT = '$select=Id,RequestId,ObjectType,LineAction,LineOrder,FieldData'

const item = (list: string, id: string | number) => `${listPath(list)}/items(${Number(id)})`

export class SharePointProvider implements DataProvider {
  private mePromise?: Promise<User>

  private me(): Promise<User> {
    return (this.mePromise ??= (async () => {
      const u = await spGet(
        '/_api/web/currentuser?$expand=Groups&$select=Id,Title,Email,LoginName,Groups/Title',
      )
      const roles = rolesFromGroups(((u.Groups ?? []) as { Title: string }[]).map((g) => g.Title))
      if (roles.length === 0) {
        // no direct PMDC group membership — the user may still be a requester
        // via a nested AD security group (invisible to the Groups API, but
        // the authorization engine expands it). Never fail login over this.
        try {
          const perms = await spGet(`${listPath(REQUESTS)}/EffectiveBasePermissions`)
          if (hasAddListItems(Number(perms.Low))) roles.push('requester')
        } catch {
          // permission probe failed — fall back to group-derived roles only
        }
      }
      return {
        id: u.LoginName as string,
        displayName: u.Title as string,
        email: (u.Email as string) ?? '',
        roles,
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
        FieldData: JSON.stringify(normalizeFieldData(l.objectType, l.action, l.fieldData)),
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
    // Returned requests are edited DIRECTLY by the requester (no reopen step)
    if (req.status !== 'Draft' && req.status !== 'Returned')
      throw new Error('Only drafts and returned requests can be edited')
    if (req.requesterId !== me.id && !me.roles.includes('admin'))
      throw new Error('Only the requester can edit this request')
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
    const allLines = await this.fetchLines(id)
    // empty (never-filled) lines are pruned at submit, not validated. Validate
    // and check the transition BEFORE deleting anything: a rejected submit must
    // not destroy rows the requester can still fix.
    const empties = allLines.filter(isEmptyLine)
    const lines = allLines.filter((l) => !isEmptyLine(l))
    const validation = validateForSubmit(lines, req.description)
    if (!validation.ok)
      throw new Error(validation.requestErrors[0] ?? 'Request has validation errors — fix the lines first')
    const from = req.status
    const t = assertTransition(this.ctxFor(me, req), from, 'Waiting to be started')
    for (const l of empties) await spDelete(item(LINES, l.id))
    const patch: Record<string, unknown> = {
      RequestStatus: 'Waiting to be started',
      RejectReason: '',
      LineSummary: summarizeLines(lines),
    }
    if (from === 'Returned') {
      // resubmit: the SLA clock was PAUSED with the requester — the due date
      // grows by that interval; SubmittedAt/SlaDays stay (user decision 2026-07-21)
      if (req.dueDate && req.returnedAt)
        patch.DueDate = extendDueDate(req.dueDate, req.returnedAt, new Date().toISOString())
      patch.ReturnedAt = null
    } else {
      const submittedAt = new Date().toISOString()
      const slaDays = slaDaysFor(lines)
      Object.assign(patch, {
        SubmittedAt: submittedAt,
        DueDate: computeDueDate(submittedAt, slaDays),
        SlaDays: slaDays,
      })
    }
    await spMerge(item(REQUESTS, id), patch)
    await this.writeAudit(id, t.event, from, 'Waiting to be started', req.ref)
    const submitted = await this.fetchRequest(id)
    // a resubmit after Return keeps its assignee — tell that one person, not
    // the whole maintainer group again
    await notify({ kind: from === 'Returned' ? 'resubmitted' : 'submitted' }, submitted, me.id)
    return submitted
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
    const assigned = await this.fetchRequest(id)
    // self-claim addresses the actor, who is dropped from recipients — no mail
    await notify({ kind: 'assigned' }, assigned, me.id)
    return assigned
  }

  async setStatus(id: string, to: RequestStatus): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    const t = assertTransition(this.ctxFor(me, req), req.status, to)
    if (to === 'Rejected') throw new Error('Use rejectRequest — a reject reason is required')
    if (to === 'Returned') throw new Error('Use returnRequest — a return reason is required')
    if (req.status === 'Returned')
      throw new Error('Use submitRequest — resubmission validates lines and extends the due date')
    const patch: Record<string, unknown> = { RequestStatus: to }
    if (to === 'Completed') patch.CompletedAt = new Date().toISOString()
    if (t.event === 'Reopened') {
      // back to draft: SLA is recomputed at the next submit
      Object.assign(patch, { SubmittedAt: null, DueDate: null, SlaDays: null })
    }
    await spMerge(item(REQUESTS, id), patch)
    await this.writeAudit(id, t.event, req.status, to, req.ref)
    const next = await this.fetchRequest(id)
    // Completed → the requester; Withdrawn → the assignee, so they stop work.
    // Draft/In process/Reopened stay silent by design.
    if (to === 'Completed') await notify({ kind: 'completed' }, next, me.id)
    if (to === 'Withdrawn') await notify({ kind: 'withdrawn' }, next, me.id)
    return next
  }

  async rejectRequest(id: string, reason: string): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    if (!reason.trim()) throw new Error('A reject reason is required')
    const t = assertTransition(this.ctxFor(me, req), req.status, 'Rejected')
    await spMerge(item(REQUESTS, id), { RequestStatus: 'Rejected', RejectReason: reason.trim() })
    await this.writeAudit(id, t.event, req.status, reason.trim(), req.ref)
    const rejected = await this.fetchRequest(id)
    await notify({ kind: 'rejected', reason: reason.trim() }, rejected, me.id)
    return rejected
  }

  async returnRequest(id: string, reason: string): Promise<Request> {
    const [me, req] = await Promise.all([this.me(), this.fetchRequest(id)])
    if (!reason.trim()) throw new Error('A return reason is required')
    const t = assertTransition(this.ctxFor(me, req), req.status, 'Returned')
    await spMerge(item(REQUESTS, id), {
      RequestStatus: 'Returned',
      ReturnedAt: new Date().toISOString(), // pause marker — resubmit extends DueDate by the gap
      RejectReason: reason.trim(), // shown to the requester; assignee is KEPT
    })
    await this.writeAudit(id, t.event, req.status, reason.trim(), req.ref)
    const returned = await this.fetchRequest(id)
    await notify({ kind: 'returned', reason: reason.trim() }, returned, me.id)
    return returned
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
    // the other participants hear about it — requester + assignee, minus the author
    await notify(
      { kind: 'comment', author: me.displayName, body: body.trim() },
      await this.fetchRequest(id),
      me.id,
    )
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
    const attError = validateAttachment(file.name, file.size, (await this.listAttachments(id)).length)
    if (attError) throw new Error(attError)
    const safe = file.name.replace(/[\\/:*?"<>|#%&~]/g, '-')
    const created = await spPost(
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
      `/_api/web/sitegroups/getbyname('${encodeURIComponent(PMDC_GROUPS.maintainer)}')/users?$select=Title,Email,LoginName&$top=500`,
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

/** Provision-screen extra: do the three PMDC groups exist? (Groups are created manually per LIST_SETUP.md.) */
export async function checkDmpGroups(): Promise<{ name: string; exists: boolean }[]> {
  const data = await spGet('/_api/web/sitegroups?$select=Title&$top=500')
  const titles = new Set(((data.value ?? []) as { Title: string }[]).map((g) => g.Title))
  return Object.values(PMDC_GROUPS).map((name) => ({ name, exists: titles.has(name) }))
}

/**
 * Web-relative path of the page the app is being served from, e.g.
 * "app/index.aspx" — derived from the CURRENT location rather than assumed,
 * so it works whatever the library and subsite are named. Hardcoding a
 * library name pointed the welcome page at a file that didn't exist
 * (on-site 2026-07-24: library named "app", not "PMDCApp" → 404).
 */
async function appPageRelativeUrl(): Promise<string> {
  const base = await webUrl() // server-relative web URL, '' at a root site
  // slice BEFORE decoding: `base` is un-decoded, so lengths must line up
  const rel = decodeURIComponent(window.location.pathname.slice(base.length)).replace(/^\/+/, '')
  if (!/\.aspx$/i.test(rel)) {
    // the bare site URL already serves the app (no page in the path), so
    // there is nothing to derive — and nothing to change
    throw new Error(
      `Cannot tell which page to set: the address is "${window.location.pathname}". ` +
        'Open the app from its library (…/<library>/index.aspx) and click this again.',
    )
  }
  return rel
}

/**
 * Point the site's welcome page at the app, so opening the bare site URL
 * serves the app directly. Path is web-relative and self-derived, so it can
 * never point at a file that isn't there.
 * VERIFY-ON-SITE: rootfolder MERGE is standard REST — the Site setup button
 * surfaces success/failure.
 */
export async function setAppAsSiteHome(): Promise<string> {
  await spMerge('/_api/web/rootfolder', { WelcomePage: await appPageRelativeUrl() })
  const check = await spGet('/_api/web/rootfolder?$select=WelcomePage')
  return String(check.WelcomePage ?? '')
}

/**
 * Hide (or unhide) the four PMDC lists from Site contents so requesters
 * don't stumble into raw list views. Cosmetic hardening only — direct list
 * URLs and REST keep working (the real protection is LIST_SETUP.md §4c).
 * SharePoint Designer does NOT show hidden lists — unhide before editing
 * the email workflow, re-hide after.
 * VERIFY-ON-SITE: list MERGE of Hidden uses the same verified nometadata
 * write path as the self-test; the button reports per-list success/failure.
 */
export async function setListsHidden(hidden: boolean): Promise<string[]> {
  const log: string[] = []
  for (const spec of LIST_SPECS) {
    try {
      await spMerge(listPath(spec.title), { Hidden: hidden })
      log.push(`${spec.title}: ${hidden ? 'hidden from' : 'shown in'} Site contents`)
    } catch (e) {
      log.push(`${spec.title}: FAILED — ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return log
}

/**
 * Provision-screen extra: spike-style write cycle on the scratch list —
 * including DELETE, the one verb Phase 0 did not exercise.
 */
export async function runConnectionSelfTest(): Promise<string[]> {
  const log: string[] = []
  try {
    await spGet(`${listPath('PMDC_Spike')}?$select=Title`)
    log.push('Scratch list PMDC_Spike exists')
  } catch {
    await spPost('/_api/web/lists', { Title: 'PMDC_Spike', BaseTemplate: 100 })
    log.push('Created scratch list PMDC_Spike')
  }
  const created = await spPost(`${listPath('PMDC_Spike')}/items`, {
    Title: `self-test ${new Date().toISOString()}`,
  })
  log.push(`Created item ${created.Id}`)
  await spMerge(item('PMDC_Spike', created.Id), { Title: 'self-test (updated)' })
  log.push('MERGE update OK')
  await spPost(
    `${item('PMDC_Spike', created.Id)}/AttachmentFiles/add(FileName='selftest.txt')`,
    new TextEncoder().encode('PMDC connection self-test').buffer as ArrayBuffer,
  )
  log.push('Attachment OK')
  await spDelete(item('PMDC_Spike', created.Id))
  log.push('DELETE OK — all verbs verified on this site')
  try {
    const perms = await spGet(`${listPath(REQUESTS)}/EffectiveBasePermissions`)
    log.push(
      `Effective permissions on ${REQUESTS}: High=${perms.High} Low=${perms.Low} — ` +
        (hasAddListItems(Number(perms.Low))
          ? 'AddListItems OK (requester-by-permission works for AD-group users)'
          : 'NO AddListItems — this account could not create requests'),
    )
  } catch (e) {
    log.push(`EffectiveBasePermissions probe failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  return log
}
