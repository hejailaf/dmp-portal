import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type HeaderContext,
} from '@tanstack/react-table'
import { CalendarDays, Copy, Download, Plus, Trash2, Upload } from 'lucide-react'
import { getProvider, type DraftLineInput } from '@/data'
import {
  appliesTo,
  applyDerivations,
  isRequired,
  OBJECT_TYPE_CONFIGS,
  type ObjectTypeConfig,
} from '@/domain/field-map'
import { isEmptyLine, validateForSubmit, validateLine, type LineValidation } from '@/domain/schemas'
import { makeTemplate, parseTemplate } from '@/lib/excel-lines'
import { LINE_ACTIONS, type LineAction, type ObjectType, type RequestLine } from '@/domain/types'
import { cn, formatDateValue } from '@/lib/utils'
import { useAsync } from '../hooks'
import { navigate } from '../router'
import { S } from '../strings'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input, Select } from '../components/ui/input'
import { autoColumnSize, DataGrid, measureCellWidth, usePersistedColumnSizing } from '../components/DataGrid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

// The AIW work-package editor (spec §6): one request, line items across all
// four object types at once, each line with its own action. Fields shown and
// required per line come entirely from the domain field map.

interface EditorLine {
  key: string
  objectType: ObjectType
  action: LineAction
  fieldData: Record<string, string>
}

type ErrorsByLine = Record<string, LineValidation>

const columnHelper = createColumnHelper<EditorLine>()

// Cell renderers MUST be stable module-level components: column defs are
// rebuilt on every keystroke (auto-fit widths), and a freshly created cell
// function would be a new component type to React — remounting the <input>
// and dropping focus mid-typing. Everything dynamic reaches the cells via
// table.options.meta instead of closures.
interface EditorMeta {
  config: ObjectTypeConfig
  errors: ErrorsByLine
  onChange: (key: string, patch: Partial<EditorLine>) => void
  selected: ReadonlySet<string>
  onToggleSelect: (key: string) => void
  onToggleAll: (keys: string[], select: boolean) => void
}

type EditorCell = CellContext<EditorLine, unknown>
const editorMeta = (info: EditorCell) => info.table.options.meta as EditorMeta

// Flat, Excel-like in-grid fields: the cell border IS the field border. Focus
// and errors are shown with inset rings since there is no input border left.
const flatField =
  'h-8 w-full rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'

function LineNoCell(info: EditorCell) {
  return <span className="block px-2 text-muted-foreground">{info.row.index + 1}</span>
}

function ActionCell(info: EditorCell) {
  const { config, onChange } = editorMeta(info)
  const line = info.row.original
  return (
    <Select
      value={line.action}
      onChange={(e) => onChange(line.key, { action: e.target.value as LineAction })}
      className={flatField}
    >
      {(config.actions ?? LINE_ACTIONS).map((a) => (
        <option key={a} value={a}>
          {config.actionLabels[a]}
        </option>
      ))}
    </Select>
  )
}

function FieldCell(info: EditorCell) {
  // Excel-like focus overlay: while a text cell with clipped content is
  // focused, the input floats above the grid at full content width.
  const [focused, setFocused] = useState(false)
  const nativeDateRef = useRef<HTMLInputElement>(null)
  const { config, errors, onChange } = editorMeta(info)
  const field = config.fields.find((f) => f.key === info.column.id)
  const line = info.row.original
  if (!field) return null
  if (!appliesTo(field, line.action)) {
    return (
      <div className="flex h-8 w-full items-center bg-muted px-2 text-xs text-muted-foreground">
        {S.editor.notApplicable}
      </div>
    )
  }
  const error = errors[line.key]?.fieldErrors[field.key]
  const value = line.fieldData[field.key] ?? ''
  // amber = mandatory for THIS line's action and still empty (exact, per
  // cell — the header * is only the column-level summary); red = invalid
  const needed = isRequired(field, line.action) && !value.trim()
  const common = {
    value,
    title: error,
    className: cn(
      flatField,
      needed && !error && 'bg-amber-50 ring-1 ring-inset ring-amber-200',
      error && 'bg-red-50 ring-1 ring-inset ring-destructive',
    ),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      // number fields hard-stop non-digits (typed or pasted); Zod stays the backstop
      const next = field.input === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value
      onChange(line.key, { fieldData: { ...line.fieldData, [field.key]: next } })
    },
  }
  if (field.input === 'choice') {
    return (
      <Select {...common}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    )
  }
  if (field.input === 'date') {
    // US-formatted text entry (native date inputs display per browser locale,
    // which code cannot override) + a button that opens the native picker.
    // Storage stays ISO; only the visible text is MM/DD/YYYY.
    const storeDate = (raw: string) => {
      const cleaned = raw.replace(/[^\d/]/g, '')
      const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned)
      const stored = us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : cleaned
      onChange(line.key, { fieldData: { ...line.fieldData, [field.key]: stored } })
    }
    return (
      <div className="relative h-8">
        <Input
          {...common}
          value={formatDateValue(value)}
          onChange={(e) => storeDate(e.target.value)}
          maxLength={10}
          placeholder="MM/DD/YYYY"
          className={cn(common.className, 'pr-7')}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${field.label} calendar`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            const el = nativeDateRef.current
            if (!el) return
            try {
              el.showPicker()
            } catch {
              el.click()
            }
          }}
        >
          <CalendarDays className="h-4 w-4" />
        </button>
        <input
          ref={nativeDateRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
          onChange={(e) => onChange(line.key, { fieldData: { ...line.fieldData, [field.key]: e.target.value } })}
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        />
      </div>
    )
  }
  const contentWidth = focused ? measureCellWidth(value) : 0
  const floating = contentWidth > info.column.getSize()
  return (
    <div className="relative h-8">
      <Input
        {...common}
        className={cn(
          common.className,
          // the floating editor needs its frame back — it sits above other cells
          floating && 'absolute left-0 top-0 z-30 rounded-md border border-ring bg-card shadow-lg',
        )}
        style={floating ? { width: Math.min(contentWidth, 480), minWidth: '100%' } : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        type="text"
        inputMode={field.input === 'number' ? 'decimal' : undefined}
        maxLength={field.maxLength}
        placeholder={field.label}
      />
    </div>
  )
}

const checkboxClass = 'h-4 w-4 accent-primary'

function SelectCell(info: EditorCell) {
  const { selected, onToggleSelect } = editorMeta(info)
  const key = info.row.original.key
  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        className={checkboxClass}
        checked={selected.has(key)}
        onChange={() => onToggleSelect(key)}
        aria-label={S.editor.selectLine}
      />
    </div>
  )
}

function SelectAllCell(info: HeaderContext<EditorLine, unknown>) {
  const { selected, onToggleAll } = info.table.options.meta as EditorMeta
  const keys = info.table.getRowModel().rows.map((r) => r.original.key)
  const selectedCount = keys.filter((k) => selected.has(k)).length
  const all = keys.length > 0 && selectedCount === keys.length
  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        className={checkboxClass}
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = selectedCount > 0 && !all
        }}
        onChange={() => onToggleAll(keys, !all)}
        aria-label={S.editor.selectAll}
      />
    </div>
  )
}

function EditorGrid({
  config,
  lines,
  errors,
  onChange,
  selected,
  onToggleSelect,
  onToggleAll,
}: {
  config: ObjectTypeConfig
  lines: EditorLine[]
  errors: ErrorsByLine
  onChange: (key: string, patch: Partial<EditorLine>) => void
  selected: ReadonlySet<string>
  onToggleSelect: (key: string) => void
  onToggleAll: (keys: string[], select: boolean) => void
}) {
  // auto-fit: header width by default, growing live with the longest typed
  // value (lines change on every keystroke), capped in autoColumnSize
  const autoSizes = useMemo(() => {
    const sizes: Record<string, number> = {
      action: autoColumnSize(
        S.editor.action,
        (config.actions ?? LINE_ACTIONS).map((a) => config.actionLabels[a]),
        { select: true },
      ),
    }
    for (const field of config.fields) {
      if (field.derived) continue // derived fields are hidden in the editor
      sizes[field.key] = autoColumnSize(
        field.label,
        lines.map((l) => l.fieldData[field.key] ?? ''),
        // date pickers have a fixed intrinsic widget width
        { select: field.input === 'choice', floor: field.input === 'date' ? 150 : undefined },
      )
    }
    return sizes
  }, [config, lines])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: SelectAllCell,
        size: 36,
        minSize: 36,
        enableResizing: false,
        cell: SelectCell,
      }),
      columnHelper.display({
        id: 'no',
        header: S.editor.lineNo,
        size: 40,
        minSize: 40,
        enableResizing: false,
        cell: LineNoCell,
      }),
      columnHelper.display({
        id: 'action',
        header: S.editor.action,
        size: autoSizes.action,
        cell: ActionCell,
      }),
      ...config.fields
        .filter((field) => !field.derived)
        .map((field) =>
          columnHelper.display({
            id: field.key,
            header: field.label,
            size: autoSizes[field.key],
            cell: FieldCell,
          }),
        ),
    ],
    [config, autoSizes],
  )

  // auto-hide: a field column renders only if it applies to ≥1 action present among this tab's lines
  const columnVisibility = useMemo(() => {
    const present = new Set(lines.map((l) => l.action))
    const visibility: Record<string, boolean> = {}
    for (const field of config.fields) {
      if (field.derived) continue
      visibility[field.key] = [...present].some((a) => appliesTo(field, a))
    }
    return visibility
  }, [lines, config])

  const sizing = usePersistedColumnSizing(`editor-${config.objectType}`)
  const table = useReactTable({
    data: lines,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (l) => l.key,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
    state: { columnSizing: sizing.columnSizing, columnVisibility },
    onColumnSizingChange: sizing.onColumnSizingChange,
    meta: { config, errors, onChange, selected, onToggleSelect, onToggleAll } satisfies EditorMeta,
  })

  const tabErrors = lines
    .flatMap((l, i) => {
      const v = errors[l.key]
      if (!v || v.ok) return []
      const msgs = [...v.lineErrors, ...Object.values(v.fieldErrors)]
      return msgs.map((m) => S.editor.lineError(config.label, i + 1, m))
    })

  return (
    <div className="space-y-3">
      {tabErrors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-red-50 p-3 text-sm text-destructive">
          <div className="font-medium">{S.editor.lineErrorsTitle}</div>
          <ul className="mt-1 list-inside list-disc">
            {tabErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {lines.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{S.editor.noLines}</p>
      ) : (
        <DataGrid table={table} rowClassName="hover:bg-transparent" cellClassName="p-0" />
      )}
    </div>
  )
}

export function RequestEditorPage({ requestId }: { requestId?: string }) {
  const provider = getProvider()
  const [lines, setLines] = useState<EditorLine[]>([])
  const [errors, setErrors] = useState<ErrorsByLine>({})
  const [requestErrors, setRequestErrors] = useState<string[]>([])
  const [busy, setBusy] = useState<'save' | 'submit'>()
  const [banner, setBanner] = useState<string>()
  const [initialized, setInitialized] = useState(!requestId)
  const [tab, setTab] = useState<ObjectType>('EQUIPMENT')
  const [importNotes, setImportNotes] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importTarget = useRef<ObjectTypeConfig>()

  const existing = useAsync(
    async () => (requestId ? provider.getRequest(requestId) : undefined),
    [requestId],
  )

  useEffect(() => {
    if (requestId && existing.data && !initialized) {
      setLines(
        existing.data.lines.map((l) => ({
          key: l.id,
          objectType: l.objectType,
          action: l.action,
          fieldData: { ...l.fieldData },
        })),
      )
      setInitialized(true)
    }
  }, [requestId, existing.data, initialized])

  if (requestId && existing.loading) return <p className="text-muted-foreground">{S.detail.loading}</p>
  if (requestId && existing.error) return <p className="text-destructive">{existing.error}</p>
  if (requestId && existing.data && existing.data.request.status !== 'Draft')
    return <p className="text-destructive">{S.editor.editTitle(existing.data.request.ref)}: not a draft.</p>

  const update = (key: string, patch: Partial<EditorLine>) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
        // derived fields (e.g. equipment classification) follow their source field
        if (patch.fieldData) next.fieldData = applyDerivations(next.objectType, next.fieldData)
        return next
      }),
    )
  const addLine = (objectType: ObjectType) =>
    setLines((ls) => [...ls, { key: crypto.randomUUID(), objectType, action: 'ADD', fieldData: {} }])

  // checkbox selection drives the per-tab Duplicate/Delete toolbar buttons
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const toggleSelect = (key: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const toggleAll = (keys: string[], select: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const k of keys) if (select) next.add(k)
      if (!select) for (const k of keys) next.delete(k)
      return next
    })
  const selectedKeysInTab = (objectType: ObjectType) =>
    new Set(lines.filter((l) => l.objectType === objectType && selected.has(l.key)).map((l) => l.key))

  const duplicateSelected = (objectType: ObjectType) => {
    const dup = selectedKeysInTab(objectType)
    if (dup.size === 0) return
    // each copy lands directly after its original, Excel-style
    setLines((ls) =>
      ls.flatMap((l) =>
        dup.has(l.key) ? [l, { ...l, key: crypto.randomUUID(), fieldData: { ...l.fieldData } }] : [l],
      ),
    )
    setSelected((s) => new Set([...s].filter((k) => !dup.has(k))))
  }

  const deleteSelected = (objectType: ObjectType) => {
    const doomed = selectedKeysInTab(objectType)
    if (doomed.size === 0) return
    setLines((ls) => ls.filter((l) => !doomed.has(l.key)))
    setSelected((s) => new Set([...s].filter((k) => !doomed.has(k))))
  }

  const downloadTemplate = async (cfg: ObjectTypeConfig) => {
    const blob = await makeTemplate(cfg)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DMP-${cfg.label.replace(/\s+/g, '-')}-template.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (cfg: ObjectTypeConfig, file: File) => {
    setBanner(undefined)
    try {
      const result = await parseTemplate(cfg, await file.arrayBuffer())
      const imported: EditorLine[] = result.lines.map((l) => ({ ...l, key: crypto.randomUUID() }))
      setLines((ls) => [...ls, ...imported])
      // validate immediately so problem cells light up without waiting for submit
      const newErrors: ErrorsByLine = {}
      for (const l of imported) {
        const v = validateLine(l)
        if (!v.ok) newErrors[l.key] = v
      }
      setErrors((e) => ({ ...e, ...newErrors }))
      setImportNotes([
        imported.length ? S.editor.imported(imported.length) : S.editor.importNothing,
        ...result.errors,
      ])
    } catch (e) {
      setImportNotes([e instanceof Error ? e.message : String(e)])
    }
  }

  const toInputs = (ls: EditorLine[]): DraftLineInput[] =>
    ls.map((l, i) => ({ objectType: l.objectType, action: l.action, order: i + 1, fieldData: l.fieldData }))

  const toDomainLines = (ls: EditorLine[]): RequestLine[] =>
    ls.map((l, i) => ({ id: l.key, requestId: requestId ?? 'new', order: i + 1, ...l }))

  const saveDraft = async (ls: EditorLine[]): Promise<string> => {
    if (requestId) {
      await provider.updateDraft(requestId, toInputs(ls))
      return requestId
    }
    const req = await provider.createRequest(toInputs(ls))
    return req.id
  }

  const onSave = async () => {
    setBusy('save')
    setBanner(undefined)
    try {
      // drafts keep scratch rows — only submit prunes
      const id = await saveDraft(lines)
      navigate(`/requests/${id}`)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  const onSubmit = async () => {
    setBanner(undefined)
    // untouched lines are dropped silently instead of raising validation errors
    const kept = lines.filter((l) => !isEmptyLine(l))
    if (kept.length !== lines.length) setLines(kept)
    const validation = validateForSubmit(toDomainLines(kept))
    setErrors(validation.lineResults)
    setRequestErrors(validation.requestErrors)
    if (!validation.ok) {
      // jump to the first tab that has a problem
      const firstBad = kept.find((l) => validation.lineResults[l.key] && !validation.lineResults[l.key].ok)
      if (firstBad) setTab(firstBad.objectType)
      return
    }
    setBusy('submit')
    try {
      const id = await saveDraft(kept)
      await provider.submitRequest(id)
      navigate(`/requests/${id}`)
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  const title = requestId && existing.data ? S.editor.editTitle(existing.data.request.ref) : S.editor.newTitle

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{S.editor.requiredHint}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => window.history.back()}>
            {S.editor.cancel}
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void onSave()}>
            {busy === 'save' ? S.editor.saving : S.editor.saveDraft}
          </Button>
          <Button disabled={!!busy || lines.length === 0} onClick={() => void onSubmit()}>
            {busy === 'submit' ? S.editor.submitting : S.editor.submit}
          </Button>
        </div>
      </div>

      {banner && <p className="rounded-md border border-destructive/40 bg-red-50 p-3 text-sm text-destructive">{banner}</p>}
      {requestErrors.map((e, i) => (
        <p key={i} className="rounded-md border border-destructive/40 bg-red-50 p-3 text-sm text-destructive">
          {e}
        </p>
      ))}
      {importNotes.length > 0 && (
        <div className="rounded-md border bg-accent/50 p-3 text-sm">
          {importNotes.map((n, i) => (
            <p key={i} className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>
              {i === 1 && <span className="font-medium">{S.editor.importIssuesTitle} </span>}
              {n}
            </p>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const cfg = importTarget.current
          e.target.value = '' // allow re-importing the same file
          if (file && cfg) void importFile(cfg, file)
        }}
      />

      <Card>
        <CardContent className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ObjectType)}>
            <TabsList>
              {OBJECT_TYPE_CONFIGS.map((cfg) => {
                const count = lines.filter((l) => l.objectType === cfg.objectType).length
                const hasError = lines.some(
                  (l) => l.objectType === cfg.objectType && errors[l.key] && !errors[l.key].ok,
                )
                return (
                  <TabsTrigger key={cfg.objectType} value={cfg.objectType}>
                    {cfg.label}
                    {count > 0 && <span className="ml-1 text-xs text-muted-foreground">{S.editor.tabCount(count)}</span>}
                    {hasError && <span className="ml-1 h-2 w-2 rounded-full bg-destructive" />}
                  </TabsTrigger>
                )
              })}
            </TabsList>
            {OBJECT_TYPE_CONFIGS.map((cfg) => {
              const tabSelected = selectedKeysInTab(cfg.objectType).size
              return (
              <TabsContent key={cfg.objectType} value={cfg.objectType}>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => addLine(cfg.objectType)}>
                    <Plus className="h-4 w-4" /> {S.editor.addLine}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tabSelected === 0}
                    onClick={() => duplicateSelected(cfg.objectType)}
                  >
                    <Copy className="h-4 w-4" /> {S.editor.duplicate(tabSelected)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tabSelected === 0}
                    onClick={() => deleteSelected(cfg.objectType)}
                  >
                    <Trash2 className="h-4 w-4" /> {S.editor.deleteLines(tabSelected)}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void downloadTemplate(cfg)}>
                    <Download className="h-4 w-4" /> {S.editor.downloadTemplate}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      importTarget.current = cfg
                      fileInputRef.current?.click()
                    }}
                  >
                    <Upload className="h-4 w-4" /> {S.editor.importExcel}
                  </Button>
                </div>
                <EditorGrid
                  config={cfg}
                  lines={lines.filter((l) => l.objectType === cfg.objectType)}
                  errors={errors}
                  onChange={update}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAll}
                />
              </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
