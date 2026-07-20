import type { ObjectTypeConfig } from './field-def'

// Company field set per field-map review 2026-07-17. The Functional Location
// identifier is shown/required only on Change/Delete (user decision) so Add
// stays minimal — SAP assigns/keys the floc code during execution.
// maxLength values are REPRESENTATIVE SAP field lengths — tune as needed.

export const flocConfig: ObjectTypeConfig = {
  objectType: 'FLOC',
  label: 'Functional Locations',
  actionLabels: { ADD: 'Add', CHANGE: 'Change', DELETE: 'Delete' },
  fields: [
    {
      key: 'functionalLocation',
      label: 'Functional Location',
      input: 'text',
      appliesTo: ['CHANGE', 'DELETE'],
      requiredFor: ['CHANGE', 'DELETE'],
      identifier: true,
      maxLength: 40,
    },
    {
      key: 'description',
      label: 'FLoc Description',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 40,
      configurable: true,
    },
    {
      key: 'superiorFunctionalLocation',
      label: 'Superior Functional Location',
      input: 'text',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
      maxLength: 40,
      configurable: true,
    },
    { key: 'costCenter', label: 'Cost Center', input: 'number', appliesTo: ['ADD', 'CHANGE'], maxLength: 10, configurable: true },
    {
      key: 'startupDate',
      label: 'Start-up Date',
      input: 'date',
      appliesTo: ['ADD', 'CHANGE'],
      requiredFor: ['ADD'],
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
