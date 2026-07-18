import type { Request, RequestLine } from '@/domain/types'
import { appliesTo, isRequired, OBJECT_TYPE_CONFIGS } from '@/domain/field-map'
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
          // identifiers stay readable even where the action doesn't use them
          if (!f.identifier) cell.fill = fill(GREY)
        } else if (isRequired(f, line.action)) {
          cell.fill = fill(AMBER)
        }
      })
    }

    ws.getColumn(1).width = 5
    ws.getColumn(2).width = Math.max(10, ...typeLines.map((l) => cfg.actionLabels[l.action].length + 2))
    cfg.fields.forEach((f, i) => {
      const col = ws.getColumn(i + 3)
      const valueLengths = typeLines.map((l) => (l.fieldData[f.key] ?? '').length + 2)
      col.width = Math.min(50, Math.max(12, f.label.length + 3, ...valueLengths))
      if (f.input === 'date') col.numFmt = 'mm/dd/yyyy'
    })
  }

  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME })
}
