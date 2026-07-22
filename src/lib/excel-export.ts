import type { Request, RequestLine } from '@/domain/types'
import { appliesTo, isRequired, OBJECT_TYPE_CONFIGS, parseLineSummary } from '@/domain/field-map'
import { formatDate, formatDateTime } from './utils'
import { AMBER, excel } from './excel-lines'

// Phase-3 Excel export (spec §6): a read artifact for keying into SAP MDG —
// Summary sheet + one grid sheet per object type present in the request.
// Unlike the entry template, derived fields ARE included and there are no
// dropdowns/protection/conditional formatting. Amber = mandatory for that
// row's action; grey = not applicable (identifiers are never greyed).

const GREY = 'FFE9E9E9'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })

export async function makeRequestExport(req: Request, lines: RequestLine[]): Promise<Blob> {
  const ExcelJS = await excel()
  const wb = new ExcelJS.Workbook()

  // Summary sheet — label/value rows for the request header
  const summary = wb.addWorksheet('Summary')
  const rows: Array<[string, string]> = [
    ['Ref', req.ref],
    ['Description', req.description],
    ['Status', req.status],
    ['Requester', req.requesterName],
    ['Assignee', req.assigneeName ?? ''],
    ['Created', formatDateTime(req.createdAt)],
    ['Submitted', req.submittedAt ? formatDateTime(req.submittedAt) : ''],
    ['Due date', req.dueDate ? formatDate(req.dueDate) : ''],
    ['SLA days', req.slaDays != null ? String(req.slaDays) : ''],
    ['Completed', req.completedAt ? formatDateTime(req.completedAt) : ''],
    ['Line summary', req.lineSummary],
    ...(req.rejectReason ? ([['Reject reason', req.rejectReason]] as Array<[string, string]>) : []),
    ['Exported at', formatDateTime(new Date().toISOString())],
  ]
  for (const [label, value] of rows) {
    const r = summary.addRow([label, value])
    r.getCell(1).font = { bold: true }
  }
  summary.getColumn(1).width = 16
  summary.getColumn(2).width = Math.max(24, ...rows.map(([, v]) => v.length + 2))

  // One grid sheet per object type present, in config (editor tab) order
  for (const cfg of OBJECT_TYPE_CONFIGS) {
    const typeLines = lines.filter((l) => l.objectType === cfg.objectType)
    if (typeLines.length === 0) continue
    const ws = wb.addWorksheet(cfg.label)

    const header = ws.addRow(['#', 'Action', ...cfg.fields.map((f) => f.label)])
    header.font = { bold: true }

    for (const [i, line] of typeLines.entries()) {
      const row = ws.addRow([
        i + 1,
        cfg.actionLabels[line.action],
        ...cfg.fields.map((f) => {
          // never print a value the action doesn't use, even if one somehow
          // reached storage — this sheet is keyed into SAP, so it defends
          // itself rather than trusting the read-boundary normalization
          if (!appliesTo(f, line.action)) return ''
          const v = line.fieldData[f.key] ?? ''
          if (f.input === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            // real Date via UTC so the stored calendar day never shifts
            const [y, m, d] = v.split('-').map(Number)
            return new Date(Date.UTC(y, m - 1, d))
          }
          return v
        }),
      ])
      cfg.fields.forEach((f, c) => {
        const cell = row.getCell(c + 3)
        if (!appliesTo(f, line.action)) {
          // line data is normalized on read, so such a cell is always empty —
          // grey it like any other inapplicable cell (identifiers included: an
          // ungreyed blank would read as "you still need to fill this in")
          cell.fill = fill(GREY)
        } else if (isRequired(f, line.action)) {
          cell.fill = fill(AMBER)
        }
      })
    }

    ws.getColumn(1).width = 5
    ws.getColumn(2).width = Math.max(10, ...typeLines.map((l) => cfg.actionLabels[l.action].length + 2))
    cfg.fields.forEach((f, i) => {
      const col = ws.getColumn(i + 3)
      const valueLengths = typeLines.map((l) =>
        appliesTo(f, l.action) ? (l.fieldData[f.key] ?? '').length + 2 : 0,
      )
      col.width = Math.min(50, Math.max(12, f.label.length + 3, ...valueLengths))
      if (f.input === 'date') col.numFmt = 'mm/dd/yyyy'
    })
  }

  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME })
}

/**
 * List-page export: one sheet, one row per request, exactly what the
 * filtered table shows plus the useful dates. Stored status names on
 * purpose — this is a report, not a per-viewer UI surface.
 */
export async function makeRequestListExport(requests: Request[], title: string): Promise<Blob> {
  const ExcelJS = await excel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(title.slice(0, 31) || 'Requests') // sheet names cap at 31 chars

  const header = ws.addRow([
    'Ref',
    'Description',
    'Status',
    'Req. Type',
    'Line items',
    'Requester',
    'Assignee',
    'Submitted',
    'Due date',
    'Completed',
    'Line summary',
  ])
  header.font = { bold: true }

  for (const r of requests) {
    const { types, total } = parseLineSummary(r.lineSummary)
    ws.addRow([
      r.ref,
      r.description,
      r.status,
      types.length > 1 ? 'Multiple' : (types[0] ?? ''),
      total,
      r.requesterName,
      r.assigneeName ?? '',
      r.submittedAt ? formatDateTime(r.submittedAt) : '',
      r.dueDate ? formatDate(r.dueDate) : '',
      r.completedAt ? formatDateTime(r.completedAt) : '',
      r.lineSummary,
    ])
  }

  const widths = [11, 40, 22, 20, 10, 20, 20, 18, 12, 18, 40]
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })

  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME })
}
