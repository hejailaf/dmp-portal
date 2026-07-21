import { useEffect, useRef, useState } from 'react'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import {
  ArrowRight,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { getProvider } from '@/data'
import { makeRequestExport } from '@/lib/excel-export'
import { appliesTo, OBJECT_TYPE_CONFIGS, type ObjectTypeConfig } from '@/domain/field-map'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_COUNT,
  COMMENT_MAX_LENGTH,
  isEmptyLine,
  validateAttachment,
} from '@/domain/schemas'
import { daysUntilDue, isOverdue } from '@/domain/sla'
import { availableTransitions, type TransitionCtx } from '@/domain/status'
import type { Attachment, AuditEvent, Request, RequestLine } from '@/domain/types'
import { formatDate, formatDateTime, formatDateValue } from '@/lib/utils'
import { useAsync } from '../hooks'
import { href } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { StatusStepper } from '../components/badges'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { Select, Textarea } from '../components/ui/input'
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
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-md border bg-card p-1 shadow-lg">
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
      <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
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
  Reopened: RotateCcw,
  CommentAdded: MessageSquare,
  AttachmentAdded: Paperclip,
}

/** "today, 7:32 PM" / "yesterday, 7:32 PM"; older entries keep the absolute form. */
function relativeDateTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return S.time.todayAt(time)
  if (d.toDateString() === yesterday.toDateString()) return S.time.yesterdayAt(time)
  return formatDateTime(iso)
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
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigneeId, setAssigneeId] = useState('')
  const [commentBody, setCommentBody] = useState('')

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

  if (detail.loading) return <p className="text-muted-foreground">{S.detail.loading}</p>
  if (detail.error) return <p className="text-destructive">{detail.error}</p>
  if (!detail.data) return <p className="text-destructive">{S.detail.notFound}</p>

  const { request: req, lines } = detail.data
  const ctx: TransitionCtx = {
    roles: user.roles,
    isOwner: req.requesterId === user.id,
    isAssignee: req.assigneeId === user.id,
  }
  const isAdmin = user.roles.includes('admin')
  const transitions = availableTransitions(ctx, req.status)
  const canEditDraft = req.status === 'Draft' && (ctx.isOwner || isAdmin)
  const canClaim =
    user.roles.includes('maintainer') && !req.assigneeId && req.status === 'Waiting to be started'
  const canAssign = isAdmin && (req.status === 'Waiting to be started' || req.status === 'In process')

  const doTransition = (to: Request['status']) => {
    if (to === 'Rejected') {
      setRejectReason('')
      setRejectOpen(true)
      return
    }
    if (to === 'Waiting to be started' && req.status === 'Draft') {
      void run(() => provider.submitRequest(req.id))
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

  // "Changed" = the newest audit entry: every update (edits, status moves,
  // comments, attachments) writes one, so it tracks true last activity
  const lastChangedAt = audit.data?.length ? audit.data[audit.data.length - 1].at : req.createdAt

  const doExport = async () => {
    setExporting(true)
    setBanner(undefined)
    try {
      const blob = await makeRequestExport(req, visibleLines)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${req.ref}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
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

  // one primary CTA per state; Export + the destructive Reject sit one
  // deliberate click away in the More menu (misclick-proofing Reject)
  const rejectTransition = transitions.find((t) => t.to === 'Rejected')
  const dueDays = req.dueDate ? daysUntilDue(req.dueDate) : 0
  const dueActive = !!req.dueDate && req.status !== 'Completed' && req.status !== 'Rejected'
  const stripLink = 'text-primary hover:underline'

  return (
    <div className="space-y-4">
      {banner && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm text-destructive">{banner}</p>
      )}
      {req.status === 'Rejected' && req.rejectReason && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm">
          <span className="font-semibold text-destructive">{S.detail.rejectReason}: </span>
          {req.rejectReason}
        </p>
      )}

      {/* document header (ux-experiments 2026-07-21): actions live IN the
          card on the ref row; the status pill grew into a lifecycle stepper;
          due date carries its countdown inline */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {req.description ? (
              <span className="text-sm font-medium tracking-wide text-muted-foreground">{req.ref}</span>
            ) : (
              <h1 className="text-2xl font-semibold text-secondary-foreground">{req.ref}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {canEditDraft && (
                <a href={href(`/requests/${req.id}/edit`)}>
                  <Button variant="outline">
                    <Pencil className="h-4 w-4" /> {S.detail.editDraft}
                  </Button>
                </a>
              )}
              {canAssign && (
                <Button variant="outline" disabled={busy} onClick={openAssign}>
                  {req.assigneeId ? S.detail.reassign : S.detail.assign}
                </Button>
              )}
              {canClaim && (
                <Button disabled={busy} onClick={() => void run(() => provider.assignRequest(req.id, user.id))}>
                  {S.detail.claim}
                </Button>
              )}
              {transitions
                .filter((t) => t.to !== 'Rejected')
                .map((t) => (
                  <Button key={t.to} disabled={busy} onClick={() => doTransition(t.to)}>
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
              className="mt-1.5 truncate text-[21px] font-semibold leading-snug text-secondary-foreground"
              title={req.description}
            >
              {req.description}
            </h1>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusStepper status={req.status} />
            {req.lineSummary && (
              <span className="ml-auto inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {req.lineSummary}
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
                <span
                  className={
                    isOverdue(req)
                      ? 'text-destructive'
                      : dueDays <= 1
                        ? 'text-[var(--warning)]'
                        : 'text-muted-foreground'
                  }
                >
                  {' '}
                  · {isOverdue(req) ? S.sla.overdue(-dueDays) : dueDays <= 0 ? S.sla.dueToday : S.sla.dueIn(dueDays)}
                </span>
              )}
            </StripItem>
          </div>
        </CardContent>
      </Card>

      {/* line items */}
      <Card>
        <CardHeader>
          <CardTitle>{S.detail.linesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {groups.length === 0 && <p className="text-sm text-muted-foreground">{S.detail.noLines}</p>}
          {groups.map(({ cfg, lines: groupLines }) => (
            <div key={cfg.objectType}>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{cfg.label}</h4>
              <DetailLineGrid config={cfg} lines={groupLines} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* activity — one card, three tabs (browser-tab styling shared with the editor) */}
      <Card>
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
                  placeholder={S.detail.commentPlaceholder}
                  maxLength={COMMENT_MAX_LENGTH}
                />
                <Button
                  size="sm"
                  disabled={busy || !commentBody.trim()}
                  onClick={() =>
                    void run(async () => {
                      await provider.addComment(req.id, commentBody)
                      setCommentBody('')
                      comments.reload()
                    })
                  }
                >
                  {S.detail.commentAdd}
                </Button>
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
                            ({a.oldValue} → {a.newValue})
                          </span>
                        )}
                        {!a.oldValue && a.newValue && (
                          <span className="text-muted-foreground"> ({a.newValue})</span>
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

      {/* reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogTitle>{S.detail.rejectTitle}</DialogTitle>
          <label className="mb-1 block text-sm font-medium">{S.detail.rejectReasonLabel}</label>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              {S.editor.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || busy}
              onClick={() => {
                setRejectOpen(false)
                void run(() => provider.rejectRequest(req.id, rejectReason))
              }}
            >
              {S.detail.rejectConfirm}
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
