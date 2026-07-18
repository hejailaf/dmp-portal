import { useEffect, useRef, useState } from 'react'
import {
  flexRender,
  type ColumnSizingState,
  type OnChangeFn,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

// The one place all three grids (request list, editor tabs, detail line
// grids) render their table markup: Excel-like gridlines, drag-resizable
// columns (TanStack built-in sizing), double-click a handle to reset,
// widths persisted per grid in localStorage.

// ── auto-fit sizing ─────────────────────────────────────────────────────────
// A column's width defaults to its header text and grows with the longest
// cell value, capped. Tune the cap here. Manual drags (columnSizing state)
// always override these computed defaults.
const HEADER_FONT = "600 12px 'Segoe UI', system-ui, sans-serif" // th: text-xs font-semibold uppercase
const CELL_FONT = "14px 'Segoe UI', system-ui, sans-serif" // td/input: text-sm
const HEADER_PAD = 22 // th padding + resize handle
const CELL_PAD = 26 // input padding + cell padding + borders
const SELECT_ARROW = 20
const MIN_WIDTH = 60
const MAX_WIDTH = 300

let measureCtx: CanvasRenderingContext2D | null | undefined
function measure(text: string, font: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * 8 // canvas unavailable — rough fallback
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

/** Width that fits the header and the longest current value, clamped to [MIN, MAX] (or a custom floor, e.g. date pickers). */
export function autoColumnSize(
  headerLabel: string,
  values: Iterable<string>,
  opts: { select?: boolean; floor?: number } = {},
): number {
  let width = measure(headerLabel.toUpperCase(), HEADER_FONT) + HEADER_PAD
  const extra = opts.select ? SELECT_ARROW : 0
  for (const v of values) {
    if (v) width = Math.max(width, measure(v, CELL_FONT) + CELL_PAD + extra)
  }
  return Math.round(Math.min(Math.max(width, opts.floor ?? MIN_WIDTH), MAX_WIDTH))
}

/** columnSizing state wired to localStorage — spread into useReactTable. */
export function usePersistedColumnSizing(storageKey: string): {
  columnSizing: ColumnSizingState
  onColumnSizingChange: OnChangeFn<ColumnSizingState>
} {
  const key = `dmp-colw-${storageKey}`
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '{}') as ColumnSizingState
    } catch {
      return {}
    }
  })
  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    setColumnSizing((old) => {
      const next = typeof updater === 'function' ? updater(old) : updater
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }
  return { columnSizing, onColumnSizingChange }
}

export function DataGrid<T>({
  table,
  rowClassName,
  cellClassName,
}: {
  table: TanstackTable<T>
  rowClassName?: string
  /** extra classes for every body cell (the editor passes p-0 so inputs fill cells edge-to-edge) */
  cellClassName?: string
}) {
  return (
    // minWidth + w-full + a width-less filler column: real columns keep their
    // exact pixel widths (Excel feel — dragging never re-shares space among
    // them); the filler absorbs whatever is left on wide screens, continuing
    // the header band and row lines to the card edge. When columns exceed the
    // container the filler collapses to 0 and the table scrolls.
    <Table className="table-fixed" style={{ minWidth: table.getTotalSize() }}>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="hover:bg-transparent">
            {hg.headers.map((h) => (
              <TableHead key={h.id} style={{ width: h.getSize() }} className="relative">
                <div className="truncate pr-1">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </div>
                {h.column.getCanResize() && (
                  <div
                    onMouseDown={h.getResizeHandler()}
                    onTouchStart={h.getResizeHandler()}
                    onDoubleClick={() => h.column.resetSize()}
                    className={cn(
                      'absolute right-0 top-0 z-10 h-full w-[5px] cursor-col-resize touch-none select-none',
                      h.column.getIsResizing() ? 'bg-primary' : 'hover:bg-primary/40',
                    )}
                  />
                )}
              </TableHead>
            ))}
            <th aria-hidden className="border-b bg-muted p-0" />
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className={rowClassName}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className={cellClassName}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
            <td aria-hidden className="border-b p-0" />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Rendered width of a value in the standard cell font — used by the editor's focus overlay. */
export function measureCellWidth(text: string): number {
  return Math.ceil(measure(text, CELL_FONT)) + CELL_PAD
}

/**
 * Read-only cell content that clips like Excel instead of wrapping.
 * Hover shows the native tooltip; CLICKING a clipped cell pops the full text
 * over the grid (dismissed by clicking anywhere else).
 */
export function ClippedCell({ value, className }: { value: string; className?: string }) {
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

  const toggle = () => {
    const text = ref.current?.firstElementChild as HTMLElement | null
    if (!open && text && text.scrollWidth <= text.clientWidth) return // nothing hidden — no popover
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative" onClick={toggle}>
      <div className={cn('truncate', className)} title={value}>
        {value || '—'}
      </div>
      {open && (
        <div className="absolute left-0 top-0 z-30 w-max max-w-[400px] whitespace-normal break-words rounded-md border bg-card p-2 text-sm shadow-lg">
          {value}
        </div>
      )}
    </div>
  )
}
