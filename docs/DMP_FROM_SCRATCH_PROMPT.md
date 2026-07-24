# PROMPT — Build the Data Maintenance Portal from scratch (SharePoint 2019 edition)

You are Claude Code. Build a complete, production-quality internal web app called
**Data Maintenance Portal (DMP)** from scratch. This document is the full
specification — it is self-contained; there is no prior codebase.

Start in **Plan Mode**. First, summarize back to me: the architecture, the
environment constraints, the domain model, and the Phase 0 scope. Flag anything
ambiguous or contradictory. Do not write code until I approve the plan. I am not
a professional developer: explain significant decisions briefly as you go, and
when you need a decision from me, ask one clear question with a recommended
default.

---

## 1. What the app is

An internal, CRM-style portal where end users submit **change requests** for SAP
**Plant Maintenance (PM) master data**, and a **Data Maintenance team** executes
those requests **manually in SAP Fiori MDG**. The app never integrates with or
writes to SAP. It is purely an intake, tracking, assignment, notification, and
audit layer — a structured request queue with a multi-object work-package editor,
a status workflow, SLA deadlines, attachments, comments, an audit trail, and an
Excel export that eases manual keying into SAP.

## 2. Hosting environment (hard constraints — never violate)

- Target: **SharePoint Server 2019 on-premises**, internal network only.
- The app is a **static single-page application hosted in a SharePoint document
  library**. No server of ours exists: no Node backend, no database server, no
  cloud services, no Power Automate, no SPFx.
- **SharePoint lists are the database**, accessed via the SP2019 REST API
  (same origin — no CORS, no tokens).
- **Windows authentication** signs users in automatically; identity comes from
  `/_api/web/currentuser`, roles from SharePoint group membership.
- Browser File Handling is Strict: `.html` downloads instead of rendering, so the
  entry page must be **`index.aspx`** (a static shell with no server-side code).
- The developer has **no terminal and no internet access on the company network**.
  Development happens entirely off-network; deployment = uploading built files
  through the browser. Therefore the app must be fully runnable and testable
  offline against a mock data layer.
- No runtime calls to the public internet: no CDN fonts, no external APIs, no
  telemetry. Everything bundles at build time.

## 3. Tech stack (locked)

- **React 18 + TypeScript + Vite + Tailwind CSS**; shadcn/ui for components;
  **TanStack Table** for line-item grids
- **Zod** for all validation, shared between form UI and data layer
- **exceljs** for client-side Excel export
- Vitest for unit tests
- Single repo, simple structure: `src/domain` (enums, field map, SLA engine,
  Zod schemas — pure TypeScript, zero UI or SharePoint imports),
  `src/data` (providers), `src/app` (UI)

## 4. Domain model

### 4.1 Work packages (AIW-style)

A **Request** is one work package containing **line items across multiple object
categories at once**, each line with its own action:

| Tab | Object type | Actions |
|---|---|---|
| Equipment | `EQUIPMENT` | Add / Change / Delete |
| Functional Locations | `FLOC` | Add / Change / Delete |
| BOM Linkage | `BOM_LINKAGE` | Add / Change / Delete |
| PM (Preventive Maintenance) | `PM` | Add PM to equipment / Change task list / Delete PM |

The fields shown and required per line depend on **objectType × action**, defined
in a single **config-driven field map** in `src/domain/field-map/` — one config
file per object type declaring: field key, label, input type (text / choice /
number / date), required flag, and `configurable: true` where the mandatory set
may be tuned later without code changes. Ship a sensible starter field set per
object type (typical SAP PM fields: description, category, technical object type,
manufacturer, model, serial number, functional location, cost center, planner
group, main work center, maintenance plant, etc.); mark it clearly as
representative so I can adjust the config to match our SPRO settings.

### 4.2 Roles

- **Requester** — create/submit requests, track status, upload attachments, comment
- **Data Maintainer** — work their assigned queue, update status, comment
- **Admin** — everything: assign/reassign, reject, dashboard, all requests

Mapped from SharePoint groups: `DMP Requesters`, `DMP Maintainers`, `DMP Admins`.

### 4.3 Status workflow (enforce as a state machine in `src/domain`)

`Draft → Waiting to be started → In process → Completed`, with `Rejected`
reachable from Waiting and In process (reject requires a reason). Illegal
transitions must be impossible through the UI and rejected by the data layer.
Every transition, assignment, and comment writes an audit entry.

### 4.4 SLA

On submit, compute `DueDate = SubmittedAt + SlaDays`, where SlaDays comes from
config per action type (defaults: Add 5, Change 3, Delete 2 calendar days; the
max across a request's lines governs the request). Overdue is **derived at render
time** (DueDate past and status not terminal) — badges and filters in every list
view. No scheduled jobs exist anywhere.

## 5. Data architecture — the provider seam

Define one interface, two implementations, selected by `VITE_DATA_PROVIDER`:

```
DataProvider:
  getCurrentUser · listRequests(scope) · getRequest · createRequest ·
  updateDraft · submitRequest · assignRequest · setStatus · rejectRequest ·
  addComment · listComments · addAttachment · listAttachments · appendAudit ·
  listAudit · provisionLists (admin diagnostics)
```

- **MockProvider** (first-class, not a stub): in-memory + localStorage, seeded
  demo data (`npm run demo` state — one user per role, ~10 requests across all
  statuses and object types), artificial latency, and a dev-only role-switcher
  so I can exercise all three roles at home.
- **SharePointProvider**: SP2019 REST. Same-origin fetch; reads with
  `Accept: application/json;odata=nometadata`; writes carry `X-RequestDigest`
  from `POST /_api/contextinfo` (cache, refresh before ~25-min expiry); updates
  via `X-HTTP-Method: MERGE` + `IF-MATCH: *`; attachments via
  `AttachmentFiles/add`; identity via `/_api/web/currentuser` + `/groups`.
  Anything you cannot be certain of on SP2019, mark `VERIFY-ON-SITE` in code and
  surface in the diagnostics panel — never guess silently.

### Lists (the database) — provision via an admin-only in-app screen plus a manual recipe doc

- **DMP_Requests**: Title = auto ref (`REQ-YYYY-NNNN`), RequestStatus (choice),
  Assignee (person), SubmittedAt, DueDate, SlaDays, RejectReason, LineSummary
  (denormalized text for list views). Native attachments ON. Versioning ON.
- **DMP_RequestLines**: RequestId (number, indexed), ObjectType (choice),
  LineAction (choice), LineOrder (number), FieldData (multiline text holding a
  **JSON blob validated by the domain Zod schemas**). Do not mirror SAP fields as
  columns — the JSON blob preserves the config-driven design.
- **DMP_Comments**: RequestId (indexed), Body.
- **DMP_AuditLog**: RequestId (indexed), Event (choice), OldValue, NewValue.
  Write-once by convention; versioning ON.

## 6. UI scope

- **Login-free entry** (Windows auth) → role-aware home
- **Request list views**: My requests (Requester), My queue (Maintainer),
  All requests (Admin); status + overdue filters; ref/search
- **New Request — the AIW editor**: tabs per object type; add-N-lines grid per
  tab (TanStack); per-line action selector driving conditional fields from the
  field map; inline Zod validation; save draft; submit
- **Request detail**: header (status, SLA countdown/overdue, assignee), line-item
  grids per object type, attachments, comments, audit timeline, and role-aware
  actions (submit / assign / set status / reject with reason)
- **Excel export** button on detail: client-side .xlsx with a Summary sheet plus
  one grid sheet per object type present — mandatory cells shaded amber,
  inapplicable cells greyed — formatted to ease keying into SAP MDG
- **Admin dashboard**: KPI cards (totals, waiting, in process, completed, overdue,
  unassigned), and a maintainer performance table (open workload, completed,
  on-time %, average cycle time) computed from list data
- Clean, professional internal-tool aesthetic; desktop-first; English only, but
  all strings externalized so Arabic/RTL can be added later

## 7. Security posture (stated, accepted)

No server-side enforcement of ours exists. Enforcement = SharePoint list
permissions (Requesters contribute-no-delete on Requests/Lines/Comments, read on
AuditLog; Maintainers edit; Admins full) + UI role gating + a complete audit
trail and list versioning making out-of-band edits attributable and reversible.
Document this posture in the README as a decision. Provide the permissions setup
recipe in docs.

## 8. Notifications

> **Superseded 2026-07-24 — this section's premise turned out to be wrong.**
> Email CAN be built in code: SharePoint's `SP.Utilities.Utility.SendEmail`
> REST endpoint lets the app send its own mail, so there is no SharePoint
> Designer workflow. The rest of this section is kept as the original
> brief; the built design is WORKFLOW_RECIPE.md §A (§B keeps the SPD
> recipe as a fallback).

MVP: a **SharePoint Designer 2013 workflow** on DMP_Requests (on change: status
changed → email requester; assignee changed → email assignee). You cannot build
this in code — instead produce `docs/WORKFLOW_RECIPE.md`, an exact click-by-click
recipe I will perform in SharePoint Designer at work, including the email
templates (ref no., status, deep link to the request). Fallback if Designer is
blocked: document native "Alert me" subscriptions. No scheduled reminder emails.

## 9. Build & deploy (browser-only at work)

- Vite: `base: './'`, **fixed output filenames** (no hashes); cache-bust with a
  `?v=BUILD` query on asset references; generate `index.aspx` into the build
- `npm run package:sp` → `dist-sp/` folder + zip ready to drag into the "DMPApp"
  document library
- `docs/DEPLOY_SP.md` written for me (browser-only): first-time setup (library,
  groups, permissions, list provisioning, workflow recipe pointer) and the
  routine update procedure

## 10. Phases — each ends with something I can run

- **Phase 0 — Feasibility spike**: a minimal index.aspx + tiny bundle with an
  on-page diagnostics panel that (a) renders on SP2019, (b) reads currentuser,
  (c) creates/reads an item in a scratch list with digest auth, (d) adds an
  attachment. Every `VERIFY-ON-SITE` item is a labeled check here. I upload it
  at work and report results back before we build on those assumptions.
- **Phase 1 — Domain + mock app**: `src/domain` complete with unit tests (state
  machine, SLA, field map, Zod); full UI running on MockProvider with demo seed
  and role-switcher. The whole app works at home.
- **Phase 2 — SharePointProvider**: REST provider built to Phase-0 findings;
  admin provision/verify-lists screen; `LIST_SETUP.md` + permissions recipe.
  Vertical slice verified on the real site.
- **Phase 3 — Parity & polish**: attachments, comments, audit timeline, Excel
  export, dashboard; empty/error/loading states; digest-expiry retry handling.
- **Phase 4 — Pilot**: `WORKFLOW_RECIPE.md` executed, smoke-test checklist,
  `DEPLOY_SP.md` final, seed/demo instructions, pilot with real users.

## 11. Working rules

1. Ask before adding any dependency beyond the locked stack.
2. `src/domain` stays pure TypeScript — no React, no SharePoint imports; it is
   the single source of truth for statuses, field map, validation, and SLA.
3. Write tests for the state machine, SLA math, and field-map validation.
4. Never claim something works on SP2019 without a Phase-0 verification or a
   `VERIFY-ON-SITE` marker.
5. Keep every doc in `docs/` current at the end of each phase.
6. Create a `CLAUDE.md` capturing these rules, the constraints in §2, and the
   architecture, so future sessions stay aligned.
