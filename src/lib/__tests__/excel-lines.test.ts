import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { makeUnifiedTemplate, parseUnifiedTemplate } from '../excel-lines'
import { FIELD_MAP, OBJECT_TYPE_CONFIGS } from '@/domain/field-map'
import { validateLine } from '@/domain/schemas'

const equipment = FIELD_MAP.EQUIPMENT
const bom = FIELD_MAP.BOM_LINKAGE
const pm = FIELD_MAP.PM

// template columns = non-derived fields only
const col = (cfg: typeof equipment, key: string) =>
  cfg.fields.filter((f) => !f.derived).findIndex((f) => f.key === key) + 2

type Row = Record<string, string> & { Action: string }

/** Fill rows onto one or more sheets of the unified template. */
async function fillUnified(sheets: Array<{ cfg: typeof equipment; rows: Row[] }>): Promise<ArrayBuffer> {
  const blob = await makeUnifiedTemplate()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  for (const { cfg, rows } of sheets) {
    const ws = wb.getWorksheet(cfg.label)!
    rows.forEach((row, i) => {
      const r = ws.getRow(3 + i)
      r.getCell(1).value = row.Action
      for (const [key, value] of Object.entries(row)) {
        if (key !== 'Action') r.getCell(col(cfg, key)).value = value
      }
    })
  }
  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

describe('unified Excel template round-trip', () => {
  it('generates a template whose filled rows import back as valid lines', async () => {
    const data = await fillUnified([
      {
        cfg: equipment,
        rows: [
          {
            Action: 'Add',
            description: 'Centrifugal pump P-101',
            equipmentType: 'Pump',
            manufacturer: 'KSB',
            model: 'Etanorm 200',
            planningPlant: '1000',
            functionalLocation: 'SITE-A-PROC-PMP-01',
            costCenter: '1100',
            plannerGroup: 'P01',
            mainWorkCenter: 'MECH01',
            startupDate: '07/16/2026', // US-typed text — importer converts to ISO
            deletionReason: 'should be stripped — n/a for Add',
          },
          { Action: 'Delete', equipmentNumber: '10001234', deletionReason: 'Scrapped' },
          { Action: 'Modify', description: 'bad action row' },
        ],
      },
    ])

    const result = await parseUnifiedTemplate(data)

    expect(result.lines).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/Modify/)
    expect(result.errors[0]).toMatch(/^Equipment:/) // sheet label prefix

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

  it('mass-imports several sheets from one workbook', async () => {
    const data = await fillUnified([
      {
        cfg: equipment,
        rows: [{ Action: 'Delete', equipmentNumber: '10001234', deletionReason: 'Scrapped' }],
      },
      {
        cfg: pm,
        rows: [
          {
            Action: 'Change',
            equipmentNumber: '10002501',
            maintenanceItem: '458',
            changeDetails: 'Extend cycle to 6 months',
          },
        ],
      },
    ])
    const result = await parseUnifiedTemplate(data)
    expect(result.lines).toHaveLength(2)
    expect(result.lines.map((l) => l.objectType).sort()).toEqual(['EQUIPMENT', 'PM'])
    expect(result.errors).toHaveLength(0)
  })

  it('has a sheet per object type, in tab order, and honors the active tab', async () => {
    const blob = await makeUnifiedTemplate('PM')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    const visible = wb.worksheets.filter((ws) => ws.state !== 'veryHidden')
    expect(visible.map((ws) => ws.name)).toEqual(OBJECT_TYPE_CONFIGS.map((c) => c.label))
    const pmIndex = OBJECT_TYPE_CONFIGS.findIndex((c) => c.objectType === 'PM')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wb.views as any[])[0]?.activeTab).toBe(pmIndex)
  })

  it('rejects actions the object type does not offer (BOM has no Change)', async () => {
    const data = await fillUnified([
      {
        cfg: bom,
        rows: [
          { Action: 'Add', parentNumber: '10003310', material: '90012345' },
          { Action: 'Change', parentNumber: '10003310' },
        ],
      },
    ])
    const result = await parseUnifiedTemplate(data)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].action).toBe('ADD')
    expect(result.errors[0]).toMatch(/Change/)
  })

  it('adds row-exact mandatory conditional formatting to each sheet', async () => {
    const blob = await makeUnifiedTemplate()
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
    const data = await fillUnified([
      {
        cfg: equipment,
        rows: [{ Action: 'Delete', equipmentNumber: '10001234', deletionReason: 'R'.repeat(80) }],
      },
    ])
    const result = await parseUnifiedTemplate(data)
    expect(result.lines).toHaveLength(1)
    const v = validateLine({ ...result.lines[0] })
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.deletionReason).toMatch(/at most 72 characters/i)
  })

  it('imports an old single-sheet template by its sheet name and header labels', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(equipment.label)
    ws.addRow(['Action', 'Equipment Number', 'Reason for Deletion'])
    ws.addRow(['Delete', '10009999', 'Duplicate record'])
    const result = await parseUnifiedTemplate((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].fieldData.equipmentNumber).toBe('10009999')
  })

  it("re-importing the app's own export is silent about '#' and derived columns", async () => {
    // mimics a detail-export sheet: '#' row numbers + derived classification
    // columns are the APP's columns — importing them back must not read as a
    // user mistake; only genuinely foreign columns earn one grouped note
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(equipment.label)
    ws.addRow(['#', 'Action', 'Equipment Number', 'Equipment Category', 'Object Type', 'Catalog Profile', 'Reason for Deletion', 'My Notes', 'Approver'])
    ws.addRow(['1', 'Delete', '10001234', 'M', '16X', 'PM016X', 'Scrapped', 'call planning', 'AH'])
    const result = await parseUnifiedTemplate((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].fieldData.equipmentNumber).toBe('10001234')
    expect(result.errors).toHaveLength(1) // ONE grouped note, not one per column
    expect(result.errors[0]).toMatch(/"My Notes", "Approver"/)
    expect(result.errors[0]).not.toMatch(/#|Category|Object Type|Catalog/)
  })

  it('reports a useless file instead of importing nothing silently', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow(['Totally', 'Unrelated', 'Columns'])
    const result = await parseUnifiedTemplate((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    expect(result.lines).toHaveLength(0)
    expect(result.errors.join(' ')).toMatch(/right template/i)
  })
})
