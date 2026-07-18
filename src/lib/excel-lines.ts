import type { LineAction, ObjectType } from '@/domain/types'
import { LINE_ACTIONS } from '@/domain/types'
import { appliesTo, applyDerivations, isRequired, type FieldDef, type ObjectTypeConfig } from '@/domain/field-map'

// Excel template generation + import for the AIW editor, both derived from
// the field map so they can never drift from the grid or the validation.
//
// Template layout: row 1 = locked headers (Action + field labels, amber =
// mandatory for some action), row 2 = hidden field keys (robust import
// mapping even if labels are later renamed), rows 3..502 = unlocked entry
// rows with dropdowns for Action and choice fields. Sheet protection blocks
// column insert/delete and header edits. NOTE: Excel protection is a fence
// against accidents, not security — the importer independently validates
// everything anyway.

const ENTRY_ROWS = 500
const KEY_ROW_MARKER = '__action'
export const AMBER = 'FFFCE4A6' // shared with the Phase-3 export (excel-export.ts)

// exceljs is heavyweight — load it on demand so the main bundle stays small.
export async function excel() {
  return (await import('exceljs')).default ?? (await import('exceljs'))
}

const actionsOf = (cfg: ObjectTypeConfig): readonly LineAction[] => cfg.actions ?? LINE_ACTIONS

export async function makeTemplate(cfg: ObjectTypeConfig): Promise<Blob> {
  const ExcelJS = await excel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(cfg.label)
  // derived fields are auto-filled from their source field — they have no
  // column in the template (they reappear on the detail page and export)
  const fields = cfg.fields.filter((f) => !f.derived)
  const columns = ['Action', ...fields.map((f) => f.label)]

  // row 1: headers; row 2: hidden keys
  ws.addRow(columns)
  ws.addRow([KEY_ROW_MARKER, ...fields.map((f) => f.key)])
  ws.getRow(2).hidden = true

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  fields.forEach((f, i) => {
    const cell = headerRow.getCell(i + 2)
    if (f.requiredFor?.length) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } }
    }
    const noteParts = [
      f.requiredFor?.length ? `Mandatory for: ${f.requiredFor.map((a) => cfg.actionLabels[a]).join(', ')}` : '',
      f.maxLength ? `Max ${f.maxLength} characters` : '',
    ].filter(Boolean)
    if (noteParts.length) cell.note = noteParts.join(' · ')
  })

  // column widths + entry-area formatting
  ws.getColumn(1).width = Math.max(12, ...actionsOf(cfg).map((a) => cfg.actionLabels[a].length + 3))
  fields.forEach((f, i) => {
    const col = ws.getColumn(i + 2)
    col.width = Math.max(16, f.label.length + 3)
    if (f.input === 'date') col.numFmt = 'mm/dd/yyyy'
  })

  // unlock entry cells (columns unlocked, header/key rows re-locked)
  for (let c = 1; c <= columns.length; c++) ws.getColumn(c).protection = { locked: false }
  ws.getRow(1).protection = { locked: true }
  ws.getRow(2).protection = { locked: true }

  // dropdowns — short lists inline; long lists (Excel caps inline lists at
  // 255 chars) go on a veryHidden "Lists" sheet referenced by range
  const lastRow = 2 + ENTRY_ROWS
  let listsSheetCol = 0
  const listValidation = (values: readonly string[]) => {
    const inline = `"${values.join(',')}"`
    let formula = inline
    if (inline.length > 250) {
      const listsSheet = wb.getWorksheet('Lists') ?? wb.addWorksheet('Lists', { state: 'veryHidden' })
      listsSheetCol += 1
      values.forEach((v, i) => (listsSheet.getCell(i + 1, listsSheetCol).value = v))
      const colLetter = String.fromCharCode(64 + listsSheetCol) // A, B, … (few lists, ≤26)
      formula = `Lists!$${colLetter}$1:$${colLetter}$${values.length}`
    }
    return {
      type: 'list' as const,
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Pick a value from the dropdown list.',
    }
  }
  const actionValidation = listValidation(actionsOf(cfg).map((a) => cfg.actionLabels[a]))
  const fieldValidations = fields.map((f) =>
    f.input === 'choice' && f.options?.length ? listValidation(f.options) : undefined,
  )
  for (let r = 3; r <= lastRow; r++) {
    ws.getCell(r, 1).dataValidation = actionValidation
    fields.forEach((f, i) => {
      const choiceValidation = fieldValidations[i]
      if (choiceValidation) {
        ws.getCell(r, i + 2).dataValidation = choiceValidation
      } else if (f.maxLength) {
        // reminder-level fence — the importer's Zod validation is the real gate
        ws.getCell(r, i + 2).dataValidation = {
          type: 'textLength',
          operator: 'lessThanOrEqual',
          formulae: [f.maxLength],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Too long',
          error: `${f.label}: maximum ${f.maxLength} characters.`,
        }
      }
    })
  }

  // row-exact mandatory hints, mirroring the editor's amber cells: once the
  // row's Action is chosen in Excel, its mandatory-and-empty cells tint amber
  fields.forEach((f, i) => {
    if (!f.requiredFor?.length) return
    const colLetter = String.fromCharCode(64 + i + 2) // ≤26 template columns
    const actionMatch = f.requiredFor.map((a) => `$A3="${cfg.actionLabels[a]}"`).join(',')
    ws.addConditionalFormatting({
      ref: `${colLetter}3:${colLetter}${lastRow}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [`AND(OR(${actionMatch}),ISBLANK(${colLetter}3))`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: AMBER } } },
        },
      ],
    })
  })

  // fence, not a lock: stops accidental column/header edits, not determined users
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
  })

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export interface ImportedLine {
  objectType: ObjectType
  action: LineAction
  fieldData: Record<string, string>
}

export interface ImportResult {
  lines: ImportedLine[]
  /** row-level problems (unknown action, unrecognized sheet layout) */
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellText(value: any): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result)
    if ('richText' in value) return value.richText.map((t: { text: string }) => t.text).join('').trim()
    if ('text' in value) return String(value.text).trim()
    return String(value).trim()
  }
  return String(value).trim()
}

export async function parseTemplate(cfg: ObjectTypeConfig, data: ArrayBuffer): Promise<ImportResult> {
  const ExcelJS = await excel()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data)
  const ws = wb.getWorksheet(cfg.label) ?? wb.worksheets[0]
  if (!ws) return { lines: [], errors: ['The file contains no worksheets.'] }

  // map columns to fields — by hidden key row when present, else by header
  // label; derived fields are never mapped (their values come from
  // applyDerivations below, even if an old template still carries them)
  const importable = cfg.fields.filter((f) => !f.derived)
  const byKey = new Map(importable.map((f) => [f.key, f]))
  const byLabel = new Map(importable.map((f) => [f.label.toLowerCase(), f]))
  const hasKeyRow = cellText(ws.getRow(2).getCell(1).value) === KEY_ROW_MARKER
  const mapRow = ws.getRow(hasKeyRow ? 2 : 1)
  const fieldForColumn = new Map<number, FieldDef>()
  let actionColumn = 1
  const errors: string[] = []

  mapRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const text = cellText(cell.value)
    if (!text) return
    if (text === KEY_ROW_MARKER || text.toLowerCase() === 'action') {
      actionColumn = col
      return
    }
    const field = hasKeyRow ? byKey.get(text) : byLabel.get(text.toLowerCase())
    if (field) fieldForColumn.set(col, field)
    else errors.push(`Column "${text}" is not a known ${cfg.label} field — ignored.`)
  })
  if (fieldForColumn.size === 0) {
    return { lines: [], errors: [`No recognizable ${cfg.label} columns found — is this the right template?`] }
  }

  const labelToAction = new Map(actionsOf(cfg).map((a) => [cfg.actionLabels[a].toLowerCase(), a]))
  const lines: ImportedLine[] = []
  const firstDataRow = hasKeyRow ? 3 : 2

  for (let r = firstDataRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const values = new Map<number, string>()
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = cellText(cell.value)
      if (text) values.set(col, text)
    })
    if (values.size === 0) continue // blank row

    const actionText = values.get(actionColumn) ?? ''
    const action = labelToAction.get(actionText.toLowerCase())
    if (!action) {
      errors.push(
        actionText
          ? `Row ${r}: unknown action "${actionText}" — expected one of: ${actionsOf(cfg).map((a) => cfg.actionLabels[a]).join(', ')}.`
          : `Row ${r}: the Action cell is empty — row skipped.`,
      )
      continue
    }

    const fieldData: Record<string, string> = {}
    for (const [col, field] of fieldForColumn) {
      let text = values.get(col)
      // US-typed dates (MM/DD/YYYY) are converted to the stored ISO form
      if (text && field.input === 'date') {
        const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
        if (us) text = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
      }
      // silently drop values in cells that don't apply to this row's action
      if (text && appliesTo(field, action)) fieldData[field.key] = text
    }
    lines.push({ objectType: cfg.objectType, action, fieldData: applyDerivations(cfg.objectType, fieldData) })
  }

  return { lines, errors }
}

/** For tests and tooling: the mandatory keys for an objectType × action. */
export function requiredKeysFor(cfg: ObjectTypeConfig, action: LineAction): string[] {
  return cfg.fields.filter((f) => isRequired(f, action)).map((f) => f.key)
}
