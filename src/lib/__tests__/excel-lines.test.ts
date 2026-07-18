import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { makeTemplate, parseTemplate } from '../excel-lines'
import { FIELD_MAP } from '@/domain/field-map'
import { validateLine } from '@/domain/schemas'

const equipment = FIELD_MAP.EQUIPMENT
const bom = FIELD_MAP.BOM_LINKAGE

// template columns = non-derived fields only
const col = (cfg: typeof equipment, key: string) =>
  cfg.fields.filter((f) => !f.derived).findIndex((f) => f.key === key) + 2

async function fillTemplate(
  cfg: typeof equipment,
  rows: Array<Record<string, string> & { Action: string }>,
): Promise<ArrayBuffer> {
  const blob = await makeTemplate(cfg)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  const ws = wb.getWorksheet(cfg.label)!
  rows.forEach((row, i) => {
    const r = ws.getRow(3 + i)
    r.getCell(1).value = row.Action
    for (const [key, value] of Object.entries(row)) {
      if (key !== 'Action') r.getCell(col(cfg, key)).value = value
    }
  })
  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

describe('Excel template round-trip', () => {
  it('generates a template whose filled rows import back as valid lines', async () => {
    const data = await fillTemplate(equipment, [
      {
        Action: 'Add',
        description: 'Centrifugal pump P-101',
        equipmentType: 'Pump',
        manufacturer: 'KSB',
        model: 'Etanorm 200',
        planningPlant: '1000',
        functionalLocation: 'SITE-A-PROC-PMP-01',
        costCenter: 'CC-1100',
        plannerGroup: 'P01',
        mainWorkCenter: 'MECH01',
        startupDate: '07/16/2026', // US-typed text — importer converts to ISO
        deletionReason: 'should be stripped — n/a for Add',
      },
      { Action: 'Delete', equipmentNumber: '10001234', deletionReason: 'Scrapped' },
      { Action: 'Modify', description: 'bad action row' },
    ])

    const result = await parseTemplate(equipment, data)

    expect(result.lines).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/Modify/)

    const [add, del] = result.lines
    expect(add.action).toBe('ADD')
    expect(add.fieldData.deletionReason).toBeUndefined() // n/a cell stripped
    // derived classification arrives even though the template has no such columns
    expect(add.fieldData).toMatchObject({
      equipmentCategory: 'M',
      technicalObjectType: '16X',
      catalogProfile: 'PM016X',
    })
    expect(validateLine({ ...add })).toMatchObject({ ok: true })
    expect(del.action).toBe('DELETE')
    expect(validateLine({ ...del })).toMatchObject({ ok: true })
  })

  it('rejects actions the object type does not offer (BOM has no Change)', async () => {
    const data = await fillTemplate(bom, [
      { Action: 'Add', parentNumber: '10003310', material: '90012345' },
      { Action: 'Change', parentNumber: '10003310' },
    ])
    const result = await parseTemplate(bom, data)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].action).toBe('ADD')
    expect(result.errors[0]).toMatch(/Change/)
  })

  it('adds row-exact mandatory conditional formatting to the template', async () => {
    const blob = await makeTemplate(equipment)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    const ws = wb.getWorksheet(equipment.label)!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfs: any[] = (ws as any).conditionalFormattings ?? (ws.model as any)?.conditionalFormattings ?? []
    const letter = (key: string) => String.fromCharCode(64 + col(equipment, key))
    const refs = cfs.map((c) => String(c.ref))
    expect(refs.some((r) => r.startsWith(letter('description')))).toBe(true) // mandatory → rule
    expect(refs.some((r) => r.startsWith(letter('serialNumber')))).toBe(false) // optional → none
    const descRule = cfs.find((c) => String(c.ref).startsWith(letter('description'))).rules[0]
    expect(descRule.formulae[0]).toContain('ISBLANK')
    expect(descRule.formulae[0]).toContain('$A3="Add"')
  })

  it('flags imported values that exceed a field character limit', async () => {
    const data = await fillTemplate(equipment, [
      { Action: 'Delete', equipmentNumber: '10001234', deletionReason: 'R'.repeat(80) },
    ])
    const result = await parseTemplate(equipment, data)
    expect(result.lines).toHaveLength(1)
    const v = validateLine({ ...result.lines[0] })
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.deletionReason).toMatch(/at most 72 characters/i)
  })

  it('imports by header label when the hidden key row was deleted', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(equipment.label)
    ws.addRow(['Action', 'Equipment Number', 'Reason for Deletion'])
    ws.addRow(['Delete', '10009999', 'Duplicate record'])
    const result = await parseTemplate(equipment, (await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].fieldData.equipmentNumber).toBe('10009999')
  })

  it('reports a useless file instead of importing nothing silently', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow(['Totally', 'Unrelated', 'Columns'])
    const result = await parseTemplate(equipment, (await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.lines).toHaveLength(0)
    expect(result.errors.join(' ')).toMatch(/right template/i)
  })
})
