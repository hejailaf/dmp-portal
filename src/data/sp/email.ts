import type { Request } from '@/domain/types'
import { buildMail, type NotifyEvent } from '@/lib/email-templates'
import { listPath, spGet, spPost, spPostVerbose } from './client'
import { PMDC_GROUPS, REQUESTS_LIST } from './schema'

// Notification transport. The app sends its own mail through SharePoint's
// SendEmail service method — no SharePoint Designer workflow, no Workflow
// Manager, and no LastNotified* guard columns (nothing re-triggers itself).
//
// Farm dependency: outgoing email must be configured on the farm. Without it
// nothing here sends — exactly as no workflow could.
//
// VERIFY-ON-SITE: SendEmail itself is untested on this farm. Every failure is
// swallowed by notify() so a dead mail path can never break a transition that
// already committed.

const SEND_EMAIL = '/_api/SP.Utilities.Utility.SendEmail'

/** OData string literal: double the quotes, then percent-encode for the URL. */
const odataLiteral = (value: string) => encodeURIComponent(value.replace(/'/g, "''"))

/**
 * The REQUESTER's address, read from the item's `Author` — the Person lookup
 * SharePoint maintains itself. The app creates the item AS the requester, so
 * Author IS the requester.
 *
 * Deliberately not a `siteusers` lookup by claims login: requesters reach this
 * site through a large nested AD group, and matching that login string is the
 * brittle step. An Author lookup cannot miss — the entry has to exist for the
 * item to have been created at all.
 */
export async function requesterEmail(requestId: string): Promise<string | undefined> {
  try {
    const data = await spGet(
      `${listPath(REQUESTS_LIST)}/items(${Number(requestId)})?$select=Author/EMail&$expand=Author`,
    )
    return (data?.Author?.EMail as string) || undefined
  } catch {
    return undefined // unresolvable recipient is not worth failing an action over
  }
}

// the maintainer roster is small and stable within a session
let maintainersPromise: Promise<{ login: string; email: string }[]> | undefined

/**
 * Members of a SharePoint group with a usable address.
 * NOTE: a nested AD security group appears as ONE entry with no Email, so its
 * members cannot be reached this way — if PMDC Maintainers is an AD group
 * rather than direct members, point that notification at a distribution list.
 * (Requesters are unaffected: they are addressed individually via Author.)
 */
export async function groupMembers(group: string): Promise<{ login: string; email: string }[]> {
  try {
    const data = await spGet(
      `/_api/web/sitegroups/getbyname('${odataLiteral(group)}')/users?$select=Email,LoginName&$top=500`,
    )
    return ((data.value ?? []) as { Email?: string; LoginName?: string }[])
      .filter((u) => u.Email && u.LoginName)
      .map((u) => ({ login: u.LoginName as string, email: u.Email as string }))
  } catch {
    return []
  }
}

/** Maintainers, cached per session — the source for every assignee address. */
function maintainers(): Promise<{ login: string; email: string }[]> {
  return (maintainersPromise ??= groupMembers(PMDC_GROUPS.maintainer))
}

/**
 * Send one mail. Tries nometadata (this farm's proven dialect) and falls back
 * to verbose + the typed __metadata that service methods historically demand,
 * so whichever the farm wants, the first real send discovers it.
 */
export async function sendMail(to: string[], subject: string, html: string): Promise<void> {
  const props = { To: { results: to }, Subject: subject, Body: html }
  try {
    await spPost(SEND_EMAIL, { properties: props })
  } catch {
    await spPostVerbose(SEND_EMAIL, {
      properties: { __metadata: { type: 'SP.Utilities.EmailProperties' }, ...props },
    })
  }
}

/**
 * Absolute link to a request, derived from the page actually being served —
 * never a hardcoded site/library path (that is what broke the site-home button
 * and what would have broken every workflow email's deep link).
 */
export function linkToRequest(id: string): string {
  return `${window.location.href.split('#')[0]}#/requests/${id}`
}

/**
 * Who hears about this event — never the person who caused it.
 * Actor exclusion compares LOGINS (exact) before any address is resolved.
 */
async function recipients(event: NotifyEvent, req: Request, actorId: string): Promise<string[]> {
  if (event.kind === 'submitted') {
    return (await maintainers()).filter((m) => m.login !== actorId).map((m) => m.email)
  }
  const toRequester =
    (event.kind === 'returned' ||
      event.kind === 'rejected' ||
      event.kind === 'completed' ||
      event.kind === 'comment') &&
    req.requesterId !== actorId
  const toAssignee =
    (event.kind === 'assigned' ||
      event.kind === 'resubmitted' ||
      event.kind === 'withdrawn' ||
      event.kind === 'comment') &&
    !!req.assigneeId &&
    req.assigneeId !== actorId

  const out: string[] = []
  if (toRequester) {
    const email = await requesterEmail(req.id)
    if (email) out.push(email)
  }
  if (toAssignee) {
    const email = (await maintainers()).find((m) => m.login === req.assigneeId)?.email
    if (email) out.push(email)
  }
  return [...new Set(out)]
}

/**
 * Fire-and-forget notification. NEVER throws and never blocks: the transition
 * that triggered it has already been written, so a mail problem must not
 * surface as a failed action.
 */
export async function notify(event: NotifyEvent, req: Request, actorId: string): Promise<void> {
  try {
    const to = await recipients(event, req, actorId)
    if (to.length === 0) return
    const mail = buildMail(event, req, linkToRequest(req.id))
    await sendMail(to, mail.subject, mail.html)
  } catch {
    // deliberately silent — see the contract above
  }
}
