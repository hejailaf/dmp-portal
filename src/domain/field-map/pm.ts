import type { ObjectTypeConfig } from './field-def'

// Company field set per field-map review 2026-07-17. Identifier scheme:
// Add = equipment number; Change/Delete = maintenance item (user decision).
// Number inputs: company SAP values for these are purely numeric.
// maxLength values are REPRESENTATIVE SAP field lengths — tune as needed.

export const pmConfig: ObjectTypeConfig = {
  objectType: 'PM',
  label: 'PM',
  actionLabels: {
    ADD: 'Add PM to equipment',
    CHANGE: 'Change task list',
    DELETE: 'Delete PM',
  },
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
      maxLength: 3,
      configurable: true,
    },
    { key: 'plannerGroup', label: 'Planner Group', input: 'text', appliesTo: ['ADD', 'CHANGE'], maxLength: 3, configurable: true },
    {
      key: 'mainWorkCenter',
      label: 'Work Center',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 8,
      configurable: true,
    },
    { key: 'startDate', label: 'Cycle Start Date', input: 'date', appliesTo: ['ADD', 'CHANGE'], configurable: true },
    {
      key: 'changeDetails',
      label: 'Change Remarks',
      input: 'text',
      appliesTo: ['CHANGE'],
      requiredFor: ['CHANGE'],
      maxLength: 72,
      configurable: true,
    },
    {
      key: 'deletionReason',
      label: 'Reason for Deletion',
      input: 'text',
      appliesTo: ['DELETE'],
      requiredFor: ['DELETE'],
      maxLength: 72,
      configurable: true,
    },
  ],
}
