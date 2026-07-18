# CLAUDE.md — Data Maintenance Portal (DMP)

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
- SLA: `DueDate = SubmittedAt + max(SlaDays per line action)`; defaults
  Add 5 / Change 3 / Delete 2 (config in `src/domain/sla.ts`). Overdue is
  DERIVED at render time — no scheduled jobs anywhere. Resubmit after reopen
  recomputes SLA and clears the old reject reason.
- Refs `REQ-YYYY-NNNN` are computed client-side from existing refs (create
  time); tiny collision window accepted + re-check/retry planned for the SP
  provider (plan decision).
- Line SAP fields live in one JSON blob (`FieldData`) validated by Zod —
  never mirrored as SharePoint columns.
- Drafts are visible only to their requester and admins.
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

- ✅ Phase 0 built (`spike.aspx` + `docs/PHASE0_UPLOAD.md`) — **awaiting
  on-site results**. Phase 2 must be built to whatever the spike reports
  (especially nometadata vs verbose writes).
- ✅ Phase 1 built: domain + tests, MockProvider + seed, full UI (home,
  lists, AIW editor, detail with comments/audit). Verified end-to-end in the
  browser across all three roles.
- ⬜ Phase 2: SharePointProvider, provision/verify-lists screen, LIST_SETUP +
  permissions recipe. Blocked on Phase-0 report.
- ✅ Field-map tuned to company policy + Excel template/import feature
  (2026-07-17, ahead of phase order at user request; exceljs installed).
- ⬜ Phase 3: attachments UI, Excel EXPORT on the detail page (import
  exists; export reuses the same field-map machinery), admin dashboard,
  digest-expiry retry.
- ⬜ Phase 4: WORKFLOW_RECIPE.md (SharePoint Designer emails), pilot.

## Dev commands

- `npm run dev` — app on MockProvider at http://localhost:5173 (role switcher
  bottom-right; reset demo data there too)
- `npm test` — domain unit tests
- `npm run package:sp` — typecheck + build + `dist-sp/` + `dmp-sp.zip`
