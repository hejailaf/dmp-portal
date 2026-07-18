# LIST_SETUP.md — Lists, groups, and permissions (one-time, browser-only)

Everything here happens once, in the browser, on the **dmp subsite**. Do it
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
| `DMP Requesters` | End users who file requests | you |
| `DMP Maintainers` | The Data Maintenance team | you |
| `DMP Admins` | You (+ a deputy) | you |

Leave every other group setting at its default. Add yourself to **DMP
Admins** now (you can also be in the other two for testing). A person may be
in several groups; their app roles combine.

## §2 Lists — the easy way (app-driven)

1. Upload the current build to the `DMPApp` library (see DEPLOY_SP.md).
2. Open `index.aspx` — you should land on the app as yourself.
3. Top navigation → **Site setup** (visible to DMP Admins only) →
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

**DMP_Requests** — versioning ON (List settings → Versioning settings →
Create a version each time = Yes). Attachments stay enabled (default).

| Column | Type | Notes |
|---|---|---|
| RequestStatus | Choice | Draft; Waiting to be started; In process; Completed; Rejected |
| RequesterLogin / RequesterName / AssigneeLogin / AssigneeName | Line | |
| SubmittedAt / DueDate | Date and Time | Date & Time format |
| SlaDays | Number | 0 decimals |
| RejectReason / LineSummary | Multi (plain) | |

**DMP_RequestLines**

| Column | Type | Notes |
|---|---|---|
| RequestId | Number | 0 decimals; index it: List settings → Indexed columns → Create new index |
| ObjectType | Choice | EQUIPMENT; FLOC; BOM_LINKAGE; PM |
| LineAction | Choice | ADD; CHANGE; DELETE |
| LineOrder | Number | 0 decimals |
| FieldData | Multi (plain) | the JSON blob — never split into columns |

**DMP_Comments** — RequestId (Number, indexed), Body (Multi plain).

**DMP_AuditLog** — versioning ON. RequestId (Number, indexed), Event
(Choice: Created; DraftUpdated; Submitted; Assigned; StatusChanged;
Rejected; Reopened; CommentAdded; AttachmentAdded), OldValue (Multi plain),
NewValue (Multi plain).

## §4 Permissions

### 4a. Two custom permission levels (create once)

Gear → Site settings → **Site permissions**.

> **If the ribbon has no "Permission Levels" button** and a yellow banner
> says *"This Web site inherits permissions from its parent"*: click
> **Stop Inheriting Permissions** (Inheritance group) → confirm. The page
> reloads with unique permissions and the **Permission Levels** button
> appears. (Required on an inheriting subsite; on a top-level team site the
> button is already present.) Direct URL once unique: `…/_layouts/15/role.aspx`.

Then click ribbon **Permission Levels**:

1. **`DMP Contribute (no delete)`** — click **Contribute** → Copy Permission
   Level → name it as above → UNTICK **Delete Items** and **Delete
   Versions** → Create. (Requesters can add/edit but never delete.)
2. **`DMP Add only`** — Add a Permission Level → name it → tick these:
   under **List Permissions** — **Add Items, View Items, Open Items, View
   Application Pages**; under **Site Permissions** — **Use Remote
   Interfaces** (REQUIRED — the app's REST writes to the audit log fail for
   non-admins without it). SharePoint auto-adds **View Pages** and **Open**
   as dependencies — leave those ticked. Leave Edit/Delete unticked — that
   is what makes the audit log tamper-proof (everyone adds rows as
   themselves; nobody edits or deletes history).

### 4b. Per-list assignments

For each list: List settings → **Permissions for this list** → ribbon
**Stop Inheriting Permissions** → remove the default site groups (keep
yourself/DMP Admins!) → **Grant Permissions** to the DMP groups
("Show options" → untick email → pick the permission level directly):

| List | DMP Requesters | DMP Maintainers | DMP Admins |
|---|---|---|---|
| DMP_Requests | DMP Contribute (no delete) | Contribute | Full Control |
| DMP_RequestLines | DMP Contribute (no delete) | Contribute | Full Control |
| DMP_Comments | DMP Contribute (no delete) | Contribute | Full Control |
| DMP_AuditLog | DMP Add only | DMP Add only | Full Control |
| DMPApp (library) | Read | Read | Contribute |

Also grant all three groups **Read** on the **subsite itself** (Site
settings → Site permissions → Grant Permissions) so members can reach the
library at all.

**"Limited Access" is normal** — SharePoint auto-adds it (greyed out, can't
be assigned/removed by hand) so members can traverse to content they're
allowed to use; it grants nothing on its own. Just confirm each group ALSO
shows its real level from the table, not only Limited Access.

Check on DMP_Requests and DMP_RequestLines: List settings → Advanced
settings → "Read access / Create and Edit access" must remain **All items**
(maintainers edit items created by requesters).

## §5 Verify

- As yourself: Site setup screen → provision all green + self-test all green.
- Add a colleague to `DMP Requesters` only → they open `index.aspx`: the app
  renders (non-owner rendering check!), they see the Requester home, can
  create + submit a request, CANNOT see the Site setup nav, and deleting is
  nowhere offered.
- As a `DMP Maintainers` member: unassigned pool shows the submitted
  request; claim → start → complete works; audit trail fills in.
