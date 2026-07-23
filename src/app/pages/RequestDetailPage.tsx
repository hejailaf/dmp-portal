import { useEffect, useRef, useState } from 'react'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CornerUpLeft,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Undo2,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { getProvider } from '@/data'
import { makeRequestExport } from '@/lib/excel-export'
import { appliesTo, OBJECT_TYPE_CONFIGS, summarizeLinesParts, type ObjectTypeConfig } from '@/domain/field-map'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_COUNT,
  COMMENT_MAX_LENGTH,
  isEmptyLine,
  validateAttachment,
} from '@/domain/schemas'
import { availableTransitions, type TransitionCtx } from '@/domain/status'
import { STATUSES, type Attachment, type AuditEvent, type ObjectType, type Request, type RequestLine } from '@/domain/types'
import { downloadBlob, formatDate, formatDateValue } from '@/lib/utils'
import { relativeDateTime } from '../format'
import { useAsync, usePageTitle } from '../hooks'
import { href, navigate } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { readListState, scopesFor } from './RequestListPage'
import { autosaveKeyFor } from './RequestEditorPage'
import { DueSuffix, StatusStepper } from '../components/badges'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { Select, Textarea } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { autoColumnSize, ClippedCell, DataGrid, usePersistedColumnSizing } from '../components/DataGrid'

const lineColumnHelper = createColumnHelper<RequestLine>()

function DetailLineGrid({ config, lines }: { config: ObjectTypeConfig; lines: RequestLine[] }) {
  // auto-fit from the (static) line values — header width at minimum, capped
  const autoSizes: Record<string, number> = {
    action: autoColumnSize(S.editor.action, lines.map((l) => config.actionLabels[l.action])),
  }
  for (const field of config.fields) {
    autoSizes[field.key] = autoColumnSize(
      field.label,
      lines.map((l) => (appliesTo(field, l.action) ? (l.fieldData[field.key] ?? '') : '')),
    )
  }

  const columns = [
    lineColumnHelper.display({
      id: 'no',
      header: S.editor.lineNo,
      size: 40,
      minSize: 40,
      enableResizing: false,
      cell: (info) => <span className="text-muted-foreground">{info.row.index + 1}</span>,
    }),
    lineColumnHelper.display({
      id: 'action',
      header: S.editor.action,
      size: autoSizes.action,
      cell: (info) => (
        <ClippedCell value={config.actionLabels[info.row.original.action]} className="font-medium" />
      ),
    }),
    ...config.fields.map((field) =>
      lineColumnHelper.display({
        id: field.key,
        header: field.label,
        size: autoSizes[field.key],
        cell: (info) => {
          const line = info.row.original
          if (!appliesTo(field, line.action))
            return <span className="text-xs text-muted-foreground/60">{S.editor.notApplicable}</span>
          const raw = line.fieldData[field.key] ?? ''
          return <ClippedCell value={field.input === 'date' ? formatDateValue(raw) : raw} />
        },
      }),
    ),
  ]
  // auto-hide: a column shows only if it applies to a present action AND
  // holds a value in at least one line (display-only — data is untouched)
  const present = new Set(lines.map((l) => l.action))
  const columnVisibility: Record<string, boolean> = {}
  for (const field of config.fields) {
    columnVisibility[field.key] =
      [...present].some((a) => appliesTo(field, a)) &&
      lines.some((l) => (l.fieldData[field.key] ?? '').trim() !== '')
  }

  const sizing = usePersistedColumnSizing(`detail-${config.objectType}`)
  const table = useReactTable({
    data: lines,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
    state: { columnSizing: sizing.columnSizing, columnVisibility },
    onColumnSizingChange: sizing.onColumnSizingChange,
  })
  // #, Action and (where present) Description stay pinned while SAP fields scroll
  return <DataGrid table={table} stickyIds={['no', 'action', 'description']} />
}

/** Overflow menu for secondary/destructive header actions — hand-rolled, no dependency. */
function MoreMenu({
  items,
}: {
  items: { label: string; destructive?: boolean; disabled?: boolean; onClick: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <Button variant="outline" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="h-4 w-4" /> {S.detail.more}
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-md border bg-card p-1 shadow-raised">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              className={`block w-full rounded px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50 ${item.destructive ? 'text-destructive' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One cell of the header meta strip: tiny uppercase label over the value. */
function StripItem({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-[100px] flex-1 px-4 py-1 first:pl-0 last:pr-0">
      <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[13px] ${strong ? 'font-medium text-secondary-foreground' : ''}`}>
        {children}
      </div>
    </div>
  )
}

interface AttachmentsState {
  data?: Attachment[]
  loading: boolean
  error?: string
  reload: () => void
}

/** Attachments tab panel — list state lives on the page (the tab label needs the count). */
function AttachmentsPanel({
  requestId,
  attachments,
  onAdded,
}: {
  requestId: string
  attachments: AttachmentsState
  onAdded: () => void
}) {
  const provider = getProvider()
  const fileRef = useRef<HTMLInputElement>(null)
  // staged picks live ONLY in the browser until the user hits Upload — the
  // single commit point; removing a pending file means it never left the PC
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>()

  const uploadedCount = attachments.data?.length ?? 0
  const totalCount = uploadedCount + pending.length
  const full = totalCount >= ATTACHMENT_MAX_COUNT

  const stageFiles = (files: FileList) => {
    setError(undefined)
    const next = [...pending]
    for (const file of files) {
      const err = validateAttachment(file.name, file.size, uploadedCount + next.length)
      if (err) {
        setError(err) // show the first problem; valid siblings still stage
        continue
      }
      next.push(file)
    }
    setPending(next)
  }

  const uploadPending = async () => {
    setUploading(true)
    setError(undefined)
    let queue = [...pending]
    try {
      while (queue.length > 0) {
        await provider.addAttachment(requestId, queue[0])
        queue = queue.slice(1)
        setPending(queue)
      }
      onAdded()
    } catch (e) {
      // the failed file (and everything after it) stays pending
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
      attachments.reload()
    }
  }

  const kb = (size: number) => `${Math.max(1, Math.round(size / 1024))} KB`

  return (
    <div className="space-y-3">
        {attachments.loading && <p className="text-sm text-muted-foreground">{S.detail.loading}</p>}
        {attachments.error && <p className="text-sm text-destructive">{attachments.error}</p>}
        {attachments.data && attachments.data.length === 0 && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">{S.detail.attachmentsEmpty}</p>
        )}
        {attachments.data && attachments.data.length > 0 && (
          <ul className="space-y-1">
            {attachments.data.map((a) => (
              <li key={a.fileName} className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4 flex-none text-muted-foreground" />
                <a
                  href={a.url}
                  download={a.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {a.fileName}
                </a>
                {a.size != null && (
                  <span className="flex-none text-xs text-muted-foreground">{kb(a.size)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <ul className="space-y-1">
            {pending.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4 flex-none opacity-60" />
                <span className="break-all">{f.name}</span>
                <span className="flex-none text-xs">
                  {kb(f.size)} · {S.detail.attachmentPendingNote}
                </span>
                <button
                  type="button"
                  aria-label={S.detail.attachmentRemove}
                  title={S.detail.attachmentRemove}
                  className="flex-none rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  disabled={uploading}
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files && files.length > 0) stageFiles(files)
            e.target.value = '' // allow re-picking the same file
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={uploading || full}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" /> {S.detail.attachmentAdd}
          </Button>
          {pending.length > 0 && (
            <Button size="sm" disabled={uploading} onClick={() => void uploadPending()}>
              {uploading ? S.detail.attachmentUploading : S.detail.attachmentUpload(pending.length)}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {S.detail.attachmentCount(totalCount, ATTACHMENT_MAX_COUNT)}
          </span>
        </div>
    </div>
  )
}

const AUDIT_ICONS: Record<AuditEvent, LucideIcon> = {
  Created: Plus,
  DraftUpdated: Pencil,
  Submitted: Send,
  Assigned: UserCheck,
  StatusChanged: ArrowRight,
  Rejected: X,
  Returned: CornerUpLeft,
  Reopened: RotateCcw,
  Withdrawn: Undo2,
  CommentAdded: MessageSquare,
  AttachmentAdded: Paperclip,
}


export function RequestDetailPage({ id }: { id: string }) {
  const user = useCurrentUser()
  const provider = getProvider()
  const detail = useAsync(() => provider.getRequest(id), [id])
  const comments = useAsync(() => provider.listComments(id), [id])
  const audit = useAsync(() => provider.listAudit(id), [id])
  const attachments = useAsync(() => provider.listAttachments(id), [id])
  const maintainers = useAsync(() => provider.listAssignableUsers(), [])

  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [banner, setBanner] = useState<string>()
  // one reason dialog serves Reject (admin) and Return to requester (maintainer)
  const [reasonTarget, setReasonTarget] = useState<'Rejected' | 'Returned'>()
  const [rejectReason, setRejectReason] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [commentBody, setCommentBody] = useState('')
  // Line items tab strip: default = first present type; collapsed = strip only
  const [linesTab, setLinesTab] = useState<ObjectType>()
  const [linesOpen, setLinesOpen] = useState(true)
  // was the clicked tab already the active one? Captured on mousedown-CAPTURE,
  // BEFORE Radix's mousedown switches the value — so the trailing click knows
  // whether it was a re-select (→ toggle collapse) or a switch (→ do nothing)
  const activeTabBeforeClick = useRef(false)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setBanner(undefined)
    try {
      await fn()
      detail.reload()
      audit.reload()
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  usePageTitle(detail.data?.request.ref)
  // back to the list this request was opened from (last-used list state);
  // ignore a stored scope this user can't browse (e.g. after a role change)
  const storedScope = readListState().scope
  const backScope =
    storedScope && scopesFor(user).includes(storedScope) ? storedScope : scopesFor(user)[0]

  const backLink = (
    <a
      href={href(`/requests?scope=${backScope}`)}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {S.list.title[backScope]}
    </a>
  )

  if (detail.loading)
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 w-full rounded-card" />
        <Skeleton className="h-56 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    )
  // error/not-found still offer the way back to the list
  if (detail.error)
    return (
      <div className="space-y-4">
        {backLink}
        <p className="text-destructive">{detail.error}</p>
      </div>
    )
  if (!detail.data)
    return (
      <div className="space-y-4">
        {backLink}
        <p className="text-destructive">{S.detail.notFound}</p>
      </div>
    )

  const { request: req, lines } = detail.data
  const ctx: TransitionCtx = {
    roles: user.roles,
    isOwner: req.requesterId === user.id,
    isAssignee: req.assigneeId === user.id,
  }
  const isAdmin = user.roles.includes('admin')
  const isStaff = isAdmin || user.roles.includes('maintainer')
  const transitions = availableTransitions(ctx, req.status)

  // Audit entries store raw status names; show the viewer wording used
  // everywhere else. Whether "Waiting to be started" was Assigned at that
  // moment is inferred from an Assigned event earlier in the trail.
  // Non-status values (assignee names) pass through untouched.
  const auditEvents = audit.data ?? []
  const auditValueLabel = (value: string, chronIdx: number) =>
    (STATUSES as readonly string[]).includes(value)
      ? S.statusLabel(
          value,
          auditEvents.slice(0, chronIdx + 1).some((e) => e.event === 'Assigned'),
          isStaff,
        )
      : value
  // Returned requests are edited directly by their requester (no reopen step)
  const canEditDraft = (req.status === 'Draft' || req.status === 'Returned') && (ctx.isOwner || isAdmin)
  const canClaim =
    user.roles.includes('maintainer') && !req.assigneeId && req.status === 'Waiting to be started'
  const canAssign = isAdmin && (req.status === 'Waiting to be started' || req.status === 'In process')

  const doTransition = (to: Request['status']) => {
    if (to === 'Rejected' || to === 'Returned') {
      setRejectReason('')
      setReasonTarget(to)
      return
    }
    // submit (Draft) and resubmit (Returned) go through submitRequest —
    // validation + SLA compute/extension live there, not in setStatus
    if (to === 'Waiting to be started' && (req.status === 'Draft' || req.status === 'Returned')) {
      void run(async () => {
        await provider.submitRequest(req.id)
        // the editor's autosave invariant: EVERY successful submit clears the
        // key — including this detail-page path, or a stale autosave later
        // resurrects pre-submit edits over the newer server copy
        localStorage.removeItem(autosaveKeyFor(user.id, req.id))
      })
      return
    }
    void run(() => provider.setStatus(req.id, to))
  }

  // display-only: scratch (empty) rows are hidden here, and with them any
  // table whose rows are all empty — the editor still shows everything
  const visibleLines = lines.filter((l) => !isEmptyLine(l))
  const groups = OBJECT_TYPE_CONFIGS.map((cfg) => ({
    cfg,
    lines: visibleLines.filter((l) => l.objectType === cfg.objectType),
  })).filter((g) => g.lines.length > 0)
  const activeLinesTab = linesTab ?? groups[0]?.cfg.objectType

  // "Changed" = the newest audit entry: every update (edits, status moves,
  // comments, attachments) writes one, so it tracks true last activity
  const lastChangedAt = audit.data?.length ? audit.data[audit.data.length - 1].at : req.createdAt

  const doExport = async () => {
    setExporting(true)
    setBanner(undefined)
    try {
      downloadBlob(await makeRequestExport(req, visibleLines), `${req.ref}.xlsx`)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  const openAssign = () => {
    setAssigneeId(req.assigneeId ?? maintainers.data?.[0]?.id ?? '')
    setAssignOpen(true)
  }

  // copy description + lines into a fresh draft owned by the current user;
  // provider-side normalization keeps visible values only. Attachments are
  // deliberately not copied (no server-side copy API).
  const doDuplicate = async () => {
    setBusy(true)
    setBanner(undefined)
    try {
      const created = await provider.createRequest(
        visibleLines.map((l, i) => ({
          objectType: l.objectType,
          action: l.action,
          order: i + 1,
          fieldData: l.fieldData,
        })),
        req.description,
      )
      navigate(`/requests/${created.id}/edit`)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // one primary CTA per state; Export + the destructive Reject sit one
  // deliberate click away in the More menu (misclick-proofing Reject)
  const rejectTransition = transitions.find((t) => t.to === 'Rejected')
  const dueActive =
    !!req.dueDate &&
    req.status !== 'Completed' &&
    req.status !== 'Rejected' &&
    req.status !== 'Withdrawn'
  const stripLink = 'text-primary hover:underline'

  const postComment = () =>
    void run(async () => {
      await provider.addComment(req.id, commentBody)
      setCommentBody('')
      comments.reload()
    })

  return (
    <div className="space-y-5">
      {backLink}
      {banner && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm text-destructive">{banner}</p>
      )}
      {req.status === 'Rejected' && req.rejectReason && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm">
          <span className="font-semibold text-destructive">{S.detail.rejectReason}: </span>
          {req.rejectReason}
        </p>
      )}
      {req.status === 'Returned' && req.rejectReason && (
        <p className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-tint)] p-3 text-sm">
          <span className="font-semibold">{S.detail.returnReason}: </span>
          {req.rejectReason}
        </p>
      )}

      {/* document header (ux-experiments 2026-07-21): actions live IN the
          card on the ref row; the status pill grew into a lifecycle stepper;
          due date carries its countdown inline. Teal top rule = letterhead. */}
      <Card className="reveal border-t-2 border-t-[var(--teal)]">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {req.description ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {req.ref}
              </span>
            ) : (
              <h1 className="font-display text-title text-secondary-foreground">{req.ref}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {canEditDraft && (
                <a href={href(`/requests/${req.id}/edit`)}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" />{' '}
                    {req.status === 'Draft' ? S.detail.editDraft : S.detail.editRequest}
                  </Button>
                </a>
              )}
              {/* while unassigned, Assign is the natural next step → primary;
                  Start work takes over once someone owns the request */}
              {canAssign && (
                <Button variant={req.assigneeId ? 'outline' : 'default'} disabled={busy} onClick={openAssign}>
                  {req.assigneeId ? S.detail.reassign : S.detail.assign}
                </Button>
              )}
              {canClaim && (
                <Button disabled={busy} onClick={() => void run(() => provider.assignRequest(req.id, user.id))}>
                  {S.detail.claim}
                </Button>
              )}
              {/* Return is a routine maintainer action → visible outline button;
                  Reject stays admin-only in the More menu */}
              {transitions
                .filter((t) => t.to !== 'Rejected')
                .map((t) => (
                  <Button
                    key={t.to}
                    variant={
                      t.to === 'Returned' || t.to === 'Withdrawn' || (canAssign && !req.assigneeId)
                        ? 'outline'
                        : 'default'
                    }
                    disabled={busy}
                    onClick={() => doTransition(t.to)}
                  >
                    {t.label}
                  </Button>
                ))}
              <MoreMenu
                items={[
                  {
                    label: exporting ? S.detail.exporting : S.detail.exportExcel,
                    disabled: exporting || visibleLines.length === 0,
                    onClick: () => void doExport(),
                  },
                  ...(user.roles.includes('requester') || isAdmin
                    ? [
                        {
                          label: S.detail.duplicate,
                          disabled: busy || visibleLines.length === 0,
                          onClick: () => void doDuplicate(),
                        },
                      ]
                    : []),
                  ...(rejectTransition
                    ? [
                        {
                          label: rejectTransition.label,
                          destructive: true,
                          disabled: busy,
                          onClick: () => doTransition('Rejected'),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>
          {req.description && (
            <h1
              className="font-display text-title mt-1.5 truncate text-secondary-foreground"
              title={req.description}
            >
              {req.description}
            </h1>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusStepper status={req.status} assigneeId={req.assigneeId} />
            {/* one chip per present type — short label + action counts,
                full name on hover (computed from lines, not the summary string) */}
            {visibleLines.length > 0 && (
              <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                {summarizeLinesParts(visibleLines).map((p) => (
                  <span
                    key={p.objectType}
                    title={`${p.label}: ${p.text}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                  >
                    <span className="font-semibold">{S.list.typeShort[p.label] ?? p.label}</span>
                    <span className="text-muted-foreground">{p.text}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap divide-x divide-border border-t pt-2.5">
            <StripItem label={S.detail.requester} strong>
              {req.requesterName}
            </StripItem>
            <StripItem label={S.detail.assignee}>
              {req.assigneeName ?? <span className="text-muted-foreground">{S.detail.unassigned}</span>}
              {canAssign && (
                <button type="button" className={`ml-1.5 ${stripLink}`} disabled={busy} onClick={openAssign}>
                  · {req.assigneeId ? S.detail.reassign : S.detail.assign}
                </button>
              )}
              {canClaim && (
                <button
                  type="button"
                  className={`ml-1.5 ${stripLink}`}
                  disabled={busy}
                  onClick={() => void run(() => provider.assignRequest(req.id, user.id))}
                >
                  · {S.list.claim}
                </button>
              )}
            </StripItem>
            <StripItem label={S.detail.submittedAt}>{formatDate(req.submittedAt)}</StripItem>
            <StripItem label={S.detail.changedAt}>{formatDate(lastChangedAt)}</StripItem>
            {req.completedAt && (
              <StripItem label={S.detail.completedAt}>{formatDate(req.completedAt)}</StripItem>
            )}
            <StripItem label={S.detail.dueDate} strong>
              {formatDate(req.dueDate)}
              {dueActive && (
                <>
                  {' · '}
                  <DueSuffix request={req} />
                </>
              )}
            </StripItem>
          </div>
        </CardContent>
      </Card>

      {/* line items — editor-style tab strip, one PRESENT type per tab;
          clicking the active tab (or the chevron) collapses to the strip */}
      <Card className="reveal" style={{ '--stagger-i': 1 } as React.CSSProperties}>
        {groups.length === 0 ? (
          <>
            <CardHeader>
              <CardTitle>{S.detail.linesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{S.detail.noLines}</p>
            </CardContent>
          </>
        ) : (
          <CardContent className="p-0">
            <Tabs
              value={activeLinesTab}
              // onValueChange fires ONLY on an actual tab change (Radix routes
              // it through useControllableState) — so it's the switch handler,
              // for both pointer (mousedown) and keyboard (arrow) activation.
              // It never fires when the already-active tab is re-clicked; that
              // collapse toggle lives on the trigger's onClick below.
              onValueChange={(v) => {
                activeTabBeforeClick.current = false // a switch consumes any pending click (keyboard-safe)
                setLinesTab(v as ObjectType)
                setLinesOpen(true)
              }}
            >
              {/* open: border-b so the active tab merges into the grid panel;
                  collapsed: no panel below, so drop the border and pad the
                  bottom — otherwise the active tab's square, card-filled bottom
                  overhangs the card's rounded corners */}
              <div className={`flex items-center gap-2 px-4 pt-3 ${linesOpen ? 'border-b' : 'pb-3'}`}>
                <button
                  type="button"
                  aria-expanded={linesOpen}
                  aria-label={linesOpen ? S.detail.linesCollapse : S.detail.linesExpand}
                  title={linesOpen ? S.detail.linesCollapse : S.detail.linesExpand}
                  className="mb-1 self-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setLinesOpen((o) => !o)}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${linesOpen ? '' : '-rotate-90'}`}
                  />
                </button>
                <TabsList>
                  {groups.map(({ cfg, lines: groupLines }) => (
                    <TabsTrigger
                      key={cfg.objectType}
                      value={cfg.objectType}
                      // capture (before Radix's bubble-phase mousedown switch)
                      // whether this tab was already active
                      onMouseDownCapture={() => {
                        activeTabBeforeClick.current = activeLinesTab === cfg.objectType
                      }}
                      // re-clicking the active tab (no switch → onValueChange
                      // didn't fire) toggles the list open/closed
                      onClick={() => {
                        if (activeTabBeforeClick.current) setLinesOpen((o) => !o)
                      }}
                    >
                      {cfg.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {S.editor.tabCount(groupLines.length)}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {linesOpen &&
                groups.map(({ cfg, lines: groupLines }) => (
                  <TabsContent key={cfg.objectType} value={cfg.objectType} className="px-4 pb-4">
                    <DetailLineGrid config={cfg} lines={groupLines} />
                  </TabsContent>
                ))}
            </Tabs>
          </CardContent>
        )}
      </Card>

      {/* activity — one card, three tabs (browser-tab styling shared with the
          editor); reveal stays on the CARD only — tab panels re-render per
          action without unmount and must not animate */}
      <Card className="reveal" style={{ '--stagger-i': 2 } as React.CSSProperties}>
        <CardContent className="p-0">
          <Tabs defaultValue="comments">
            <div className="border-b px-4 pt-3">
              <TabsList>
                <TabsTrigger value="comments">
                  {S.detail.commentsTitle}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {S.editor.tabCount(comments.data?.length ?? 0)}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="attachments">
                  {S.detail.attachmentsTitle}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {S.editor.tabCount(attachments.data?.length ?? 0)}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="audit">
                  {S.detail.auditTitle}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {S.editor.tabCount(audit.data?.length ?? 0)}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="comments" className="space-y-3 px-4 pb-4">
              {/* the list scrolls; the composer below stays visible */}
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {comments.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">{S.detail.noComments}</p>
                )}
                {comments.data?.map((c) => (
                  <div key={c.id} className="rounded-md bg-muted/60 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{c.authorName}</span>
                      <span className="text-xs text-muted-foreground">{relativeDateTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-1">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && commentBody.trim() && !busy) {
                      e.preventDefault()
                      postComment()
                    }
                  }}
                  placeholder={S.detail.commentPlaceholder}
                  maxLength={COMMENT_MAX_LENGTH}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={busy || !commentBody.trim()} onClick={postComment}>
                    {S.detail.commentAdd}
                  </Button>
                  <span className="text-xs text-muted-foreground">{S.detail.commentHint}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="px-4 pb-4">
              <AttachmentsPanel requestId={req.id} attachments={attachments} onAdded={() => audit.reload()} />
            </TabsContent>

            <TabsContent value="audit" className="px-4 pb-4">
              {/* newest first; each event carries its icon and a relative time */}
              <div className="max-h-80 overflow-y-auto">
                {[...(audit.data ?? [])].reverse().map((a, i, all) => {
                  const Icon = AUDIT_ICONS[a.event]
                  return (
                    <div key={a.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${
                            i === 0
                              ? 'bg-accent text-primary'
                              : 'border bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {i < all.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
                      </div>
                      <div className="min-w-0 break-words pb-4 text-sm">
                        <span className="font-medium">{a.actorName}</span> {S.audit[a.event]}
                        {a.oldValue && a.newValue && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({auditValueLabel(a.oldValue, all.length - 1 - i)} →{' '}
                            {auditValueLabel(a.newValue, all.length - 1 - i)})
                          </span>
                        )}
                        {!a.oldValue && a.newValue && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({auditValueLabel(a.newValue, all.length - 1 - i)})
                          </span>
                        )}
                        <div className="mt-0.5 text-xs text-muted-foreground">{relativeDateTime(a.at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* reason dialog — Reject (admin) and Return to requester share it */}
      <Dialog open={!!reasonTarget} onOpenChange={(open) => !open && setReasonTarget(undefined)}>
        <DialogContent>
          <DialogTitle>
            {reasonTarget === 'Returned' ? S.detail.returnTitle : S.detail.rejectTitle}
          </DialogTitle>
          <label className="mb-1 block text-sm font-medium">
            {reasonTarget === 'Returned' ? S.detail.returnReasonLabel : S.detail.rejectReasonLabel}
          </label>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReasonTarget(undefined)}>
              {S.editor.cancel}
            </Button>
            <Button
              variant={reasonTarget === 'Returned' ? 'default' : 'destructive'}
              disabled={!rejectReason.trim() || busy}
              onClick={() => {
                const target = reasonTarget
                setReasonTarget(undefined)
                void run(() =>
                  target === 'Returned'
                    ? provider.returnRequest(req.id, rejectReason)
                    : provider.rejectRequest(req.id, rejectReason),
                )
              }}
            >
              {reasonTarget === 'Returned' ? S.detail.returnConfirm : S.detail.rejectConfirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogTitle>{S.detail.assignTitle}</DialogTitle>
          <label className="mb-1 block text-sm font-medium">{S.detail.assignSelect}</label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {maintainers.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </Select>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              {S.editor.cancel}
            </Button>
            <Button
              disabled={!assigneeId || busy}
              onClick={() => {
                setAssignOpen(false)
                void run(() => provider.assignRequest(req.id, assigneeId))
              }}
            >
              {S.detail.assign}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
