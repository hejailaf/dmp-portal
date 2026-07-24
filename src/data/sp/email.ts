import type { Request } from '@/domain/types'
import { buildMail, type NotifyEvent } from '@/lib/email-templates'
import { spGet, spPost, spPostVerbose } from './client'
import { PMDC_GROUPS } from './schema'

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

// logins rarely change within a session; resolving costs a round trip each
const emailCache = new Map<string, string | undefined>()

/**
 * Email address for a claims login (`i:0#.w|domain\user`). Read-only lookup —
 * deliberately NOT ensureuser, which would WRITE the user into the site.
 */
export async function emailForLogin(login: string): Promise<string | undefined> {
  if (emailCache.has(login)) return emailCache.get(login)
  let email: string | undefined
  try {
    const data = await spGet(
      `/_api/web/siteusers?$select=Email,LoginName&$filter=LoginName eq '${odataLiteral(login)}'&$top=1`,
    )
    email = ((data.value ?? []) as { Email?: string }[])[0]?.Email || undefined
  } catch {
    email = undefined // unresolvable recipient is not an error worth failing on
  }
  emailCache.set(login, email)
  return email
}

/**
 * Members of a SharePoint group with a usable address.
 * NOTE: a nested AD security group appears as ONE entry with no Email, so its
 * members cannot be reached this way — if PMDC Maintainers is an AD group
 * rather than direct members, point that notification at a distribution list.
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

/** Who hears about this event — never the person who caused it. */
async function recipients(event: NotifyEvent, req: Request, actorId: string): Promise<string[]> {
  if (event.kind === 'submitted') {
    const members = await groupMembers(PMDC_GROUPS.maintainer)
    return members.filter((m) => m.login !== actorId).map((m) => m.email)
  }
  const logins =
    event.kind === 'assigned' || event.kind === 'resubmitted' || event.kind === 'withdrawn'
      ? [req.assigneeId]
      : event.kind === 'comment'
        ? [req.requesterId, req.assigneeId]
        : [req.requesterId] // returned, rejected, completed
  const wanted = [...new Set(logins.filter((l): l is string => !!l && l !== actorId))]
  const resolved = await Promise.all(wanted.map(emailForLogin))
  return resolved.filter((e): e is string => !!e)
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
