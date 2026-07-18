import type { LineAction, ObjectType } from '../types'

// The field map is the single config-driven definition of which SAP fields
// appear per objectType × action, and which are mandatory. Adjusting a
// config file under src/domain/field-map/ is the ONLY change needed to
// add/remove/require fields — the editor UI, Zod validation, and Excel
// export all derive from it.

export interface FieldDef {
  /** stable key — this is what gets stored in the line's FieldData JSON */
  key: string
  label: string
  input: 'text' | 'choice' | 'number' | 'date'
  /** choice input only */
  options?: readonly string[]
  /** actions where the field is shown; omit = shown for all actions */
  appliesTo?: readonly LineAction[]
  /** actions where the field is mandatory (must be a subset of appliesTo) */
  requiredFor?: readonly LineAction[]
  /**
   * Identifies the existing SAP object (e.g. equipment number). Change
   * lines must fill at least one NON-identifier field, and identifiers are
   * never greyed in the Excel export.
   */
  identifier?: boolean
  /**
   * Character limit, mirroring the SAP field length (text/number inputs
   * only). Enforced as a typing hard-stop in the editor, by Zod validation
   * (covers Excel import and paste), and advertised in the Excel template.
   */
  maxLength?: number
  /**
   * Auto-filled from another field (see applyDerivations) — hidden in the
   * editor grid and Excel template, but stored, shown on the detail line
   * grids, and included in the Phase-3 Excel export.
   */
  derived?: boolean
  /** true = the mandatory set may be tuned later without code changes */
  configurable?: boolean
}

export interface ObjectTypeConfig {
  objectType: ObjectType
  /** tab / sheet label */
  label: string
  /** what Add/Change/Delete are called for this object type */
  actionLabels: Record<LineAction, string>
  /** actions this object type offers; omit = all three (BOM has no Change, per company policy 2026-07-17) */
  actions?: readonly LineAction[]
  fields: FieldDef[]
}
