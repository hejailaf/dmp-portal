import { AUDIT_EVENTS, LINE_ACTIONS, OBJECT_TYPES, STATUSES } from '@/domain/types'

// The four PMDC lists (spec §Lists + Phase-2 plan; prefix renamed
// DMP→PMDC 2026-07-21 with the new-subsite move). The provision screen
// creates/verifies exactly this; docs/LIST_SETUP.md mirrors it for manual
// setup. Field internal names are fixed — the provider reads/writes them.
//
// Plan deviation (approved): requester/assignee are TEXT columns holding the
// claims login + display name, not Person fields — person-field writes were
// not spike-verified and the custom UI never uses people-column features.

interface FieldSpec {
  internalName: string
  schemaXml: string
}

export interface ListSpec {
  title: string
  versioning: boolean
  fields: FieldSpec[]
}

const text = (name: string) => ({
  internalName: name,
  schemaXml: `<Field Type="Text" Name="${name}" DisplayName="${name}" MaxLength="255"/>`,
})
const note = (name: string) => ({
  internalName: name,
  schemaXml: `<Field Type="Note" Name="${name}" DisplayName="${name}" NumLines="6" RichText="FALSE"/>`,
})
const number = (name: string, indexed = false) => ({
  internalName: name,
  schemaXml: `<Field Type="Number" Name="${name}" DisplayName="${name}" Decimals="0"${indexed ? ' Indexed="TRUE"' : ''}/>`,
})
const dateTime = (name: string) => ({
  internalName: name,
  schemaXml: `<Field Type="DateTime" Name="${name}" DisplayName="${name}" Format="DateTime"/>`,
})
const choice = (name: string, values: readonly string[]) => ({
  internalName: name,
  schemaXml: `<Field Type="Choice" Name="${name}" DisplayName="${name}" Format="Dropdown"><CHOICES>${values
    .map((v) => `<CHOICE>${v}</CHOICE>`)
    .join('')}</CHOICES></Field>`,
})

export const LIST_SPECS: ListSpec[] = [
  {
    title: 'PMDC_Requests',
    versioning: true,
    fields: [
      choice('RequestStatus', STATUSES),
      text('RequesterLogin'),
      text('RequesterName'),
      text('AssigneeLogin'),
      text('AssigneeName'),
      dateTime('SubmittedAt'),
      dateTime('DueDate'),
      dateTime('CompletedAt'), // Phase 3 — provision re-run adds it to existing lists
      dateTime('ReturnedAt'), // Returned flow (2026-07-21) — SLA pause marker
      number('SlaDays'),
      note('Description'), // one-line request title — provision re-run adds it too
      // Phase 4: scratch columns for the SPD email workflow's "already
      // notified" guards (docs/WORKFLOW_RECIPE.md) — the app never reads them
      text('LastNotifiedStatus'),
      text('LastNotifiedAssignee'),
      note('RejectReason'),
      note('LineSummary'),
    ],
  },
  {
    title: 'PMDC_RequestLines',
    versioning: false,
    fields: [
      number('RequestId', true),
      choice('ObjectType', OBJECT_TYPES),
      choice('LineAction', LINE_ACTIONS),
      number('LineOrder'),
      note('FieldData'),
    ],
  },
  {
    title: 'PMDC_Comments',
    versioning: false,
    fields: [number('RequestId', true), note('Body')],
  },
  {
    title: 'PMDC_AuditLog',
    versioning: true,
    fields: [number('RequestId', true), choice('Event', AUDIT_EVENTS), note('OldValue'), note('NewValue')],
  },
]

export const PMDC_GROUPS = {
  requester: 'PMDC Requesters',
  maintainer: 'PMDC Maintainers',
  admin: 'PMDC Admins',
} as const
