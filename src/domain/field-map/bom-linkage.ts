import type { ObjectTypeConfig } from './field-def'

// Company field set per field-map review (updated 2026-07-20): BOM linkage
// offers only Add / Delete, links to equipment only, and carries just the
// numeric identifiers plus a deletion reason.

export const bomLinkageConfig: ObjectTypeConfig = {
  objectType: 'BOM_LINKAGE',
  label: 'BOM Linkage',
  actionLabels: { ADD: 'Add', CHANGE: 'Change', DELETE: 'Delete' },
  actions: ['ADD', 'DELETE'],
  fields: [
    {
      key: 'parentNumber',
      label: 'Equipment',
      input: 'number',
      requiredFor: ['ADD', 'DELETE'],
      identifier: true,
      maxLength: 18,
    },
    {
      key: 'material',
      label: 'Material (9BOM | 9CAT)',
      input: 'number',
      requiredFor: ['ADD'],
      maxLength: 18,    },
    {
      key: 'deletionReason',
      label: 'Reason for Deletion',
      input: 'text',
      appliesTo: ['DELETE'],
      requiredFor: ['DELETE'],
      maxLength: 72,    },
  ],
}
