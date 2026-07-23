# CLAUDE.md — PM DataCare (internally DMP)

Display name: **PM DataCare** — "Caring for your SAP PM master data"
(renamed 2026-07-18 from "Data Maintenance Portal"). SharePoint artifacts
use `PMDC` prefix — `PMDC_*` lists, `PMDC *` groups, `PMDCApp` library,
`PMDC *` permission levels (renamed from DMP 2026-07-21, bound to
new-subsite move: PMDC build only works on site provisioned with PMDC
names — old personal-site subsite needs pre-rename build until retired).
Only internals keep DMP codename (repo name, `dmp-sp.zip`, localStorage
keys, spec filename). Request refs `DCR-YYNNNN` (brand restyle
2026-07-18; legacy `REQ-` refs ignored by `nextRef`).

Full spec: `docs/DMP_FROM_SCRATCH_PROMPT.md`. Approved plan + decisions:
this file. Read both before changing anything.

## What this is

Internal CRM-style portal: end users submit change requests for SAP
Plant Maintenance (PM) master data, Data Maintenance team executes
**manually in SAP Fiori MDG**. App NEVER integrates with SAP — intake,
tracking, assignment, SLA, audit, Excel export only.

## Hard constraints (spec §2 — never violate)

- Target: **SharePoint Server 2019 on-prem**, internal network only.
- Static SPA in SharePoint **document library**. No server: no Node
  backend, no DB, no cloud, no Power Automate, no SPFx.
- **SharePoint lists are the database** via SP2019 REST (same origin).
- Windows auth; identity from `/_api/web/currentuser`, roles from groups
  `PMDC Requesters` / `PMDC Maintainers` / `PMDC Admins`.
- Entry page **`index.aspx`** (Strict file handling downloads `.html`).
- Developer has **no terminal, no internet at work** — deploy =
  drag-and-drop browser upload. App must run fully offline on
  MockProvider.
- No runtime calls to public internet (no CDN fonts, no telemetry).
- Target browsers: modern Edge/Chrome (user decision — no IE11).

## Working rules (spec §11)

1. Ask before adding dependency beyond locked stack (React 18, TS, Vite,
   Tailwind, shadcn/ui + transitive deps, TanStack Table, Zod, exceljs,
   Vitest).
2. `src/domain` pure TypeScript — no React, no SharePoint imports.
   Single source of truth: statuses, field map, validation, SLA.
3. Keep tests green (`npm test`): state machine, SLA math, field-map
   validation.
4. Never claim works on SP2019 without Phase-0 verification or
   `VERIFY-ON-SITE` marker in code + check in spike panel.
5. Keep `docs/` current at end of each phase.

## Architecture

- `src/domain` — types, status state machine, SLA engine, ref numbering,
  config-driven field map (`field-map/*.ts`, one file per object type),
  Zod schemas derived FROM field map. Unit-tested.
- `src/data` — `DataProvider` interface (`provider.ts`); `mock/`
  (in-memory + localStorage, seeded, role switcher) and `sp/`. Selected
  by `VITE_DATA_PROVIDER` (default `mock`).
- `src/app` — React UI. Hand-rolled hash router (`router.ts` — path
  routing can't work from doc library). All strings in `strings.ts`.
- `src/spike` — Phase 0 diagnostics page (own Vite entry → `spike.aspx`).
- `scripts/package-sp.mjs` — dist → dist-sp (.aspx pages, `?v=BUILD`
  cache-busting; filenames fixed/unhashed) + zip.

## Domain rules

- Statuses: `Draft → Waiting to be started → In process → Completed`;
  `Rejected` from Waiting/In process (reason required); `Rejected →
  Draft` (reopen — user decision). `Returned` from Waiting/In process
  (user decision 2026-07-21): assigned maintainer/admin sends back with
  reason; requester EDITS DIRECTLY (no reopen), resubmits → Waiting
  (assignee kept). Reject RESETS dates on reopen+resubmit; Return PAUSES
  SLA — submittedAt stays, dueDate grows by returned interval
  (`extendDueDate`, `returnedAt` field / ReturnedAt column; reason
  shares RejectReason; isOverdue false while Returned). Only Completed
  terminal. DISPLAY (2026-07-21, `S.statusLabel`): stored "Waiting to
  be started" reads "Assigned" once assigned; while unassigned reads BY
  VIEWER — "Submitted" to requesters, "Unassigned" to staff
  (maintainer/admin) — stored value/choice column unchanged. Stepper
  track: Draft → Submitted|Unassigned → Assigned → In process →
  Completed.
- Transition permissions in `src/domain/status.ts` TRANSITIONS table:
  submit/reopen/resubmit = owning requester or admin;
  start/complete/return = assigned maintainer or admin; **reject =
  admin only** (spec-literal).
- Assignment: admins assign anyone; maintainers self-claim unassigned
  (user decision). Enforced in providers, not just UI.
- Roles: groups first; user with NO direct PMDC group → SP provider
  probes EffectiveBasePermissions on PMDC_Requests, grants `requester`
  when AddListItems bit set — how 1,000-member AD security groups nested
  in `PMDC Requesters` work (on-site verified 2026-07-19, pre-rename;
  see LIST_SETUP.md §6). Maintainer/admin group-name-only. All three
  groups need "view membership: Everyone" or direct members read
  role-less.
- SLA: `DueDate = SubmittedAt + max(SlaDays per line action)`; defaults
  Add 5 / Change 3 / Delete 2 (config `src/domain/sla.ts`). Overdue
  DERIVED at render — no scheduled jobs. Resubmit after reopen
  recomputes SLA, clears old reject reason.
- Refs `DCR-YYNNNN` computed client-side from existing refs (create
  time); tiny collision window accepted + re-check/retry planned for SP
  provider (plan decision).
- Line SAP fields in one JSON blob (`FieldData`) validated by Zod —
  never mirrored as SharePoint columns.
- Drafts visible only to requester + admins.
- Request `description`: ONE-LINE title. Convention (user decision
  2026-07-21): reference docs (MOC/WO/etc.) → ATTACHMENTS, remarks →
  COMMENTS — never in description; keep demo/seed descriptions free of
  reference codes. ≤60 chars (`DESCRIPTION_MAX_LENGTH`), free while
  drafting, REQUIRED at submit — enforced in
  `validateForSubmit(lines, description)`, thus BOTH providers + editor
  (single-line Input with counter). Stored as `Description` note column.
  Detail header (variant A, 2026-07-19): description = truncating
  headline, ref = small label, meta = divided strip (Requester/Assignee/
  Submitted/Changed/[Completed]/Due) — "Changed" DERIVED from newest
  audit entry (every action writes one), not stored column; no Created,
  no SLA suffix (SLA badge covers it).
- Comments: ≤1000 chars (`validateCommentBody`, both providers +
  composer maxLength). Attachments (user decisions 2026-07-19):
  allow-list pdf/images/msg+eml/Office, ≤100 MB, ≤6 per request
  (`validateAttachment`, both providers + UI); STAGED uploads — picks
  live in browser state with remove ✕ until explicit Upload button
  commits (reload discards pending; no server-side delete — would need
  delete rights requesters intentionally lack).
- Line data NORMALIZED at every provider boundary —
  `normalizeFieldData(objectType, action, fieldData)` (derive first,
  then drop values for fields action doesn't use; unknown keys/object
  types/actions pass through). Applied on READ (`sp/mapping.mapLine`,
  mock `loadDb` — cleans rows stored before 2026-07-20, no migration)
  and WRITE (`replaceLines`, `writeLines`). Excel export masks
  non-applicable cells itself: sheet keyed into SAP, never trusts
  boundary. Editor state deliberately NOT pruned on action change
  (mis-clicked dropdown recoverable); saving/submitting asks first when
  values dropped, Duplicate copies only visible values (user decisions
  2026-07-20).
- Both providers validate + check transition BEFORE deleting empty lines
  at submit — rejected submit must never destroy rows.
- Empty (never-filled) lines pruned at submit — editor AND provider
  (`isEmptyLine`); Phase-2 SharePointProvider must prune too. Drafts
  keep scratch rows.
- Field map = COMPANY set (review 2026-07-17, applied from
  `field-map-review.csv` — regenerate with
  `npx vite-node scripts/export-field-map.ts` after config edits). Key
  decisions: FLoc identifier shown/required only on Change/Delete; BOM
  offers only Add/Delete (`actions` on ObjectTypeConfig), links to
  equipment only; PM Change/Delete identified by Maintenance Item;
  several SAP number fields strict numeric validation.
- Excel line import/export templates (`src/lib/excel-lines.ts`): ONE
  unified workbook, sheet per object type (`makeUnifiedTemplate` /
  `parseUnifiedTemplate`, ux-experiments 2026-07-21) — importer reads
  ALL recognizable sheets, several types mass-import at once; old
  single-sheet files still import by sheet name. Editor download opens
  on active tab's sheet (workbook.views activeTab); home page Excel card
  downloads directly. Both derived from field map. exceljs = lazy
  chunk — keep out of main bundle. Template sheet UNPROTECTED (user
  decision 2026-07-21): grey banner + amber Action header advise layout
  rules; importer validates everything.
- Equipment classification DERIVED: users pick only Equipment Type;
  correlation table (`src/domain/field-map/equipment-types.ts`,
  GENERATED from `docs/tech_object_types.xlsx` via
  `npx vite-node scripts/import-equipment-types.ts`) fills
  category/object type/catalog profile through `applyDerivations`.
  Derived fields (`derived: true` in FieldDef) hidden in editor + Excel
  template, visible on detail grids + Phase-3 export. Derivation applied
  in editor, Excel importer, MockProvider.replaceLines — Phase-2
  SharePointProvider MUST apply on write too.

## Phase status

- ✅ Phase 0 PASSED on-site (2026-07-19), all 5 checks green. Findings
  binding Phase 2: **nometadata works for ALL writes** (list create,
  item create, MERGE — no `__metadata`/verbose); digest timeout
  **1800s**; claims-style login names (`i:0#.w|domain\user`); site =
  **subsite with unique permissions under user's personal site
  collection** (`/personal/<user>/pmdc` — user renamed subsite URL
  segment from `dmp` 2026-07-19; display names "PM DataCare" /
  "PM DataCare App") — works, flagged to migrate to team site before
  broad rollout (personal site collections tied to owner account).
  Rendering blocked on parent site was permission-level, not farm-level;
  untested: person-field writes (avoided — see Phase 2 notes).
- ✅ Phase 1 built: domain + tests, MockProvider + seed, full UI (home,
  lists, AIW editor, detail with comments/audit). Verified end-to-end in
  browser, all three roles.
- ✅ Phase 2 VERIFIED ON-SITE (2026-07-19): provisioning all green
  ("All fields present" ×4), all three groups exist, connection
  self-test passed incl. DELETE, app runs production mode with correct
  role mapping. Remaining closeout: §4 permissions + §5 checks (in
  progress). Built as: `src/data/sp/` (client with digest cache +
  403-retry, schema, pure mapping w/ tests, full provider — nometadata
  writes only), Site setup screen (`#/admin/provision`: provision/verify
  lists, groups check, connection self-test incl. untested DELETE verb,
  hide/show lists in Site contents — hide LAST, SPD can't see hidden
  lists), `LIST_SETUP.md` (groups, custom permission levels
  "PMDC Contribute (no delete)" + "PMDC Add only" + "PMDC Maintain"
  (Contribute + Manage Lists — bypasses §4c item-level edit-own-only so
  maintainers work requester-created items), per-list grants, §4c
  item-level permissions: Read=All items / Edit=own items on
  Requests+Lines+Comments). `package:sp` builds
  VITE_DATA_PROVIDER=sharepoint; dev stays mock. Deviation (approved):
  requester/assignee stored as TEXT columns (claims login + display
  name), not Person fields.
- ✅ Field-map tuned to company policy + Excel template/import feature
  (2026-07-17, ahead of phase order at user request; exceljs installed).
- ✅ Phase 3 BUILT (2026-07-19), verified end-to-end on mock:
  attachments UI on detail (any user with access, any status, no in-app
  delete — SharePoint permissions = boundary), Excel EXPORT on detail
  (`src/lib/excel-export.ts` — Summary + sheet per present object type,
  derived fields INCLUDED, amber mandatory / grey inapplicable /
  identifiers never greyed, exceljs lazy), `#/admin/dashboard` (KPI
  cards + maintainer performance from `src/domain/dashboard.ts`,
  computed at render), `CompletedAt` column (stamped on transition to
  Completed in BOTH providers; dashboard on-time %/cycle time need it —
  pre-upgrade Completed items show "—"). Formerly pending "provision
  re-run for CompletedAt + Description" SUPERSEDED by PMDC rename: new
  subsite's fresh provision creates every current column (old site would
  need pre-rename build to re-provision, being retired instead).
  "Digest-expiry retry" already implemented in Phase 2 (client.ts 403 →
  refresh digest → retry once) — not Phase-3 item.
- ✅ Phase 4 AUTHORED (2026-07-19): WORKFLOW_RECIPE.md (SPD 2013,
  "core four" emails — submitted→Maintainers, assigned→assignee,
  rejected/completed→requester; loop-safe via LastNotifiedStatus/
  LastNotifiedAssignee scratch columns now in LIST_SPECS; Step-0 check
  for claims-login email resolution), SMOKE_TEST.md (pre-pilot
  checklist), README demo script, DEPLOY_SP pilot note. ON-SITE
  EXECUTION PENDING (on NEW subsite, DEPLOY_SP.md "Moving to a new
  subsite"): fresh provision, workflow per recipe, smoke test, then
  pilot.

## Deployment

- Pipeline: push to GitHub `hejailaf/dmp-portal` (public; dist-sp/
  committed on purpose — it's the payload). At work user opens
  `stackblitz.com/github/hejailaf/dmp-portal` (anonymous; GitHub blocked
  there), downloads project zip, uploads `dist-sp/` files into app
  library on SharePoint subsite (old: `DMPApp` under
  `/personal/<user>/pmdc`; new: `PMDCApp` under team-site subsite once
  created). Typical update = replace `index.aspx` + `assets/index.js` +
  `assets/index.css` (+ `assets/logo-icon.png` favicon if not already
  uploaded). ALWAYS `npm run package:sp` + commit + push after
  user-visible changes.
- Current dist-sp = PMDC build → NEW subsite only (fresh provision
  creates all current columns); old personal-site subsite keeps
  pre-rename build until retired.

## Brand & assets

- Logos/lockups = SVGs inlined as data URIs into index.js
  (`assetsInlineLimit: 65536` in vite.config.ts); favicon = inline SVG
  data URI in index.html (regenerate base64 from
  src/assets/logo-icon.svg if icon changes). Deployment contains ZERO
  image files.
- Home banner = TEXT-ONLY horizontal lockup at h-20 (user decision);
  text-only lockups DESIGNER-SUPPLIED (viewBox "0 0 585 160" with
  padding; designer dark tagline #8FA8C4). Dark variants of derived
  assets via fill map navy→#E6F2FA, blue→#5B9BE8, teal→#2BC0AE,
  slate→#84A0B5.
- Aramco alignment (docs/BRAND_REVIEW.md, 2026-07-22): palette **V1
  "Teal internal"** in styles.css (Dark Blue #0033A0 interactive, Teal
  #26A8AB accents, official gray ramp, Aramco status colors). Segoe UI =
  sanctioned business font. User decisions: NO Aramco logo in app;
  lucide icons kept as accepted deviation (official icon library at
  `C:\ClaudeProjects\Iconography`, optional hybrid use open). Logo SVG
  recolor to Aramco hues = open designer task.

## Current state (2026-07-22)

- Everything merged to master: ux-experiments UI overhaul (merge
  d8ed525), Aramco palette, design-review fixes (Claim visibility,
  always-clickable Submit, aria-sort, pinned Ref column, KPI scoping,
  detail polish — details in git history). Branches
  `ux-experiments`/`experiments` + tag `pilot-baseline` deleted (all
  fully merged); pilot-baseline commit = 4898df3 in master history if
  rollback reference ever needed.
- Next: on-site new-subsite move — see Phase 4 bullet (fresh provision,
  workflow, smoke test, pilot).
- Postponed by user: script-redirect button (bounce classic list pages
  to app, with safety hatch); PPTX requester-guide screenshot refresh
  (old UI + old wording — redo after new site live).
- **Identity revamp** ("engineering document", 2026-07-22, on
  `experiments`): radius/shadow/scrim tokens, unified amber trio
  (--warning #84630d light — AA fix from #997310), Segoe UI Variable
  stacks (keep DataGrid canvas stack in sync), type scale
  display/title/section (NEVER through cn() next to a text color —
  tailwind-merge treats them as colors), rise-in reveal + --stagger-i +
  reduced-motion blanket, teal letterhead rules, drafting-grid home
  hero, teal grid header bands (table.tsx + DataGrid filler th
  TOGETHER). Detail line items = editor-style tab strip, collapsible
  (click active tab / chevron). Width caps (user decisions 2026-07-23,
  supersede 1920): data pages max-w-screen-2xl (1536), home 1280 —
  fixed grid columns never stretch, so the extra span was empty filler.
  Header ITEMS independently fixed max-w-7xl (1280) on every page (no
  shift on navigation; alignment with content deliberately dropped —
  the full-width band + teal rule carry the header visual). Big-data seeds DCR "Area 7" draft (46
  lines) + "Warehouse 12" In-process (40 lines, 12 comments).

## Six pre-pilot features (2026-07-23, `experiments`)

- **Withdrawn status** (user decision): Waiting-only, reopenable →
  Draft (event Reopened, SLA cleared), NO reason — rides setStatus in
  both providers, zero provider changes. Choice value ships in schema;
  provisioning never edits existing choice columns — provision the new
  subsite with a 2026-07-22+ build (DEPLOY_SP §5 note).
- **Per-line keying**: built 2026-07-23, REMOVED same day (user
  decision: not necessary). No KeyedAt column anywhere; if it ever
  returns, follow the ReturnedAt 3-place SP precedent.
- **Duplicate as draft** (More menu, requester/admin): visibleLines →
  createRequest — normalization/ref/audit free; attachments NOT copied
  (no copy API).
- **List export**: makeRequestListExport in excel-export.ts; Export
  button exports the FILTERED array; module dynamically imported so
  exceljs stays lazy.
- **Draft autosave**: dmp-draft-autosave-<id|new>; INVARIANT — key
  cleared on every successful save/submit, so a surviving value is
  always newer than the server copy → restore wins unconditionally;
  amber notice + Discard (back to blank/server copy).
- **Dashboard window**: filterByWindow (all/month/quarter on
  submittedAt, local calendar) pre-filters before computeDashboard;
  drafts drop from windowed views; KPI links stay window-less.

## Dev commands

- `npm run dev` — app on MockProvider at http://localhost:5173 (role
  switcher bottom-right; reset demo data there too)
- `npm test` — domain unit tests
- `npm run package:sp` — typecheck + build + `dist-sp/` + `dmp-sp.zip`
