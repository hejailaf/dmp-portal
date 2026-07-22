// Regenerates src/domain/field-map/equipment-types.ts from the company's
// correlation spreadsheet (Equipment Type → category / object type / catalog
// profile). To update the mapping: replace docs/tech_object_types.xlsx and
// run: npx vite-node scripts/import-equipment-types.ts [path-to-xlsx]
import { writeFileSync } from 'node:fs'
import ExcelJS from 'exceljs'

const source = process.argv[2] ?? 'docs/tech_object_types.xlsx'

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(source)
const ws = wb.worksheets[0]

interface Row {
  equipmentType: string
  equipmentCategory: string
  technicalObjectType: string
  catalogProfile: string
}
const rows: Row[] = []
ws.eachRow((row, n) => {
  if (n === 1) return // header
  const [equipmentCategory, technicalObjectType, equipmentType, catalogProfile] = [1, 2, 3, 4].map(
    (c) => String(row.getCell(c).value ?? '').trim(),
  )
  if (!equipmentType) return
  rows.push({ equipmentType, equipmentCategory, technicalObjectType, catalogProfile })
})

const seen = new Set<string>()
for (const r of rows) {
  if (seen.has(r.equipmentType)) throw new Error(`Duplicate Equipment Type: ${r.equipmentType}`)
  seen.add(r.equipmentType)
  if (!r.equipmentCategory || !r.technicalObjectType || !r.catalogProfile)
    throw new Error(`Incomplete row for Equipment Type: ${r.equipmentType}`)
}

const body = rows
  .map(
    (r) =>
      `  { equipmentType: ${JSON.stringify(r.equipmentType)}, equipmentCategory: ${JSON.stringify(r.equipmentCategory)}, technicalObjectType: ${JSON.stringify(r.technicalObjectType)}, catalogProfile: ${JSON.stringify(r.catalogProfile)} },`,
  )
  .join('\n')

writeFileSync(
  'src/domain/field-map/equipment-types.ts',
  `// GENERATED from docs/tech_object_types.xlsx by scripts/import-equipment-types.ts
// — do not hand-edit; update the spreadsheet and re-run the script.

interface EquipmentTypeRow {
  equipmentType: string
  equipmentCategory: string
  technicalObjectType: string
  catalogProfile: string
}

export const EQUIPMENT_TYPES: EquipmentTypeRow[] = [
${body}
]

/** Dropdown options — alphabetical for findability. */
export const EQUIPMENT_TYPE_NAMES: string[] = EQUIPMENT_TYPES.map((r) => r.equipmentType).sort((a, b) =>
  a.localeCompare(b),
)

/**
 * Fills equipmentCategory / technicalObjectType / catalogProfile from the
 * selected equipmentType. Unknown or empty selections leave existing values
 * untouched (legacy lines keep their data; validation flags bad selections).
 */
export function deriveEquipmentFields(fieldData: Record<string, string>): Record<string, string> {
  const row = EQUIPMENT_TYPES.find((r) => r.equipmentType === fieldData.equipmentType)
  if (!row) return fieldData
  return {
    ...fieldData,
    equipmentCategory: row.equipmentCategory,
    technicalObjectType: row.technicalObjectType,
    catalogProfile: row.catalogProfile,
  }
}
`,
)
console.log(`Wrote src/domain/field-map/equipment-types.ts (${rows.length} equipment types)`)
