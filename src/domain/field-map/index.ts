import { LINE_ACTIONS, type LineAction, type ObjectType, type RequestLine } from '../types'
import type { FieldDef, ObjectTypeConfig } from './field-def'
import { equipmentConfig } from './equipment'
import { flocConfig } from './floc'
import { bomLinkageConfig } from './bom-linkage'
import { pmConfig } from './pm'
import { deriveEquipmentFields } from './equipment-types'

export type { FieldDef, ObjectTypeConfig } from './field-def'
export { EQUIPMENT_TYPES, EQUIPMENT_TYPE_NAMES } from './equipment-types'

/** Tab order in the editor and sheet order in the Excel export. */
export const OBJECT_TYPE_CONFIGS: ObjectTypeConfig[] = [
  equipmentConfig,
  flocConfig,
  bomLinkageConfig,
  pmConfig,
]

export const FIELD_MAP: Record<ObjectType, ObjectTypeConfig> = {
  EQUIPMENT: equipmentConfig,
  FLOC: flocConfig,
  BOM_LINKAGE: bomLinkageConfig,
  PM: pmConfig,
}

/** Actions this object type offers (BOM has no Change, per company policy). */
export function actionsFor(objectType: ObjectType): readonly LineAction[] {
  return FIELD_MAP[objectType].actions ?? LINE_ACTIONS
}

/**
 * Fills derived fields from their source field (currently: equipment
 * classification from Equipment Type). Called by the editor on every field
 * change, by the Excel importer, and by data providers before storing —
 * stored lines are always consistent with the correlation table.
 */
export function applyDerivations(
  objectType: ObjectType,
  fieldData: Record<string, string>,
): Record<string, string> {
  return objectType === 'EQUIPMENT' ? deriveEquipmentFields(fieldData) : fieldData
}

export function appliesTo(field: FieldDef, action: LineAction): boolean {
  return !field.appliesTo || field.appliesTo.includes(action)
}

/**
 * The canonical stored shape of a line's data: derived fields filled in, and
 * values for fields that do NOT apply to this action removed.
 *
 * Applied at the data boundaries (provider reads and writes) so a value typed
 * under one action can never survive an action change into storage, the Excel
 * export, or a duplicated line — where it would be keyed into SAP as truth.
 *
 * Derivations run FIRST on purpose: a derived value must never outlive a
 * source field that this action hides. Keep that order even if a derived
 * field's `appliesTo` ever stops matching its source's.
 *
 * Keys with no field definition are kept deliberately — stored data may
 * outlive the field map (see the `.passthrough()` in schemas.ts), and unknown
 * keys are never rendered, validated, or exported.
 */
export function normalizeFieldData(
  objectType: ObjectType,
  action: LineAction,
  fieldData: Record<string, string>,
): Record<string, string> {
  // Total by construction: this runs on every provider read, including rows
  // hand-edited in the SharePoint list, so an unrecognised object type must
  // hand the data back rather than throw (mapLine promises not to crash the
  // page, and the mock's read would otherwise fall into its reseed catch).
  const cfg = FIELD_MAP[objectType]
  if (!cfg) return fieldData
  // An action this type no longer offers (legacy or hand-edited rows) keeps its
  // data as-is, so validateLine reports it instead of the line quietly emptying.
  if (!(cfg.actions ?? LINE_ACTIONS).includes(action)) return fieldData
  const derived = applyDerivations(objectType, fieldData)
  const fields = cfg.fields
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(derived)) {
    const field = fields.find((f) => f.key === key)
    if (!field || appliesTo(field, action)) out[key] = value
  }
  return out
}

export function isRequired(field: FieldDef, action: LineAction): boolean {
  return !!field.requiredFor?.includes(action) && appliesTo(field, action)
}

/** Fields shown for an objectType × action. */
export function fieldsFor(objectType: ObjectType, action: LineAction): FieldDef[] {
  return FIELD_MAP[objectType].fields.filter((f) => appliesTo(f, action))
}

/**
 * Per-type summary parts in config (editor tab) order — the structured
 * source behind summarizeLines; the detail header renders these as chips.
 */
export function summarizeLinesParts(
  lines: Pick<RequestLine, 'objectType' | 'action'>[],
): Array<{ objectType: ObjectType; label: string; text: string }> {
  const parts: Array<{ objectType: ObjectType; label: string; text: string }> = []
  for (const cfg of OBJECT_TYPE_CONFIGS) {
    const ofType = lines.filter((l) => l.objectType === cfg.objectType)
    if (ofType.length === 0) continue
    const byAction = (['ADD', 'CHANGE', 'DELETE'] as const)
      .map((a) => ({ a, n: ofType.filter((l) => l.action === a).length }))
      .filter(({ n }) => n > 0)
      .map(({ a, n }) => `${n} ${cfg.actionLabels[a]}`)
    parts.push({ objectType: cfg.objectType, label: cfg.label, text: byAction.join(', ') })
  }
  return parts
}

/** Denormalized one-line summary for list views, e.g. "Equipment: 2 Add, 1 Change · PM: 1 Add". */
export function summarizeLines(lines: Pick<RequestLine, 'objectType' | 'action'>[]): string {
  return summarizeLinesParts(lines)
    .map((p) => `${p.label}: ${p.text}`)
    .join(' · ')
}

/**
 * Inverse of summarizeLines for list views (list rows carry only the
 * denormalized summary string, never the lines): present type labels +
 * total line count. Format is owned by summarizeLines above — the
 * round-trip test in line-summary.test.ts keeps the two in sync.
 */
export function parseLineSummary(summary: string): { types: string[]; total: number } {
  if (!summary) return { types: [], total: 0 }
  const segments = summary.split(' · ')
  return {
    types: segments.map((s) => s.slice(0, s.indexOf(':'))),
    total: segments.reduce(
      (sum, s) =>
        sum +
        [...s.slice(s.indexOf(':') + 1).matchAll(/\d+/g)].reduce((a, m) => a + Number(m[0]), 0),
      0,
    ),
  }
}
