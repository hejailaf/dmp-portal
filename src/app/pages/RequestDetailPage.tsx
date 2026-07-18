import { useRef, useState } from 'react'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { FileSpreadsheet, Paperclip, Pencil } from 'lucide-react'
import { getProvider } from '@/data'
import { makeRequestExport } from '@/lib/excel-export'
import { appliesTo, OBJECT_TYPE_CONFIGS, type ObjectTypeConfig } from '@/domain/field-map'
import { isEmptyLine } from '@/domain/schemas'
import { availableTransitions, type TransitionCtx } from '@/domain/status'
import type { Request, RequestLine } from '@/domain/types'
import { formatDate, formatDateTime, formatDateValue } from '@/lib/utils'
import { useAsync } from '../hooks'
import { href } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { SlaBadge, StatusBadge } from '../components/badges'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { Select, Textarea } from '../components/ui/input'
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
  return <DataGrid table={table} />
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  )
}

function AttachmentsCard({ requestId, onAdded }: { requestId: string; onAdded: () => void }) {
  const provider = getProvider()
  const attachments = useAsync(() => provider.listAttachments(requestId), [requestId])
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>()

  const upload = async (file: File) => {
    setUploading(true)
    setError(undefined)
    try {
      await provider.addAttachment(requestId, file)
      attachments.reload()
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{S.detail.attachmentsTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attachments.loading && <p className="text-sm text-muted-foreground">{S.detail.loading}</p>}
        {attachments.error && <p className="text-sm text-destructive">{attachments.error}</p>}
        {attachments.data &&
          (attachments.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{S.detail.attachmentsEmpty}</p>
          ) : (
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
                    <span className="flex-none text-xs text-muted-foreground">
                      {Math.max(1, Math.round(a.size / 1024))} KB
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // allow re-picking the same file
            if (file) void upload(file)
          }}
        />
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4" /> {uploading ? S.detail.attachmentUploading : S.detail.attachmentAdd}
        </Button>
      </CardContent>
    </Card>
  )
}

export function RequestDetailPage({ id }: { id: string }) {
  const user = useCurrentUser()
  const provider = getProvider()
  const detail = useAsync(() => provider.getRequest(id), [id])
  const comments = useAsync(() => provider.listComments(id), [id])
  const audit = useAsync(() => provider.listAudit(id), [id])
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

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{req.ref}</h1>
            <StatusBadge status={req.status} />
            <SlaBadge request={req} />
          </div>
          {req.description && <p className="mt-1 max-w-3xl text-sm">{req.description}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{req.lineSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={exporting || visibleLines.length === 0}
            onClick={() =>
              void (async () => {
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
              })()
            }
          >
            <FileSpreadsheet className="h-4 w-4" /> {exporting ? S.detail.exporting : S.detail.exportExcel}
          </Button>
          {canEditDraft && (
            <a href={href(`/requests/${req.id}/edit`)}>
              <Button variant="outline">
                <Pencil className="h-4 w-4" /> {S.detail.editDraft}
              </Button>
            </a>
          )}
          {canClaim && (
            <Button disabled={busy} onClick={() => void run(() => provider.assignRequest(req.id, user.id))}>
              {S.detail.claim}
            </Button>
          )}
          {canAssign && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setAssigneeId(req.assigneeId ?? maintainers.data?.[0]?.id ?? '')
                setAssignOpen(true)
              }}
            >
              {req.assigneeId ? S.detail.reassign : S.detail.assign}
            </Button>
          )}
          {transitions.map((t) => (
            <Button
              key={t.to}
              disabled={busy}
              variant={t.to === 'Rejected' ? 'destructive' : 'default'}
              onClick={() => doTransition(t.to)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {banner && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm text-destructive">{banner}</p>
      )}
      {req.status === 'Rejected' && req.rejectReason && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm">
          <span className="font-semibold text-destructive">{S.detail.rejectReason}: </span>
          {req.rejectReason}
        </p>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-6">
          <Meta label={S.detail.requester}>{req.requesterName}</Meta>
          <Meta label={S.detail.assignee}>
            {req.assigneeName ?? <span className="text-muted-foreground">{S.detail.unassigned}</span>}
          </Meta>
          <Meta label={S.detail.createdAt}>{formatDate(req.createdAt)}</Meta>
          <Meta label={S.detail.submittedAt}>{formatDate(req.submittedAt)}</Meta>
          <Meta label={S.detail.dueDate}>{formatDate(req.dueDate)}</Meta>
          <Meta label={S.detail.slaDays}>{req.slaDays ?? '—'}</Meta>
          {req.completedAt && <Meta label={S.detail.completedAt}>{formatDate(req.completedAt)}</Meta>}
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* comments */}
        <Card>
          <CardHeader>
            <CardTitle>{S.detail.commentsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">{S.detail.noComments}</p>}
            {comments.data?.map((c) => (
              <div key={c.id} className="rounded-md bg-muted/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{c.authorName}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            ))}
            <div className="space-y-2 pt-1">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={S.detail.commentPlaceholder}
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
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* audit timeline */}
          <Card>
            <CardHeader>
              <CardTitle>{S.detail.auditTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0 border-l pl-4">
                {audit.data?.map((a) => (
                  <li key={a.id} className="relative pb-3 text-sm">
                    <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                    <span className="font-medium">{a.actorName}</span> {S.audit[a.event]}
                    {a.oldValue && a.newValue && (
                      <span className="text-muted-foreground">
                        {' '}
                        ({a.oldValue} → {a.newValue})
                      </span>
                    )}
                    {!a.oldValue && a.newValue && <span className="text-muted-foreground"> ({a.newValue})</span>}
                    <div className="text-xs text-muted-foreground">{formatDateTime(a.at)}</div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <AttachmentsCard requestId={req.id} onAdded={() => audit.reload()} />
        </div>
      </div>

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
