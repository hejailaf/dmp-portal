import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { Request, RequestLine } from '@/domain/types'
import { FIELD_MAP } from '@/domain/field-map'
import { makeRequestExport } from '../excel-export'

const REQ: Request = {
  id: 'r-1',
  ref: 'DCR-260042',
  description: 'New feed pump - MOC-2299',
  status: 'In process',
  requesterId: 'u-r',
  requesterName: 'Rana Requester',
  assigneeId: 'u-m',
  assigneeName: 'Malik Maintainer',
  createdAt: '2026-07-10T08:00:00Z',
  submittedAt: '2026-07-11T08:00:00Z',
  slaDays: 5,
  dueDate: '2026-07-16T08:00:00Z',
  lineSummary: 'Equipment: 1 Add, 1 Delete · PM: 1 Add',
}

const LINES: RequestLine[] = [
  {
    id: 'l-1',
    requestId: 'r-1',
    order: 1,
    objectType: 'EQUIPMENT',
    action: 'ADD',
    fieldData: {
      description: 'Feed pump',
      equipmentType: 'Centrifugal Pump',
      equipmentCategory: 'M', // derived
      technicalObjectType: '16X', // derived
      startupDate: '2026-08-01',
    },
  },
  {
    id: 'l-2',
    requestId: 'r-1',
    order: 2,
    objectType: 'EQUIPMENT',
    action: 'DELETE',
    fieldData: { equipmentNumber: '10001234', deletionReason: 'Scrapped' },
  },
  {
    id: 'l-3',
    requestId: 'r-1',
    order: 3,
    objectType: 'PM',
    action: 'ADD',
    fieldData: { equipmentNumber: '10001234', taskListNumber: '101' },
  },
]

async function load(req: Request, lines: RequestLine[]) {
  const blob = await makeRequestExport(req, lines)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  return wb
}

const colOf = (cfgKey: 'EQUIPMENT' | 'PM', fieldKey: string) =>
  FIELD_MAP[cfgKey].fields.findIndex((f) => f.key === fieldKey) + 3 // '#', 'Action' offset

describe('makeRequestExport', () => {
  it('creates Summary plus one sheet per PRESENT object type, in config order', async () => {
    const wb = await load(REQ, LINES)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Summary',
      FIELD_MAP.EQUIPMENT.label,
      FIELD_MAP.PM.label,
    ])
  })

  it('Summary carries the ref, description, and status', async () => {
    const wb = await load(REQ, LINES)
    const ws = wb.getWorksheet('Summary')!
    expect(ws.getCell('B1').value).toBe('DCR-260042')
    expect(ws.getCell('B2').value).toBe('New feed pump - MOC-2299')
    expect(ws.getCell('B3').value).toBe('In process')
  })

  it('includes derived fields with their values (unlike the template)', async () => {
    const wb = await load(REQ, LINES)
    const ws = wb.getWorksheet(FIELD_MAP.EQUIPMENT.label)!
    const col = colOf('EQUIPMENT', 'equipmentCategory')
    expect(ws.getRow(1).getCell(col).value).toBe('Equipment Category')
    expect(ws.getRow(2).getCell(col).value).toBe('M')
  })

  it('shades mandatory-for-action cells amber and inapplicable cells grey', async () => {
    const wb = await load(REQ, LINES)
    const ws = wb.getWorksheet(FIELD_MAP.EQUIPMENT.label)!
    // row 2 = ADD line: description mandatory → amber
    const descCell = ws.getRow(2).getCell(colOf('EQUIPMENT', 'description'))
    expect((descCell.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFFCE4A6')
    // row 2 = ADD line: deletionReason not applicable → grey
    const delCell = ws.getRow(2).getCell(colOf('EQUIPMENT', 'deletionReason'))
    expect((delCell.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFE9E9E9')
  })

  it('never prints a value in a cell the action does not use', async () => {
    // even if stale data reached storage: the sheet is keyed into SAP
    const stale: RequestLine = {
      ...LINES[1],
      id: 'l-stale',
      fieldData: { ...LINES[1].fieldData, description: 'STALE typed under Add', manufacturer: 'STALE' },
    }
    const wb = await load(REQ, [stale])
    const ws = wb.getWorksheet(FIELD_MAP.EQUIPMENT.label)!
    const cell = ws.getRow(2).getCell(colOf('EQUIPMENT', 'description'))
    expect(cell.value ?? '').toBe('')
    expect((cell.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFE9E9E9')
  })

  it('greys inapplicable identifier cells too (they are always empty)', async () => {
    const wb = await load(REQ, LINES)
    const ws = wb.getWorksheet(FIELD_MAP.EQUIPMENT.label)!
    // equipmentNumber is the identifier, appliesTo CHANGE/DELETE — on the ADD
    // row it does not apply, so it reads as "not for this action", not "empty"
    const idCell = ws.getRow(2).getCell(colOf('EQUIPMENT', 'equipmentNumber'))
    expect((idCell.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe('FFE9E9E9')
  })

  it('writes date cells as real dates with US number format', async () => {
    const wb = await load(REQ, LINES)
    const ws = wb.getWorksheet(FIELD_MAP.EQUIPMENT.label)!
    const col = colOf('EQUIPMENT', 'startupDate')
    const cell = ws.getRow(2).getCell(col)
    expect(cell.value).toBeInstanceOf(Date)
    expect((cell.value as Date).toISOString().slice(0, 10)).toBe('2026-08-01')
    expect(ws.getColumn(col).numFmt).toBe('mm/dd/yyyy')
  })

  it('omits sheets for absent object types', async () => {
    const wb = await load(REQ, LINES.slice(2)) // PM only
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', FIELD_MAP.PM.label])
  })
})
