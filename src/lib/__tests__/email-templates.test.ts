import { describe, expect, it } from 'vitest'
import type { Request } from '@/domain/types'
import { buildMail, esc, type NotifyEvent } from '../email-templates'

const req: Request = {
  id: '42',
  ref: 'DCR-260042',
  description: 'New feed pump for SITE-B',
  status: 'Waiting to be started',
  requesterId: 'i:0#.w|corp\\rana',
  requesterName: 'Rana Requester',
  assigneeId: 'i:0#.w|corp\\malik',
  assigneeName: 'Malik Maintainer',
  createdAt: '2026-07-20T08:00:00.000Z',
  submittedAt: '2026-07-21T08:00:00.000Z',
  dueDate: '2026-07-26T08:00:00.000Z',
  lineSummary: '1 Equipment (1 Add)',
}

const ALL: NotifyEvent[] = [
  { kind: 'submitted' },
  { kind: 'resubmitted' },
  { kind: 'assigned' },
  { kind: 'returned', reason: 'Cost center is missing' },
  { kind: 'rejected', reason: 'Duplicate of DCR-260011' },
  { kind: 'completed' },
  { kind: 'withdrawn' },
  { kind: 'comment', author: 'Aya Admin', body: 'Keyed batch 1 today.' },
]

const LINK = 'https://sp/sites/x/ss/app/index.aspx#/requests/42'

describe('esc', () => {
  it('escapes every character that could break out of the markup', () => {
    expect(esc(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    )
  })
})

describe('buildMail', () => {
  it('every event produces a non-empty subject carrying the ref', () => {
    for (const event of ALL) {
      const { subject } = buildMail(event, req, LINK)
      expect(subject, event.kind).toContain(req.ref)
      expect(subject.length, event.kind).toBeGreaterThan(req.ref.length)
    }
  })

  it('every event links back to the request', () => {
    for (const event of ALL) {
      expect(buildMail(event, req, LINK).html, event.kind).toContain(`href="${LINK}"`)
    }
  })

  it('every event reports the request context (status, people, due, lines)', () => {
    for (const event of ALL) {
      const { html } = buildMail(event, req, LINK)
      expect(html, event.kind).toContain('Rana Requester')
      expect(html, event.kind).toContain('Malik Maintainer')
      expect(html, event.kind).toContain('Waiting to be started')
      expect(html, event.kind).toContain('2026-07-26')
      expect(html, event.kind).toContain('1 Equipment (1 Add)')
    }
  })

  it('carries the reason for returned and rejected', () => {
    expect(buildMail({ kind: 'returned', reason: 'Cost center is missing' }, req, LINK).html).toContain(
      'Cost center is missing',
    )
    expect(buildMail({ kind: 'rejected', reason: 'Duplicate of DCR-260011' }, req, LINK).html).toContain(
      'Duplicate of DCR-260011',
    )
  })

  it('carries the comment author and body', () => {
    const { subject, html } = buildMail(
      { kind: 'comment', author: 'Aya Admin', body: 'Keyed batch 1 today.' },
      req,
      LINK,
    )
    expect(subject).toContain('New comment')
    expect(html).toContain('Aya Admin')
    expect(html).toContain('Keyed batch 1 today.')
  })

  it('distinguishes a first submit from a resubmit', () => {
    expect(buildMail({ kind: 'submitted' }, req, LINK).subject).toContain('New request')
    expect(buildMail({ kind: 'resubmitted' }, req, LINK).subject).toContain('resubmitted')
  })

  it('escapes user content instead of injecting it as markup', () => {
    const nasty: Request = { ...req, description: '<img src=x onerror=alert(1)>' }
    const { subject, html } = buildMail({ kind: 'comment', author: 'A', body: '</td></table><b>x' }, nasty, LINK)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
    expect(html).not.toContain('</td></table><b>x')
    // the subject is plain text and may hold raw characters, but must not be empty
    expect(subject).toContain(req.ref)
  })

  it('falls back to the ref and placeholders when optional fields are empty', () => {
    const bare: Request = {
      ...req,
      description: '',
      assigneeId: undefined,
      assigneeName: undefined,
      dueDate: undefined,
      lineSummary: '',
    }
    const { html } = buildMail({ kind: 'submitted' }, bare, LINK)
    expect(html).toContain('Unassigned')
    expect(html).toContain('—')
    expect(html).toContain(bare.ref)
  })

  it('uses tables and inline styles only — no stylesheet or flex/grid (Outlook)', () => {
    const { html } = buildMail({ kind: 'submitted' }, req, LINK)
    expect(html).not.toContain('<style')
    expect(html).not.toContain('class=')
    expect(html).not.toContain('display:flex')
    expect(html).not.toContain('display:grid')
    expect(html).toContain('<table')
  })
})
