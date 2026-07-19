import { z } from 'zod'
import type { LineAction, ObjectType, RequestLine } from './types'
import { actionsFor, FIELD_MAP, fieldsFor, isRequired } from './field-map'
import type { FieldDef } from './field-map'

// Zod validation for line FieldData, built FROM the field map so form UI and
// data layer always enforce the same rules (spec §3). Values are stored as
// strings (they are keyed into SAP by hand anyway); number/date fields are
// validated by pattern.

function fieldSchema(fd: FieldDef, action: LineAction): z.ZodTypeAny {
  const check =
    fd.input === 'number'
      ? // whole numbers only — company SAP number fields have no decimals or signs
        { test: (v: string) => /^\d+$/.test(v), message: `${fd.label} must be a whole number` }
      : fd.input === 'date'
        ? // stored as ISO; the editor and importer convert from MM/DD/YYYY
          { test: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v), message: `${fd.label} must be a date (MM/DD/YYYY)` }
        : fd.input === 'choice'
          ? { test: (v: string) => (fd.options ?? []).includes(v), message: `${fd.label} must be one of the allowed values` }
          : { test: () => true, message: `${fd.label} is invalid` }

  const lengthMessage = `${fd.label} must be at most ${fd.maxLength} characters`
  if (isRequired(fd, action)) {
    let s = z
      .string({ required_error: `${fd.label} is required` })
      .trim()
      .min(1, `${fd.label} is required`)
    if (fd.maxLength) s = s.max(fd.maxLength, lengthMessage)
    return s.refine(check.test, check.message)
  }
  // optional: empty/missing is fine, anything else must be valid
  return z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || check.test(v), check.message)
    .refine((v) => !v || !fd.maxLength || v.length <= fd.maxLength, lengthMessage)
}

export function lineSchemaFor(objectType: ObjectType, action: LineAction) {
  const fields = fieldsFor(objectType, action)
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const fd of fields) shape[fd.key] = fieldSchema(fd, action)
  // passthrough: tolerate keys from older field-map versions in stored data
  let schema = z.object(shape).passthrough()
  if (action === 'CHANGE') {
    // a change line must actually change something beyond identifying the object
    return schema.refine(
      (data) => fields.some((f) => !f.identifier && String(data[f.key] ?? '').trim() !== ''),
      { message: 'A change line must fill in at least one field to change' },
    )
  }
  return schema
}

export interface LineValidation {
  ok: boolean
  /** per-field messages, keyed by FieldDef.key */
  fieldErrors: Record<string, string>
  /** line-level messages (e.g. the change-line rule) */
  lineErrors: string[]
}

export function validateLine(
  line: Pick<RequestLine, 'objectType' | 'action' | 'fieldData'>,
): LineValidation {
  if (!actionsFor(line.objectType).includes(line.action)) {
    return {
      ok: false,
      fieldErrors: {},
      lineErrors: [`"${FIELD_MAP[line.objectType].actionLabels[line.action]}" is not available for ${FIELD_MAP[line.objectType].label}`],
    }
  }
  const result = lineSchemaFor(line.objectType, line.action).safeParse(line.fieldData)
  if (result.success) return { ok: true, fieldErrors: {}, lineErrors: [] }
  const fieldErrors: Record<string, string> = {}
  const lineErrors: string[] = []
  for (const issue of result.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    else if (issue.path.length === 0) lineErrors.push(issue.message)
  }
  return { ok: false, fieldErrors, lineErrors }
}

/**
 * A line the user never actually filled — every field value blank (the
 * action dropdown alone doesn't count; every line has one by default).
 * Such lines are pruned at submit instead of raising validation errors.
 */
export function isEmptyLine(line: Pick<RequestLine, 'fieldData'>): boolean {
  return Object.values(line.fieldData).every((v) => !v?.trim())
}

export interface SubmitValidation {
  ok: boolean
  requestErrors: string[]
  /** keyed by line id */
  lineResults: Record<string, LineValidation>
}

export const DESCRIPTION_REQUIRED = 'Write a description of your request before submitting.'
export const DESCRIPTION_MAX_LENGTH = 60 // single-line title (user decision 2026-07-19)

export const COMMENT_MAX_LENGTH = 1000

// Attachment rules (user decision 2026-07-19): PDF, common images, emails,
// and common Office files; 100 MB; at most 6 per request. The farm's own
// upload limit and blocked-extension list still apply beneath these.
export const ATTACHMENT_MAX_SIZE = 100 * 1024 * 1024
export const ATTACHMENT_MAX_COUNT = 6
export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp',
  'msg', 'eml',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
] as const

/** `accept` attribute value for file pickers, derived from the allow-list. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

/** Returns an error message, or undefined when the file may be attached. */
export function validateAttachment(
  fileName: string,
  size: number,
  existingCount: number,
): string | undefined {
  if (existingCount >= ATTACHMENT_MAX_COUNT)
    return `A request can have at most ${ATTACHMENT_MAX_COUNT} attachments`
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  if (!(ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext))
    return `"${fileName}" is not an allowed type — attach PDF, image, email, or Office files`
  if (size > ATTACHMENT_MAX_SIZE)
    return `"${fileName}" is larger than the 100 MB attachment limit`
  return undefined
}

/** Returns an error message, or undefined when the comment body is acceptable. */
export function validateCommentBody(body: string): string | undefined {
  if (!body.trim()) return 'Comment cannot be empty'
  if (body.trim().length > COMMENT_MAX_LENGTH)
    return `Comments are limited to ${COMMENT_MAX_LENGTH.toLocaleString('en-US')} characters`
  return undefined
}

/** Everything that must hold before a draft may be submitted. */
export function validateForSubmit(lines: RequestLine[], description: string): SubmitValidation {
  const requestErrors: string[] = []
  if (!description.trim()) requestErrors.push(DESCRIPTION_REQUIRED)
  else if (description.trim().length > DESCRIPTION_MAX_LENGTH)
    requestErrors.push(`The request description is limited to ${DESCRIPTION_MAX_LENGTH} characters`)
  if (lines.length === 0) requestErrors.push('Add at least one line item before submitting')
  const lineResults: Record<string, LineValidation> = {}
  let allOk = true
  for (const line of lines) {
    const v = validateLine(line)
    lineResults[line.id] = v
    if (!v.ok) allOk = false
  }
  return { ok: allOk && requestErrors.length === 0, requestErrors, lineResults }
}
