# CLAUDE.md — PM DataCare (internally DMP)

Display name: **PM DataCare** — "Caring for your SAP PM master data"
(renamed 2026-07-18 from "Data Maintenance Portal"). SharePoint artifacts
use the `PMDC` prefix — `PMDC_*` lists, `PMDC *` groups, `PMDCApp`
library, `PMDC *` permission levels (renamed from DMP 2026-07-21, bound
to the new-subsite move: a PMDC build only works on a site provisioned
with PMDC names — the old personal-site subsite needs the pre-rename
build until retired). Only internals keep the DMP codename (repo name,
`dmp-sp.zip`, localStorage keys, the spec filename). Request refs are
`DCR-YYNNNN` (brand restyle of 2026-07-18; legacy `REQ-` refs are ignored
by `nextRef`).

Full specification: `docs/DMP_FROM_SCRATCH_PROMPT.md`. Approved plan &
decisions: this file. Read both before changing anything.

## What this is

An internal CRM-style portal where end users submit change requests for SAP
Plant Maintenance (PM) master data, and a Data Maintenance team executes them
**manually in SAP Fiori MDG**. The app NEVER integrates with SAP — it is
intake, tracking, assignment, SLA, audit, and Excel export only.

## Hard constraints (spec §2 — never violate)

- Target: **SharePoint Server 2019 on-prem**, internal network only.
- Static SPA hosted in a SharePoint **document library**. No server of ours:
  no Node backend, no DB, no cloud, no Power Automate, no SPFx.
- **SharePoint lists are the database** via SP2019 REST (same origin).
- Windows auth; identity from `/_api/web/currentuser`, roles from groups
  `PMDC Requesters` / `PMDC Maintainers` / `PMDC Admins`.
- Entry page is **`index.aspx`** (Strict file handling downloads `.html`).
- The developer has **no terminal and no internet at work** — deployment is
  drag-and-drop upload in the browser. The app must be fully runnable offline
  on the MockProvider.
- No runtime calls to the public internet (no CDN fonts, no telemetry).
- Target browsers: modern Edge/Chrome (user decision — no IE11).

## Working rules (spec §11)

1. Ask before adding any dependency beyond the locked stack (React 18, TS,
   Vite, Tailwind, shadcn/ui + its transitive deps, TanStack Table, Zod,
   exceljs, Vitest).
2. `src/domain` stays pure TypeScript — no React, no SharePoint imports. It
   is the single source of truth for statuses, field map, validation, SLA.
3. Keep tests for the state machine, SLA math, field-map validation green
   (`npm test`).
4. Never claim something works on SP2019 without Phase-0 verification or a
   `VERIFY-ON-SITE` marker in code + a check in the spike panel.
5. Keep `docs/` current at the end of each phase.

## Architecture

- `src/domain` — types, status state machine, SLA engine, ref numbering,
  config-driven field map (`field-map/*.ts`, one file per object type),
  Zod schemas derived FROM the field map. Unit-tested.
- `src/data` — `DataProvider` interface (`provider.ts`); `mock/` (in-memory +
  localStorage, seeded, role switcher) and `sp/` (Phase 2, stub until Phase-0
  results). Selected by `VITE_DATA_PROVIDER` (default `mock`).
- `src/app` — React UI. Hand-rolled hash router (`router.ts` — path routing
  can't work from a doc library). All strings in `strings.ts`.
- `src/spike` — Phase 0 diagnostics page (own Vite entry → `spike.aspx`).
- `scripts/package-sp.mjs` — dist → dist-sp (.aspx pages, `?v=BUILD`
  cache-busting; filenames are fixed/unhashed) + zip.

## Domain rules

- Statuses: `Draft → Waiting to be started → In process → Completed`;
  `Rejected` from Waiting/In process (reason required); `Rejected → Draft`
  (reopen — user decision). `Returned` from Waiting/In process (user
  decision 2026-07-21): assigned maintainer/admin sends it back with a
  reason; the requester EDITS DIRECTLY (no reopen) and resubmits →
  Waiting (assignee kept). Reject RESETS dates on reopen+resubmit;
  Return PAUSES the SLA — submittedAt stays and dueDate grows by the
  returned interval (`extendDueDate`, `returnedAt` field / ReturnedAt
  column; reason shares RejectReason; isOverdue is false while
  Returned). Only Completed is terminal. DISPLAY (2026-07-21,
  `S.statusLabel`): the stored "Waiting to be started" reads "Assigned"
  once assigned; while unassigned it reads BY VIEWER — "Submitted" to
  requesters, "Unassigned" to staff (maintainer/admin) — stored
  value/choice column unchanged. Stepper track: Draft →
  Submitted|Unassigned → Assigned → In process → Completed.
- Transition permissions live in `src/domain/status.ts` TRANSITIONS table:
  submit/reopen/resubmit = owning requester or admin; start/complete/
  return = assigned maintainer or admin; **reject = admin only**
  (spec-literal).
- Assignment: admins assign anyone; maintainers may self-claim unassigned
  requests (user decision). Enforced in providers, not just UI.
- Roles: groups first; if a user has NO direct PMDC group, the SP provider
  probes EffectiveBasePermissions on PMDC_Requests and grants `requester`
  when the AddListItems bit is set — this is how 1,000-member AD security
  groups nested in `PMDC Requesters` work (on-site verified 2026-07-19,
  pre-rename;
  see LIST_SETUP.md §6). Maintainer/admin stay group-name-only. All three
  groups need "view membership: Everyone" or direct members read as
  role-less.
- SLA: `DueDate = SubmittedAt + max(SlaDays per line action)`; defaults
  Add 5 / Change 3 / Delete 2 (config in `src/domain/sla.ts`). Overdue is
  DERIVED at render time — no scheduled jobs anywhere. Resubmit after reopen
  recomputes SLA and clears the old reject reason.
- Refs `DCR-YYNNNN` are computed client-side from existing refs (create
  time); tiny collision window accepted + re-check/retry planned for the SP
  provider (plan decision).
- Line SAP fields live in one JSON blob (`FieldData`) validated by Zod —
  never mirrored as SharePoint columns.
- Drafts are visible only to their requester and admins.
- Request `description`: a ONE-LINE title. Convention (user decision
  2026-07-21): reference documents (MOC/WO/etc.) belong in ATTACHMENTS
  and remarks in COMMENTS — never in the description; keep demo/seed
  descriptions and examples free of reference codes. It is
  ≤60 chars (`DESCRIPTION_MAX_LENGTH`), free while drafting, REQUIRED at
  submit — enforced in `validateForSubmit(lines, description)` and thus
  in BOTH providers + the editor (single-line Input with counter).
  Stored as the `Description` note column. Detail header (variant A,
  2026-07-19): description is the truncating headline, ref is a small
  label, meta is a divided strip (Requester/Assignee/Submitted/Changed/
  [Completed]/Due) — "Changed" is DERIVED from the newest audit entry
  (every action writes one), not a stored column; no Created, no SLA
  suffix (the SLA badge covers it).
- Comments: ≤1000 chars (`validateCommentBody`, both providers + composer
  maxLength). Attachments (user decisions 2026-07-19): allow-list
  pdf/images/msg+eml/Office, ≤100 MB, ≤6 per request
  (`validateAttachment`, both providers + UI); STAGED uploads — picks
  live in browser state with a remove ✕ until the explicit Upload
  button commits them (reload discards pending; no server-side delete —
  would need delete rights requesters intentionally lack).
- Line data is NORMALIZED at every provider boundary —
  `normalizeFieldData(objectType, action, fieldData)` (derive first, then drop
  values for fields the action doesn't use; unknown keys and unknown object
  types/actions pass through untouched). Applied on READ (`sp/mapping.mapLine`,
  mock `loadDb` — this is what cleans rows stored before 2026-07-20, no
  migration) and on WRITE (`replaceLines`, `writeLines`). The Excel export
  masks non-applicable cells itself as well: that sheet is keyed into SAP, so
  it never trusts the boundary. Editor state is deliberately NOT pruned on an
  action change (mis-clicked dropdown is recoverable by switching back);
  saving/submitting asks first when values would be dropped, and Duplicate
  copies only visible values (user decisions 2026-07-20).
- Both providers validate + check the transition BEFORE deleting empty lines at
  submit — a rejected submit must never destroy rows.
- Empty (never-filled) lines are pruned at submit — in the editor AND in
  the provider (`isEmptyLine`); the Phase-2 SharePointProvider must prune
  on submit too. Drafts keep scratch rows.
- Field map = the COMPANY set (review of 2026-07-17, applied from
  `field-map-review.csv` — regenerate it with
  `npx vite-node scripts/export-field-map.ts` after config edits). Key
  decisions: FLoc identifier shown/required only on Change/Delete; BOM offers
  only Add/Delete (`actions` on ObjectTypeConfig) and links to equipment
  only; PM Change/Delete are identified by Maintenance Item; several SAP
  number fields use strict numeric validation.
- Excel line import/export templates (`src/lib/excel-lines.ts`): ONE
  unified workbook, a sheet per object type (`makeUnifiedTemplate` /
  `parseUnifiedTemplate`, ux-experiments 2026-07-21) — the importer reads
  ALL recognizable sheets so several types mass-import at once; old
  single-sheet files still import by sheet name. The editor's download
  opens on the active tab's sheet (workbook.views activeTab); the home
  page's Excel card downloads it directly. Both derived from the field
  map. exceljs loads as a lazy chunk — keep it out of the main bundle.
  The template sheet is UNPROTECTED (user decision 2026-07-21): a grey
  banner + amber Action header advise the layout rules; the importer
  validates everything.
- Equipment classification is DERIVED: users pick only Equipment Type; the
  correlation table (`src/domain/field-map/equipment-types.ts`, GENERATED
  from `docs/tech_object_types.xlsx` via
  `npx vite-node scripts/import-equipment-types.ts`) fills category/object
  type/catalog profile through `applyDerivations`. Derived fields
  (`derived: true` in FieldDef) are hidden in editor + Excel template,
  visible on detail grids + Phase-3 export. Derivation is applied in the
  editor, the Excel importer, and MockProvider.replaceLines — the Phase-2
  SharePointProvider MUST apply it on write too.

## Phase status

- ✅ Phase 0 PASSED on-site (2026-07-19), all 5 checks green. Findings that
  bind Phase 2: **nometadata works for ALL writes** (list create, item
  create, MERGE — no `__metadata`/verbose needed); digest timeout **1800s**;
  claims-style login names (`i:0#.w|domain\user`); site is a **subsite with
  unique permissions under the user's personal site collection**
  (`/personal/<user>/pmdc` — user renamed the subsite URL segment from
  `dmp` on 2026-07-19; display names now "PM DataCare" / "PM DataCare
  App") — works, but flagged to migrate to a team site
  before broad rollout (personal site collections are tied to the owner's
  account). Rendering blocked on the parent site was permission-level, not
  farm-level; untested: person-field writes (avoided — see Phase 2 notes).
- ✅ Phase 1 built: domain + tests, MockProvider + seed, full UI (home,
  lists, AIW editor, detail with comments/audit). Verified end-to-end in the
  browser across all three roles.
- ✅ Phase 2 VERIFIED ON-SITE (2026-07-19): provisioning all green ("All
  fields present" ×4), all three groups exist, connection self-test passed
  incl. DELETE, app runs in production mode with correct role mapping.
  Remaining Phase-2 closeout: §4 permissions + §5 checks (in progress).
  Built as:
  `src/data/sp/` (client with digest cache + 403-retry, schema, pure
  mapping w/ tests, full provider — nometadata writes only), Site setup
  screen (`#/admin/provision`: provision/verify lists, groups check,
  connection self-test incl. the untested DELETE verb, hide/show lists
  in Site contents — hide LAST, SPD can't see hidden lists), `LIST_SETUP.md`
  (groups, custom permission levels "PMDC Contribute (no delete)" +
  "PMDC Add only" + "PMDC Maintain" (Contribute + Manage Lists — bypasses
  the §4c item-level edit-own-only restriction so maintainers can work
  requester-created items), per-list grants, §4c item-level permissions:
  Read=All items / Edit=own items on Requests+Lines+Comments). `package:sp` now builds
  VITE_DATA_PROVIDER=sharepoint; dev stays mock. Deviation (approved):
  requester/assignee stored as TEXT columns (claims login + display name),
  not Person fields.
- ✅ Field-map tuned to company policy + Excel template/import feature
  (2026-07-17, ahead of phase order at user request; exceljs installed).
- ✅ Phase 3 BUILT (2026-07-19), verified end-to-end on the mock:
  attachments UI on detail (any user with access, any status, no in-app
  delete — SharePoint permissions are the boundary), Excel EXPORT on
  detail (`src/lib/excel-export.ts` — Summary + one sheet per present
  object type, derived fields INCLUDED, amber mandatory / grey
  inapplicable / identifiers never greyed, exceljs stays lazy),
  `#/admin/dashboard` (KPI cards + maintainer performance from
  `src/domain/dashboard.ts`, computed at render), `CompletedAt` column
  (stamped on transition to Completed in BOTH providers; dashboard
  on-time %/cycle time need it — pre-upgrade Completed items show "—").
  The formerly pending "provision re-run for CompletedAt + Description"
  is SUPERSEDED by the PMDC rename: the new subsite's fresh provision
  creates every current column (the old site would need the pre-rename
  build to re-provision, and is being retired instead). Note: the
  formerly listed "digest-expiry retry" was already implemented in
  Phase 2 (client.ts 403 → refresh digest → retry once) — not a
  Phase-3 item.
- ✅ Phase 4 AUTHORED (2026-07-19): WORKFLOW_RECIPE.md (SPD 2013,
  "core four" emails — submitted→Maintainers, assigned→assignee,
  rejected/completed→requester; loop-safe via LastNotifiedStatus/
  LastNotifiedAssignee scratch columns now in LIST_SPECS; Step-0 check
  for claims-login email resolution), SMOKE_TEST.md (pre-pilot
  checklist), README demo script, DEPLOY_SP pilot note. ON-SITE
  EXECUTION PENDING (now on the NEW subsite, DEPLOY_SP.md "Moving to a
  new subsite"): fresh provision there, workflow built per recipe, smoke
  test run, then pilot.

## Session handoff (2026-07-18) — read before continuing

- **Deployment pipeline**: push to GitHub `hejailaf/dmp-portal` (public;
  dist-sp/ is committed on purpose — it's the payload). At work the user
  opens `stackblitz.com/github/hejailaf/dmp-portal` (anonymous; GitHub
  itself is blocked there), downloads the project zip, uploads `dist-sp/`
  files into the app library on the SharePoint subsite (old site:
  `DMPApp` under `/personal/<user>/pmdc`; new site: `PMDCApp` under the
  team-site subsite once created). Typical update = replace
  `index.aspx` + `assets/index.js` + `assets/index.css`. ALWAYS
  `npm run package:sp` + commit + push after user-visible changes.
- **On-site state**: Phase 2 verified (provision green, self-test incl.
  DELETE green, roles map correctly). §4 permissions applied per
  LIST_SETUP.md. VERIFIED ON-SITE 2026-07-19: requester colleagues open
  the app as non-owners with correct roles (after setting group
  "view membership: Everyone" — the no-role fix), AND the 1,000-member
  AD security group flow works "flawlessly" (permission-probe requester
  role, LIST_SETUP.md §6). All of that was on the OLD (pre-rename) site;
  still to do on-site: the new-subsite move (DEPLOY_SP.md) with fresh
  PMDC provision, then one full vertical slice (submit → assign →
  complete) with real data there.
- **Brand restyle applied** (2026-07-18, from
  `design_handoff_pm_datacare_restyle/README.md` §1–5): PM DataCare tokens
  in styles.css (light + dark, plus plain hex brand vars for badges/cells),
  badge dots, 64px header with logo PNGs (`src/assets/`, swap on `.dark`),
  underline nav, DCR-YYNNNN refs, card/dialog/input polish, favicon
  (inline SVG data URI in index.html — regenerate the base64 from
  src/assets/logo-icon.svg if the icon changes; no favicon file). Header logos + home-page lockup are SVGs inlined as data URIs into
  index.js (`assetsInlineLimit: 65536` in vite.config.ts). All pages (incl.
  home) show the full logo-header pair in the header; the home banner is
  a TEXT-ONLY horizontal lockup (user decision after trying an icon-only
  home header). Derived assets (scripted edits of the
  designer's files, in src/assets/): dark variants via the fill map
  navy→#E6F2FA, blue→#5B9BE8, teal→#2BC0AE, slate→#84A0B5; text-only
  lockups are now DESIGNER-SUPPLIED (bundle assets, viewBox
  "0 0 585 160" with padding — home banner uses h-20 so the rendered
  wordmark matches the size approved at h-16 with the old tight crop;
  designer's dark tagline is #8FA8C4). Artwork revs applied 2026-07-18
  (emblem) + 2026-07-19 (wordmark, official text-only files) — the
  deployment contains ZERO image files — no logo files in uploads; the header PNGs uploaded
  earlier to SharePoint are harmless orphans. Bell + overdue pill
  deliberately deferred to Phase 3. Deploy note: usual three files plus
  `assets/logo-icon.png` (favicon) if not already uploaded.
- **Recent UI additions** (all pushed): dark mode (system-following +
  header toggle, `color-scheme` for native scrollbars/pickers), footer
  credit (Abdullah F. Alharbi / abdullah.hejaili@aramco.com), editor hint
  "Highlighted" chip styled like mandatory cells, per-role home section
  headings + Requester tiles hidden for staff.
- **Pending decisions**: (1) ~~site rename~~ DECIDED 2026-07-18: user chose
  **PM DataCare** (applied). (2) Migration off the personal site collection
  to a team site — recipe ready (DEPLOY_SP.md "Moving to a new subsite"),
  execution pending on-site.

## Session handoff addendum (2026-07-22)

- **ux-experiments MERGED to master** (merge d8ed525, deployment build
  202607220321 committed): request-detail redesign (stepper, actions in
  the header card, More menu, activity tabs, pinned lead columns),
  warm-graphite dark mode, Description column in lists, 11-item polish
  pass (sorting, sticky editor bar, router-level unsaved-changes
  navGuard, skeletons, per-page titles, stored list filters, back-link,
  Ctrl+Enter comments, overdue row edge, count + clear-search, empty-state
  CTA), role-specific home pages (requester launchpad / maintainer
  overview / admin command center; ONE section by highest role
  Admin > Maintainer > Requester; full-bar link callouts), slim nav
  (no Unassigned link; "+ Create a new request" CTA right of nav, hidden
  on home + /new; maintainers never see it), Unassigned as a checkbox
  next to Overdue (mutually exclusive), unified multi-sheet Excel
  template, Returned flow, perspective status wording. The branch
  `ux-experiments` + tag `pilot-baseline` stay on GitHub until the new
  site passes SMOKE_TEST, then delete.
- **Deploy**: build 202607220321 is a PMDC build → NEW subsite only,
  full dist-sp upload + fresh provision there; the old personal-site
  subsite keeps its pre-rename build until retired.
- **Postponed by user**: script-redirect button (bounce classic list
  pages to the app, with safety hatch); PPTX requester-guide screenshot
  refresh (old UI + old wording — redo after the new site is live).

## Session handoff addendum 2 (2026-07-22, `experiments` branch)

- **Aramco brand alignment** (docs/BRAND_REVIEW.md): reviewed
  brand.aramco.com corporate guidelines; user selected palette variant
  **V1 "Teal internal"** from 3 in-browser mockups — applied in
  styles.css (Dark Blue #0033A0 interactive, Teal #26A8AB accents,
  official gray ramp, Aramco status colors) + badge/dialog hex tweaks.
  Segoe UI was already the sanctioned business font. User decisions: NO
  Aramco logo in the app; lucide icons kept as accepted deviation
  (official icon library downloaded at `C:\ClaudeProjects\Iconography`,
  optional hybrid use open). Logo SVG recolor to Aramco hues = open
  designer task. ON `experiments` ONLY — not merged, not deployed.

## Dev commands

- `npm run dev` — app on MockProvider at http://localhost:5173 (role switcher
  bottom-right; reset demo data there too)
- `npm test` — domain unit tests
- `npm run package:sp` — typecheck + build + `dist-sp/` + `dmp-sp.zip`
