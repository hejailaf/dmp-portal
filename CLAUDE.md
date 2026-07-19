# CLAUDE.md — PM DataCare (internally DMP)

Display name: **PM DataCare** — "Caring for your SAP PM master data"
(renamed 2026-07-18 from "Data Maintenance Portal"). Internal `DMP_*`
lists and `DMP *` groups keep the DMP naming. Request refs are
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
  `DMP Requesters` / `DMP Maintainers` / `DMP Admins`.
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
  (reopen — user decision). Only Completed is terminal.
- Transition permissions live in `src/domain/status.ts` TRANSITIONS table:
  submit/reopen = owning requester or admin; start/complete = assigned
  maintainer or admin; **reject = admin only** (spec-literal; change one row
  if maintainers should reject).
- Assignment: admins assign anyone; maintainers may self-claim unassigned
  requests (user decision). Enforced in providers, not just UI.
- Roles: groups first; if a user has NO direct DMP group, the SP provider
  probes EffectiveBasePermissions on DMP_Requests and grants `requester`
  when the AddListItems bit is set — this is how 1,000-member AD security
  groups nested in `DMP Requesters` work (on-site verified 2026-07-19;
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
- Request `description` (business reason/reference): a ONE-LINE title,
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
- Excel line import/export templates (`src/lib/excel-lines.ts`): per-tab
  template download + validating import in the editor, both derived from the
  field map. exceljs loads as a lazy chunk — keep it out of the main bundle.
  Excel sheet protection is a convenience fence, not security; the importer
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
  connection self-test incl. the untested DELETE verb), `LIST_SETUP.md`
  (groups, custom permission levels "DMP Contribute (no delete)" +
  "DMP Add only", per-list grants). `package:sp` now builds
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
  ON-SITE STEP PENDING: re-run "Verify & provision" once so the existing
  DMP_Requests list gains CompletedAt AND Description (added same day). Note: the formerly listed
  "digest-expiry retry" was already implemented in Phase 2
  (client.ts 403 → refresh digest → retry once) — not a Phase-3 item.
- ⬜ Phase 4: WORKFLOW_RECIPE.md (SharePoint Designer emails), pilot.

## Session handoff (2026-07-18) — read before continuing

- **Deployment pipeline**: push to GitHub `hejailaf/dmp-portal` (public;
  dist-sp/ is committed on purpose — it's the payload). At work the user
  opens `stackblitz.com/github/hejailaf/dmp-portal` (anonymous; GitHub
  itself is blocked there), downloads the project zip, uploads `dist-sp/`
  files into the `DMPApp` library on the SharePoint subsite
  (`/personal/<user>/pmdc`, unique permissions). Typical update = replace
  `index.aspx` + `assets/index.js` + `assets/index.css`. ALWAYS
  `npm run package:sp` + commit + push after user-visible changes.
- **On-site state**: Phase 2 verified (provision green, self-test incl.
  DELETE green, roles map correctly). §4 permissions applied per
  LIST_SETUP.md (incl. on-site learnings already folded into that doc:
  Stop-Inheriting needed before Permission Levels appears; "DMP Add only"
  must include Use Remote Interfaces; Limited Access is normal). The user
  has NOT yet deployed the newest UI build (dark mode etc.) nor run the §5
  closeout: full vertical slice + the colleague-with-only-Requester test
  (also proves non-owner page rendering).
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
  to a team site before broad rollout.
- **Next build phase**: Phase 3 — attachments UI, Excel EXPORT on detail
  page (reuse excel-lines machinery), admin dashboard, polish.

## Dev commands

- `npm run dev` — app on MockProvider at http://localhost:5173 (role switcher
  bottom-right; reset demo data there too)
- `npm test` — domain unit tests
- `npm run package:sp` — typecheck + build + `dist-sp/` + `dmp-sp.zip`
