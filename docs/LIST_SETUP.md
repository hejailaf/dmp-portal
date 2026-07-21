# LIST_SETUP.md — Lists, groups, and permissions (one-time, browser-only)

Everything here happens once, in the browser, on the **pmdc subsite**. Do it
in this order:

1. Create the three role groups (§1)
2. Let the app create the lists (§2 — or create them manually per §3)
3. Create the two custom permission levels and apply per-list permissions (§4)
4. Verify (§5)

---

## §1 Role groups

Gear → **Site settings** → **People and groups**. Use **New → New Group**
three times. The names must match EXACTLY (the app maps roles from them):

| Group name | Who belongs in it | Suggested "Group owner" |
|---|---|---|
| `PMDC Requesters` | End users who file requests | you |
| `PMDC Maintainers` | The Data Maintenance team | you |
| `PMDC Admins` | You (+ a deputy) | you |

Leave every other group setting at its default. Add yourself to **PMDC
Admins** now (you can also be in the other two for testing). A person may be
in several groups; their app roles combine.

## §2 Lists — the easy way (app-driven)

1. Upload the current build to the `PMDCApp` library (see DEPLOY_SP.md).
2. Open `index.aspx` — you should land on the app as yourself.
3. Top navigation → **Site setup** (visible to PMDC Admins only) →
   **Verify & provision lists**. The app creates the four lists with all
   columns and re-checks them; every row should end green (`ok`/`created`).
4. Click **Run connection self-test** — all lines should appear, ending with
   "DELETE OK". This proves the one API verb Phase 0 didn't test.

If provisioning reports errors, create the lists manually per §3 and re-run
the verify.

## §3 Lists — manual fallback

Site contents → New → **List** (blank), name it exactly, then List settings
→ Create column for each row. "Line" = single line of text; "Multi" =
multiple lines of text, **plain text**.

**PMDC_Requests** — versioning ON (List settings → Versioning settings →
Create a version each time = Yes). Attachments stay enabled (default).

| Column | Type | Notes |
|---|---|---|
| RequestStatus | Choice | Draft; Waiting to be started; In process; Completed; Rejected |
| RequesterLogin / RequesterName / AssigneeLogin / AssigneeName | Line | |
| SubmittedAt / DueDate | Date and Time | Date & Time format |
| SlaDays | Number | 0 decimals |
| RejectReason / LineSummary | Multi (plain) | |

**PMDC_RequestLines**

| Column | Type | Notes |
|---|---|---|
| RequestId | Number | 0 decimals; index it: List settings → Indexed columns → Create new index |
| ObjectType | Choice | EQUIPMENT; FLOC; BOM_LINKAGE; PM |
| LineAction | Choice | ADD; CHANGE; DELETE |
| LineOrder | Number | 0 decimals |
| FieldData | Multi (plain) | the JSON blob — never split into columns |

**PMDC_Comments** — RequestId (Number, indexed), Body (Multi plain).

**PMDC_AuditLog** — versioning ON. RequestId (Number, indexed), Event
(Choice: Created; DraftUpdated; Submitted; Assigned; StatusChanged;
Rejected; Reopened; CommentAdded; AttachmentAdded), OldValue (Multi plain),
NewValue (Multi plain).

## §4 Permissions

### 4a. Three custom permission levels (create once)

Gear → Site settings → **Site permissions**.

> **If the ribbon has no "Permission Levels" button** and a yellow banner
> says *"This Web site inherits permissions from its parent"*: click
> **Stop Inheriting Permissions** (Inheritance group) → confirm. The page
> reloads with unique permissions and the **Permission Levels** button
> appears. (Required on an inheriting subsite; on a top-level team site the
> button is already present.) Direct URL once unique: `…/_layouts/15/role.aspx`.

Then click ribbon **Permission Levels**:

1. **`PMDC Contribute (no delete)`** — click **Contribute** → Copy Permission
   Level → name it as above → UNTICK **Delete Items** and **Delete
   Versions** → Create. (Requesters can add/edit but never delete.)
2. **`PMDC Add only`** — Add a Permission Level → name it → tick these:
   under **List Permissions** — **Add Items, View Items, Open Items, View
   Application Pages**; under **Site Permissions** — **Use Remote
   Interfaces** (REQUIRED — the app's REST writes to the audit log fail for
   non-admins without it). SharePoint auto-adds **View Pages** and **Open**
   as dependencies — leave those ticked. Leave Edit/Delete unticked — that
   is what makes the audit log tamper-proof (everyone adds rows as
   themselves; nobody edits or deletes history).
3. **`PMDC Maintain`** — click **Contribute** → Copy Permission Level →
   name it as above → TICK **Manage Lists** → Create. Why: §4c below
   restricts editing to "own items only"; users holding **Manage Lists**
   bypass that restriction. Maintainers must edit request items CREATED BY
   requesters (claim, start, complete), so they get this level on
   PMDC_Requests only. (Trade-off: Manage Lists would also let a
   maintainer change that list's columns/views — acceptable for a small
   trusted team.)

### 4b. Per-list assignments

For each list: List settings → **Permissions for this list** → ribbon
**Stop Inheriting Permissions** → remove the default site groups (keep
yourself/PMDC Admins!) → **Grant Permissions** to the PMDC groups
("Show options" → untick email → pick the permission level directly):

| List | PMDC Requesters | PMDC Maintainers | PMDC Admins |
|---|---|---|---|
| PMDC_Requests | PMDC Contribute (no delete) | PMDC Maintain | Full Control |
| PMDC_RequestLines | PMDC Contribute (no delete) | Contribute | Full Control |
| PMDC_Comments | PMDC Contribute (no delete) | Contribute | Full Control |
| PMDC_AuditLog | PMDC Add only | PMDC Add only | Full Control |
| PMDCApp (library) | Read | Read | Contribute |

Also grant all three groups **Read** on the **subsite itself** (Site
settings → Site permissions → Grant Permissions) so members can reach the
library at all.

> At the SITE level, Requesters and Maintainers only need **Read** — all
> their write access comes from the list-level grants above. The "Set Up
> Groups" step maps Members → **Edit**, which over-grants Maintainers on
> still-inheriting content (e.g. the app files in PMDCApp). Optional but
> cleaner: change PMDC Maintainers' site-level level from Edit to Read.
> Admins stay Full Control.

**"Limited Access" is normal** — SharePoint auto-adds it (greyed out, can't
be assigned/removed by hand) so members can traverse to content they're
allowed to use; it grants nothing on its own. Just confirm each group ALSO
shows its real level from the table, not only Limited Access.

### 4c. Item-level permissions — nobody edits someone else's request

Without this, any requester who finds the list URL can open ANY request
in the SharePoint list UI and edit it raw, bypassing the app's rules. Fix
it with an out-of-the-box setting, on **PMDC_Requests, PMDC_RequestLines
and PMDC_Comments** (NOT the audit log — its Add-only level already
blocks edits):

List settings → **Advanced settings** → *Item-level Permissions*:
- **Read access:** keep **All items** (required: maintainers see the
  queue, ref numbering scans existing refs, requesters see maintainer
  comments).
- **Create and Edit access:** set **Create items and edit items that were
  created by the user**.

Effect: requesters can create and edit only their OWN requests/lines —
other people's items become read-only for them, in the list UI and the
API alike. Maintainers keep working the queue because `PMDC Maintain`
(Manage Lists) bypasses the restriction on PMDC_Requests; Admins bypass
everywhere via Full Control.

Two notes:
- A requester can still raw-edit their OWN request in the list UI (even
  after submitting). SharePoint has no per-status lock without a server.
  Mitigation: PMDC_Requests versioning is ON (§3) — every change is
  recorded with name + timestamp, so tampering is visible.
- After applying, re-run the workflow TEST from WORKFLOW_RECIPE.md once:
  the email workflow writes scratch columns under the editing user's
  identity and must still save.

## §5 Verify

- As yourself: Site setup screen → provision all green + self-test all green.
- Add a colleague to `PMDC Requesters` only → they open `index.aspx`: the app
  renders (non-owner rendering check!), they see the Requester home, can
  create + submit a request, CANNOT see the Site setup nav, and deleting is
  nowhere offered.
- As a `PMDC Maintainers` member: unassigned pool shows the submitted
  request; claim → start → complete works; audit trail fills in.

## §6 Access at scale — AD security groups (added 2026-07-19)

For large requester populations (e.g. a 1,000-member department), do NOT
add people one by one:

1. Open People and groups → `PMDC Requesters` → New → Add Users → enter
   the **AD security group** name → OK. Permissions flow to every member
   automatically (SharePoint expands AD groups for authorization).
2. Role detection for these users works via a permission probe, not group
   membership: the app treats "may add items to PMDC_Requests"
   (EffectiveBasePermissions, AddListItems bit) as the Requester role.
   Verified on-site 2026-07-19 (AD member: High=432, Low=1011028583 =
   contribute, no delete). The probe only runs for users with no direct
   PMDC group membership.
3. Maintainers and Admins must remain DIRECT members of their groups —
   the app maps those roles by group name only. They are few; keep it so.
4. Group settings for all three PMDC groups: "Who can view the membership
   of the group" = **Everyone** — otherwise directly-added members show
   "No PM DataCare role" (the membership API hides groups the caller cannot view).

## §7 Hardening — only Admins can edit anything (added 2026-07-21)

§4 already gives each role its minimum on the LISTS. These extra steps
close the remaining doors so nothing on the site is editable except by
PMDC Admins (i.e. you):

1. **Keep `PMDC Admins` tiny** — you plus at most one deputy. Every
   edit-anything right on the site should trace back to this one group.
2. **Prune the default groups.** Subsite creation also made
   `<site> Owners / Members / Visitors`. On Site permissions:
   - remove the **Members** grant (it carries Edit — the over-grant §4b
     warns about), or change it to **Read** if those people should still
     open the app;
   - leave **Owners** empty except you, or remove its grant entirely
     (you're covered by PMDC Admins);
   - Visitors at Read is harmless — keep or remove.
   The three PMDC groups + per-list grants carry ALL real access.
3. **Site level = Read for everyone but Admins.** PMDC Requesters and
   Maintainers get exactly **Read** on the subsite (§4b) — never Edit or
   Contribute at site scope. All their write ability comes from the
   per-list grants.
4. **The app library (`PMDCApp`) is already write-locked**: Requesters
   and Maintainers have Read only (§4b table). Nobody but Admins can
   replace `index.aspx` or the assets — i.e. nobody else can tamper with
   the app code users run.
5. **Turn off re-sharing.** Site permissions → ribbon **Access Request
   Settings** → UNTICK "Allow members to share the site and individual
   files and folders". Optionally point access requests at your email so
   join-requests reach you instead of failing silently.
6. **Audit log stays tamper-proof** by §4's "PMDC Add only" level:
   everyone (including maintainers) can only append; only Admins could
   ever edit/delete history — and shouldn't.
7. **Hide the lists from Site contents** — Site setup screen → **"Hide
   lists from Site contents"**. Cosmetic (direct URLs and the API still
   work; §4c is the real protection) but keeps requesters from stumbling
   into raw list views. Do this LAST — after the email workflow is built:
   SharePoint Designer does not show hidden lists, so click **"Show lists
   in Site contents"** before any workflow edit and re-hide after.

What this does NOT protect against (know the limits):
- **Site collection admins** of the parent collection bypass every grant
  here — that's SharePoint's design. On a team site those are IT's
  accounts; choose the parent accordingly.
- **Draft privacy is app-level.** Read access stays "All items" (§4c —
  the queue, ref numbering and comments need it), so any Requester can
  technically READ all list items via the REST API. §4c blocks them from
  EDITING anything that isn't theirs, but the app hiding other people's
  drafts is filtering, not a permission. Acceptable for master-data
  requests; don't put secrets in drafts.
