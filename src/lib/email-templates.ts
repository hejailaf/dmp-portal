import type { Request } from '@/domain/types'

// Notification email bodies. PURE: domain types in, {subject, html} out — no
// SharePoint, no React, no window — so the whole email surface is unit-testable
// at home (the farm is the one place we cannot iterate).
//
// Email HTML is NOT web HTML: Outlook renders with the Word engine, so this is
// deliberately tables + inline styles, no flexbox/grid, no stylesheet. Colours
// are the Aramco palette hardcoded (the app's CSS variables cannot reach here).

const NAVY = '#0033A0'
const TEAL = '#26A8AB'
const INK = '#1c1c1a'
const MUTED = '#5f5e5a'
const LINE = '#d8d8d4'
const CANVAS = '#f4f4f2'

/** Copy lives here rather than app/strings.ts — this is mail content, not UI chrome. */
const T = {
  product: 'PM DataCare',
  tagline: 'SAP PM master data',
  open: 'Open the request',
  requester: 'Requester',
  assignee: 'Assignee',
  status: 'Status',
  due: 'Due date',
  lines: 'Line items',
  unassigned: 'Unassigned',
  none: '—',
  footer: 'You are receiving this because you are involved in this request.',
}

export interface Mail {
  subject: string
  html: string
}

/** What happened. `actor` is only used for wording, never for addressing. */
export type NotifyEvent =
  | { kind: 'submitted' }
  | { kind: 'resubmitted' }
  | { kind: 'assigned' }
  | { kind: 'returned'; reason: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'completed' }
  | { kind: 'withdrawn' }
  | { kind: 'comment'; author: string; body: string }

/** Escape anything that reaches the HTML — descriptions, reasons, names, comments. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const row = (label: string, value: string) => `
        <tr>
          <td style="padding:4px 0;color:${MUTED};font-size:12px;width:110px;">${esc(label)}</td>
          <td style="padding:4px 0;color:${INK};font-size:13px;">${esc(value)}</td>
        </tr>`

/** A quoted block for a reason or a comment body (preserves line breaks). */
const quote = (heading: string, text: string) => `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">
        <tr>
          <td style="border-left:3px solid ${TEAL};background:${CANVAS};padding:10px 12px;">
            <div style="color:${MUTED};font-size:11px;text-transform:uppercase;letter-spacing:.06em;">${esc(heading)}</div>
            <div style="color:${INK};font-size:13px;margin-top:4px;white-space:pre-wrap;">${esc(text)}</div>
          </td>
        </tr>
      </table>`

function headline(event: NotifyEvent, req: Request): { subject: string; lead: string } {
  const ref = req.ref
  const desc = req.description || ref
  switch (event.kind) {
    case 'submitted':
      return { subject: `New request ${ref}: ${desc}`, lead: 'A new request needs a maintainer.' }
    case 'resubmitted':
      return {
        subject: `${ref} was resubmitted: ${desc}`,
        lead: 'The requester made the requested changes and resubmitted this request.',
      }
    case 'assigned':
      return { subject: `${ref} assigned to you: ${desc}`, lead: 'This request is now assigned to you.' }
    case 'returned':
      return {
        subject: `${ref} was returned for changes`,
        lead: 'Your request needs changes before it can be worked on. Edit it and resubmit — no need to start over.',
      }
    case 'rejected':
      return {
        subject: `${ref} was rejected`,
        lead: 'Your request was rejected. You can reopen it as a draft from the request page.',
      }
    case 'completed':
      return { subject: `${ref} is completed`, lead: 'Your request has been completed in SAP.' }
    case 'withdrawn':
      return {
        subject: `${ref} was withdrawn by the requester`,
        lead: 'The requester pulled this request back, so no further work is needed on it.',
      }
    case 'comment':
      return {
        subject: `New comment on ${ref}: ${desc}`,
        lead: `${event.author} added a comment.`,
      }
  }
}

/**
 * Build the mail for an event. `link` is the absolute URL of the request in the
 * app — the caller derives it from the running page, so it can never point at a
 * stale subsite or library name.
 */
export function buildMail(event: NotifyEvent, req: Request, link: string): Mail {
  const { subject, lead } = headline(event, req)
  const extra =
    event.kind === 'returned'
      ? quote('What to change', event.reason)
      : event.kind === 'rejected'
        ? quote('Reason', event.reason)
        : event.kind === 'comment'
          ? quote(`${event.author} wrote`, event.body)
          : ''

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${CANVAS};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};">
      <tr><td style="height:3px;background:${TEAL};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:16px 24px 0 24px;">
        <span style="color:${NAVY};font-size:15px;font-weight:bold;">${T.product}</span>
        <span style="color:${MUTED};font-size:12px;"> · ${T.tagline}</span>
      </td></tr>
      <tr><td style="padding:12px 24px 0 24px;">
        <div style="color:${MUTED};font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${esc(req.ref)}</div>
        <div style="color:${INK};font-size:19px;font-weight:bold;padding-top:2px;">${esc(req.description || req.ref)}</div>
        <div style="color:${MUTED};font-size:13px;padding-top:8px;">${esc(lead)}</div>
      </td></tr>
      <tr><td style="padding:8px 24px 0 24px;">${extra}</td></tr>
      <tr><td style="padding:4px 24px 0 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid ${LINE};padding-top:8px;">${row(T.status, req.status)}${row(T.requester, req.requesterName)}${row(T.assignee, req.assigneeName || T.unassigned)}${row(T.due, req.dueDate ? req.dueDate.slice(0, 10) : T.none)}${row(T.lines, req.lineSummary || T.none)}
        </table>
      </td></tr>
      <tr><td style="padding:20px 24px 24px 24px;">
        <a href="${esc(link)}" style="background:${NAVY};color:#ffffff;font-size:14px;text-decoration:none;padding:10px 18px;display:inline-block;">${T.open}</a>
      </td></tr>
      <tr><td style="padding:0 24px 20px 24px;color:${MUTED};font-size:11px;border-top:1px solid ${LINE};padding-top:12px;">${T.footer}</td></tr>
    </table>
  </td></tr>
</table>`

  return { subject, html }
}
