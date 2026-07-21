# WORKFLOW_RECIPE.md — email notifications via SharePoint Designer 2013

Click-by-click recipe for the "core four" notifications (decision
2026-07-19):

| Event | Email goes to |
|---|---|
| Request submitted (status → Waiting to be started) | **PMDC Maintainers** group |
| Assignee set or changed | the **assignee** |
| Request rejected | the **requester** (with the reject reason) |
| Request completed | the **requester** |

No overdue reminders — that needs a scheduler, and this app deliberately
has no server-side jobs. Overdue lives in the app UI and dashboard.

## Prerequisites (check before starting)

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

## ⚠ Step 0 — verify claims-login email resolution (5 minutes, do first)

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

## The real workflow — `PMDC Notify`

SPD → Workflows → List Workflow → **PMDC_Requests**. Name: `PMDC Notify`.
Platform type: SharePoint 2013 Workflow.

### Stage: Notify

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

### Email contents

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
- **Email C — completed, to requester**
  - Subject: `[%Current Item:Title%] is completed`
  - Body: Description + deep link.
- **Email D — to assignee**
  - Subject: `[%Current Item:Title%] assigned to you: [%Current Item:Description%]`
  - Body: Description, LineSummary, DueDate, deep link.

### Workflow settings (before publishing)

On the workflow's settings page tick BOTH:
- ✅ Start workflow automatically when an item is **created** (covers a
  submit that happens in the same session as creation)
- ✅ Start workflow automatically when an item is **changed**

Then **Publish** (ribbon). Publishing errors about the app step /
permissions can be ignored as long as Publish completes.

### Loop safety (why this doesn't email forever)

The workflow's own "Set field" edits re-trigger it once; on that second
run both guards compare equal, nothing sends, the workflow ends. The two
LastNotified columns exist purely for this.

## Test matrix (after publishing)

| Do this in the app | Expect |
|---|---|
| Submit a draft | Maintainers group gets Email A; LastNotifiedStatus = Waiting to be started |
| Admin assigns Malik | Malik gets Email D |
| Maintainer starts work | no email; LastNotifiedStatus = In process |
| Reject it (admin) | requester gets Email B with the reason |
| Reopen + resubmit + complete | requester gets Email C |

## Troubleshooting

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
