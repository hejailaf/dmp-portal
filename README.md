# PM DataCare

*Caring for your SAP PM master data* — originally codenamed **DMP**
(Data Maintenance Portal). SharePoint artifacts now use the **PMDC**
prefix (`PMDC_*` lists, `PMDC *` groups, renamed 2026-07-21); only
internals (repo name, zip, localStorage keys) keep the old codename.

An internal portal where end users submit **change requests for SAP Plant
Maintenance (PM) master data**, and the Data Maintenance team executes those
requests **manually in SAP Fiori MDG**. The app never touches SAP: it is a
structured intake queue with a multi-object work-package editor, a status
workflow, SLA deadlines, comments, an action log, and an Excel export to
ease manual keying.

Runs as a **static single-page app inside a SharePoint 2019 document
library** — SharePoint lists are the database, Windows auth is the login.
There is no server component of ours at all.

## Quick start (at home, offline-friendly)

```
npm install
npm run dev        # full app on mock data → http://localhost:5173
npm test           # domain unit tests (state machine, SLA, validation)
npm run package:sp # build dist-sp/ + dmp-sp.zip for browser upload
```

The **role switcher** (bottom-right in dev) lets you use the app as a
Requester, Data Maintainer, or Admin against seeded demo data. "Reset demo
data" restores the seed.

## Demo script (mock data)

The seed contains ten requests covering every status: two drafts, three
waiting (one unassigned/claimable, one overdue), two in process, two
completed (one on-time, one late — so the dashboard shows both 100% and
0% on-time rows), one rejected (reopenable). A 5-minute demo: as Rana
(Requester) create + submit a request; as Malik (Maintainer) claim,
start, and complete it; as Aya (Admin) tour the dashboard and reject the
spare request with a reason; back as Rana, reopen it. Pilot checklists
and the email-notification design live in `docs/SMOKE_TEST.md` and
`docs/WORKFLOW_RECIPE.md`.

## Current status

| Phase | State |
|---|---|
| 0 — Feasibility spike | **Passed on-site** (2026-07-19) — all 5 checks green |
| 1 — Domain + full app on mock data | **Done** |
| 2 — SharePoint provider | **Verified on-site** (2026-07-19) — provisioning, groups and write self-test green; §4 permissions + §5 checks closing out |
| 3 — Attachments, Excel export, dashboard | **Built** (2026-07-19), verified end-to-end on mock |
| 4 — Notifications + pilot | Emails built INTO the app (no SharePoint Designer); on-site send + pilot pending |

## Architecture in one paragraph

`src/domain` is pure TypeScript and owns all business rules: the status state
machine, SLA math, reference numbering, and a **config-driven field map**
(one file per SAP object type under `src/domain/field-map/` — edit those
files to change which fields appear/are required; UI, validation, and export
all follow automatically). `src/data` defines one `DataProvider` interface
with two implementations: `MockProvider` (localStorage, used for all offline
development) and `SharePointProvider` (Phase 2, SP2019 REST). `src/app` is
the React UI and only ever talks to the provider interface.

## Security posture — a documented decision

There is **no server-side enforcement of ours**, by design (the hosting
environment allows none). Enforcement is:

1. **SharePoint list permissions** — Requesters contribute-without-delete on
   Requests/Lines/Comments and read-only on AuditLog; Maintainers edit;
   Admins full control (setup recipe arrives with Phase 2).
2. **UI role gating + domain state machine** — illegal transitions are
   rejected by the data layer, not just hidden.
3. **Complete audit trail + list versioning** — anything done out-of-band
   (e.g. directly in the list UI) is attributable and reversible.

A technically savvy user with list access could bypass the UI; the audit
trail and versioning make that visible rather than impossible. This residual
risk is accepted for an internal, low-sensitivity workflow tool.

## Repository map

```
docs/                  spec, Phase-0 upload recipe, deploy guide
scripts/package-sp.mjs build → dist-sp (.aspx + ?v=BUILD cache busting) + zip
src/domain/            pure TS business rules + unit tests
src/data/              DataProvider seam: mock/ (done) + sp/ (Phase 2)
src/app/               React UI (hash router, strings.ts, pages, components)
src/spike/             Phase 0 SP2019 diagnostics page
```
