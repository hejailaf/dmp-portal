# WORKFLOW_RECIPE.md — email notifications

> **SUPERSEDED 2026-07-24 — the app now sends its own mail.**
> Notifications moved into the app (`src/lib/email-templates.ts` +
> `src/data/sp/email.ts`), which calls SharePoint's
> `SP.Utilities.Utility.SendEmail` directly. **No SharePoint Designer, no
> Workflow Manager, no `LastNotified*` guard columns.** See
> "§A — app-sent notifications" below.
> The SPD recipe is kept as **§B**, the fallback if `SendEmail` turns out
> to be unavailable on the farm.

## §A — app-sent notifications (current design)

Sent from the browser at the moment the action commits, by the same
provider method that wrote the change. What goes out (decision
2026-07-24):

| Event | Email goes to |
|---|---|
| Submitted (Draft → Waiting) | **PMDC Maintainers** group |
| **Resubmitted after a Return** | the **assignee** only (it is still theirs) |
| Assignee set or changed | the **assignee** |
| **Returned** for changes | the **requester** (with the reason) |
| Rejected | the **requester** (with the reason) |
| Completed | the **requester** |
| **Withdrawn** | the **assignee**, so they stop work |
| **Comment added** | **requester + assignee**, minus the author |

Global rule: **the person who performed the action is never mailed about
it** — self-claiming a request does not mail you your own assignment.

Silent by design: Draft edits, In process, Reopened, and overdue
reminders (a reminder needs a scheduler; this app has no server-side
jobs — overdue lives in the UI and the dashboard).

### Properties worth knowing

- **Deep links are derived from the running page**, not hardcoded, so
  they cannot rot when the subsite or library is renamed. (The old §B
  recipe hardcoded `…/personal/<you>/pmdc/PMDCApp/…`, which is already
  wrong for the real site — subsite `ss`, library `app`.)
- **Mail can never break an action.** `notify()` swallows every failure;
  the transition has already been written when it runs.
- **Bodies are unit-tested** (`src/lib/__tests__/email-templates.test.ts`)
  — the one part of this that is verifiable without a farm.
- **Client-triggered**, so mail is only sent for actions taken in the
  app, and a browser closed mid-action can lose that one notification.
  This is the trade accepted in exchange for dropping SPD.

### On-site checks (in order)

1. **Outgoing email configured on the farm.** Same hard dependency as
   any workflow: List settings → "Alert me" on any list → change an item
   → mail arrives? If never, stop and ask IT. Nothing below matters.
2. **Send one real notification** — add a comment to a request that has
   both a requester and an assignee, as a third person. Both should get
   mail.
   - Nothing arrives → open F12 → Network, repeat, look for
     `SP.Utilities.Utility.SendEmail`. A **400/500** means the payload
     dialect was rejected; the client already retries `nometadata` then
     `verbose`, so if BOTH fail capture the response body.
   - **403** → the account may not send mail; check with IT.
3. **`PMDC Maintainers` must hold DIRECT members, not a nested AD
   security group.** Members are read via
   `/_api/web/sitegroups/getbyname('PMDC Maintainers')/users`; a nested
   AD group returns one entry with **no email**, so nobody is reachable.
   If it is an AD group, point that one notification at a distribution
   list address instead. **This affects maintainers only** — requesters
   are addressed individually and are immune (see below).
4. **Recipients need an email on their SharePoint profile** (People and
   groups shows it; it syncs from AD).

### How each address is resolved (and why)

| Recipient | Source | Field |
|---|---|---|
| Requester | the request item's `Author/EMail` | To |
| Assignee | their entry in the **PMDC Maintainers** group listing | To |
| Maintainers (submit) | the same group listing | **BCC** |

The submit fan-out uses **BCC** so the team's addresses are not published
on every request; named individuals stay in To. If a farm rejects a
message with no To, the client retries once with those recipients
visible — losing the privacy, never the notification.

Requesters reach this site through a large nested AD group, so they are
deliberately NOT looked up by claims login against `siteusers` — matching
that login string is the brittle step. `Author` is the Person lookup
SharePoint maintains itself, and the app creates the item AS the
requester, so it cannot miss: the entry has to exist for the item to have
been created. **A requester is always mailed as one person; the AD group
is never expanded and never receives mail.**

---

## §B — FALLBACK: SharePoint Designer 2013 workflow

Only if §A cannot send on this farm. Original recipe (decision
2026-07-19), covering the "core four" — note it predates Returned,
Withdrawn and comment notifications, and its deep links are stale:

| Event | Email goes to |
|---|---|
| Request submitted (status → Waiting to be started) | **PMDC Maintainers** group |
| Assignee set or changed | the **assignee** |
| Request rejected | the **requester** (with the reject reason) |
| Request completed | the **requester** |

No overdue reminders — that needs a scheduler, and this app deliberately
has no server-side jobs. Overdue lives in the app UI and dashboard.

### §B prerequisites

**Everything from here to the end of the file applies to §B ONLY.** None
of it is needed for the app-sent notifications in §A — in particular, §A
needs no SharePoint Designer and no helper columns.

1. **SharePoint Designer 2013** installed on a work PC (free Microsoft
   download; may need an IT request). It is the last SPD version and
   works fine against SharePoint Server 2019.
2. **Outgoing email is configured on the farm.** Quick check: List
   settings → "Alert me" exists on any list → set a test alert on
   PMDC_Requests, change an item, see if a mail arrives. If no mail ever
   arrives, stop and ask IT to enable outgoing email — no workflow can
   send without it.
3. **Helper columns exist**: open the app → Site setup → Verify &
   provision. It must report PMDC_Requests has `LastNotifiedStatus` and
   `LastNotifiedAssignee` (added automatically from build 202607191xxx+,
   together with CompletedAt/Description if you had not re-run it).
4. Everyone who should RECEIVE mail (maintainers, requesters in the
   pilot) has an email address on their SharePoint profile (People and
   groups shows it; it syncs from AD).
5. **Lists are visible.** If you already clicked "Hide lists from Site
   contents" (LIST_SETUP.md §7.7), SPD will not show PMDC_Requests —
   Site setup → "Show lists in Site contents" first, re-hide when done.

### ⚠ §B Step 0 — verify claims-login email resolution (5 minutes, before the rest of §B)

The app stores the requester as a claims login TEXT string
(`i:0#.w|domain\user`), not a SharePoint Person field. SPD usually
resolves this in "Send an Email → To", but farms differ — prove it
before building everything:

1. SPD → Open Site → your site URL (…/personal/<you>/pmdc).
2. Workflows → List Workflow → PMDC_Requests. Name: `PMDC Notify TEST`.
   Platform: **SharePoint 2013 Workflow** (if that platform is missing,
   pick SharePoint 2010 Workflow — everything in this recipe exists in
   both; 2010 wording differs slightly).
3. Single action: **Send an Email** → To → **Workflow Lookup** → Data
   source: Current Item → Field: `RequesterLogin` → Return field as:
   String. Subject: `claims test`. Publish.
4. Start options (Workflow Settings page): tick "Start workflow
   automatically when an item is changed" temporarily.
5. In the app (or the list), edit any request of YOURS (e.g. re-save a
   draft) → you should receive the mail.
   - **Mail arrives** → resolution works; delete the TEST workflow and
     build the real one below exactly as written.
   - **No mail / workflow error** ("user not found"): the claims prefix
     needs stripping. In the real workflow below, wherever "To:
     RequesterLogin" appears, first add: **Extract Substring from Index
     of String** → String: RequesterLogin, Index: `8` (characters —
     skips `i:0#.w|`), output to Variable:plainLogin — and use
     Variable:plainLogin in To instead.

### The real workflow — `PMDC Notify`

SPD → Workflows → List Workflow → **PMDC_Requests**. Name: `PMDC Notify`.
Platform type: SharePoint 2013 Workflow.

#### Stage: Notify

Build these blocks in order (each ⬜ is one SPD action/condition; type
the action name in the SPD search box to find it):

**Block 1 — status notifications**

```
If Current Item:RequestStatus not equals Current Item:LastNotifiedStatus
    If Current Item:RequestStatus equals Waiting to be started
        Email PMDC Maintainers            (see Email A below)
    Else if Current Item:RequestStatus equals Rejected
        Email Current Item:RequesterLogin (see Email B; claims note above)
    Else if Current Item:RequestStatus equals Completed
        Email Current Item:RequesterLogin (see Email C)
    Set LastNotifiedStatus to Current Item:RequestStatus
```

The final "Set field in current item" runs for EVERY status change
(including Draft and In process which send nothing) — that is what keeps
the guard current and makes re-runs harmless.

**Block 2 — assignment notification** (below Block 1, same stage)

```
If Current Item:AssigneeLogin is not empty
    If Current Item:AssigneeLogin not equals Current Item:LastNotifiedAssignee
        Email Current Item:AssigneeLogin  (see Email D; claims note above)
        Set LastNotifiedAssignee to Current Item:AssigneeLogin
```

**Transition to stage**: Go to End of Workflow.

#### Email contents

Use **Add or Change Lookup** in the email body for every `[..]` token.
The deep link works in every mail; replace the site path with yours:

```
https://<server>/personal/<you>/pmdc/PMDCApp/index.aspx#/requests/[%Current Item:ID%]
```

- **Email A — to: PMDC Maintainers** (type the group name in To)
  - Subject: `New request [%Current Item:Title%]: [%Current Item:Description%]`
  - Body: requester name, Description, LineSummary, DueDate, deep link.
- **Email B — rejected, to requester**
  - Subject: `[%Current Item:Title%] was rejected`
  - Body: `Reason: [%Current Item:RejectReason%]` + deep link + "you can
    reopen it as a draft from the request page".
  - ALSO add a parallel branch for status **Returned** (2026-07-21): same
    shape — Subject `[%Current Item:Title%] was returned for changes`,
    Body `What to change: [%Current Item:RejectReason%]` + deep link +
    "edit the request and resubmit it from the request page".
- **Email C — completed, to requester**
  - Subject: `[%Current Item:Title%] is completed`
  - Body: Description + deep link.
- **Email D — to assignee**
  - Subject: `[%Current Item:Title%] assigned to you: [%Current Item:Description%]`
  - Body: Description, LineSummary, DueDate, deep link.

#### Workflow settings (before publishing)

On the workflow's settings page tick BOTH:
- ✅ Start workflow automatically when an item is **created** (covers a
  submit that happens in the same session as creation)
- ✅ Start workflow automatically when an item is **changed**

Then **Publish** (ribbon). Publishing errors about the app step /
permissions can be ignored as long as Publish completes.

#### Loop safety (why this doesn't email forever)

The workflow's own "Set field" edits re-trigger it once; on that second
run both guards compare equal, nothing sends, the workflow ends. The two
LastNotified columns exist purely for this.

### Test matrix (after publishing)

| Do this in the app | Expect |
|---|---|
| Submit a draft | Maintainers group gets Email A; LastNotifiedStatus = Waiting to be started |
| Admin assigns Malik | Malik gets Email D |
| Maintainer starts work | no email; LastNotifiedStatus = In process |
| Reject it (admin) | requester gets Email B with the reason |
| Reopen + resubmit + complete | requester gets Email C |

### Troubleshooting

- **Nothing ever sends** → farm outgoing email off (prereq 2), or the
  workflow isn't published / start-on-change not ticked.
- **"User not found" in workflow history** → claims resolution (Step 0
  fallback).
- **Maintainers don't get Email A** → their accounts lack Email in the
  profile, or the To field has a typo in the group name.
- **Duplicate emails** → the guard "Set field" actions are missing or
  placed inside the wrong If branch.
- Workflow history: List settings → Workflow Settings → PMDC Notify →
  click an instance to see each action's outcome.
