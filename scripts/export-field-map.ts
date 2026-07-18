// Generates field-map-review.csv from the live field-map config so the
// project owner can tune fields in Excel. Run: node scripts/export-field-map.ts
import { writeFileSync } from 'node:fs'
import { OBJECT_TYPE_CONFIGS } from '../src/domain/field-map/index.ts'
import { LINE_ACTIONS } from '../src/domain/types.ts'

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
const rows: string[][] = [
  ['Tab', 'Field Key (do not edit)', 'Label', 'Input Type', 'Choice Options (| separated)', 'Shown For Actions', 'Required For Actions', 'Max Length', 'Keep? (YES/NO)', 'Notes'],
]

for (const cfg of OBJECT_TYPE_CONFIGS) {
  for (const f of cfg.fields) {
    // the equipment-type list lives in docs/tech_object_types.xlsx (via
    // scripts/import-equipment-types.ts), not in this CSV — pointer only
    const options =
      f.key === 'equipmentType'
        ? `(${f.options?.length ?? 0} types — edit docs/tech_object_types.xlsx)`
        : (f.options ?? []).join(' | ')
    rows.push([
      cfg.label,
      f.key,
      f.label,
      f.input,
      options,
      (f.appliesTo ?? LINE_ACTIONS).map((a) => cfg.actionLabels[a]).join(' | '),
      (f.requiredFor ?? []).map((a) => cfg.actionLabels[a]).join(' | '),
      f.maxLength ? String(f.maxLength) : '',
      'YES',
      f.derived ? 'Auto-filled from Equipment Type table — hidden in editor/template' : '',
    ])
  }
}

// BOM so Excel opens it as UTF-8
writeFileSync('field-map-review.csv', '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'))
console.log(`Wrote field-map-review.csv (${rows.length - 1} fields)`)
