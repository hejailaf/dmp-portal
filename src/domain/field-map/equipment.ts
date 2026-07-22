import type { ObjectTypeConfig } from './field-def'
import { EQUIPMENT_TYPE_NAMES } from './equipment-types'

// Company field set per field-map review 2026-07-17 (see field-map-review.csv).
// Adjust labels/options/requiredFor/maxLength here — the editor grid,
// validation, and Excel templates all follow automatically. maxLength values
// are REPRESENTATIVE SAP field lengths — tune to the site's SPRO settings.

export const equipmentConfig: ObjectTypeConfig = {
  objectType: 'EQUIPMENT',
  label: 'Equipment',
  actionLabels: { ADD: 'Add', CHANGE: 'Change', DELETE: 'Delete' },
  fields: [
    {
      key: 'equipmentNumber',
      label: 'Equipment Number',
      // numeric like the PM tab's Equipment Number and BOM's Equipment —
      // was 'text' by omission, letting letters through (bug, 2026-07-19)
      input: 'number',
      appliesTo: ['CHANGE', 'DELETE'],
      requiredFor: ['CHANGE', 'DELETE'],
      identifier: true,
      maxLength: 18,
    },
    {
      key: 'description',
      label: 'Description',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 40,    },
    {
      // the only classification field the user touches — the three derived
      // fields below are auto-filled from docs/tech_object_types.xlsx
      key: 'equipmentType',
      label: 'Equipment Type',
      input: 'choice',
      options: EQUIPMENT_TYPE_NAMES,
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
    },
    {
      key: 'equipmentCategory',
      label: 'Equipment Category',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      derived: true,
      maxLength: 1,
    },
    {
      key: 'technicalObjectType',
      label: 'Object Type',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      derived: true,
      maxLength: 10,
    },
    {
      key: 'catalogProfile',
      label: 'Catalog Profile',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      derived: true,
      maxLength: 9,
    },
    { key: 'manufacturer', label: 'Manufacturer', input: 'text', appliesTo: ['ADD', 'CHANGE'], requiredFor: ['ADD'], maxLength: 30 },
    { key: 'model', label: 'Model Number', input: 'text', appliesTo: ['ADD', 'CHANGE'], requiredFor: ['ADD'], maxLength: 20 },
    { key: 'serialNumber', label: 'Serial Number', input: 'text', appliesTo: ['ADD', 'CHANGE'], maxLength: 18 },
    {
      key: 'planningPlant',
      label: 'Planning Plant',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 4,    },
    {
      key: 'functionalLocation',
      label: 'Functional Location',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 40,    },
    { key: 'costCenter', label: 'Cost Center', input: 'number', appliesTo: ['ADD', 'CHANGE'], requiredFor: ['ADD'], maxLength: 10 },
    { key: 'plannerGroup', label: 'Planner Group', input: 'text', appliesTo: ['ADD', 'CHANGE'], requiredFor: ['ADD'], maxLength: 3 },
    { key: 'mainWorkCenter', label: 'Work Center', input: 'text', appliesTo: ['ADD', 'CHANGE'], requiredFor: ['ADD'], maxLength: 8 },
    { key: 'startupDate', label: 'Start-up Date', input: 'date', appliesTo: ['ADD', 'CHANGE'], requiredFor: ['ADD'] },
    { key: 'engTagNo', label: 'Eng. Tag no.', input: 'text', appliesTo: ['ADD', 'CHANGE'], maxLength: 30 },
    { key: 'pidNo', label: 'P&ID no.', input: 'text', appliesTo: ['ADD', 'CHANGE'], maxLength: 30 },
    {
      key: 'deletionReason',
      label: 'Reason for Deletion',
      input: 'text',
      appliesTo: ['DELETE'],
      requiredFor: ['DELETE'],
      maxLength: 72,    },
  ],
}
