import type { ObjectTypeConfig } from './field-def'

// Company field set per field-map review 2026-07-17. Identifier scheme:
// Add = equipment number; Change/Delete = maintenance item (user decision).
// Number inputs: company SAP values for these are purely numeric.
// maxLength values are REPRESENTATIVE SAP field lengths — tune as needed.

export const pmConfig: ObjectTypeConfig = {
  objectType: 'PM',
  label: 'PM',
  // plain Add/Change/Delete to match the other tabs (user decision
  // 2026-07-19); the identifier scheme in the note above is unchanged
  actionLabels: { ADD: 'Add', CHANGE: 'Change', DELETE: 'Delete' },
  fields: [
    {
      key: 'equipmentNumber',
      label: 'Equipment Number',
      input: 'number',
      requiredFor: ['ADD'],
      identifier: true,
      maxLength: 18,
    },
    {
      key: 'taskListNumber',
      label: 'Task List Number',
      input: 'number',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      identifier: true,
      maxLength: 8,
    },
    {
      key: 'maintenancePlanNumber',
      label: 'Maintenance Plan',
      input: 'number',
      identifier: true,
      maxLength: 12,
    },
    {
      key: 'maintenanceItem',
      label: 'Maintenance Item',
      input: 'number',
      requiredFor: ['CHANGE', 'DELETE'],
      identifier: true,
      maxLength: 16,
    },
    {
      key: 'cycleFrequency',
      label: 'Cycle (Months)',
      input: 'number',
      appliesTo: ['ADD', 'CHANGE'],
      maxLength: 3,    },
    { key: 'plannerGroup', label: 'Planner Group', input: 'text', appliesTo: ['ADD', 'CHANGE'], maxLength: 3 },
    {
      key: 'mainWorkCenter',
      label: 'Work Center',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 8,    },
    { key: 'startDate', label: 'Cycle Start Date', input: 'date', appliesTo: ['ADD', 'CHANGE'] },
    {
      key: 'changeDetails',
      label: 'Change Remarks',
      input: 'text',
      appliesTo: ['CHANGE'],
      requiredFor: ['CHANGE'],
      maxLength: 72,    },
    {
      key: 'deletionReason',
      label: 'Reason for Deletion',
      input: 'text',
      appliesTo: ['DELETE'],
      requiredFor: ['DELETE'],
      maxLength: 72,    },
  ],
}
