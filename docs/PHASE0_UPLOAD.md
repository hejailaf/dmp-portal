# Phase 0 — Upload & Report Recipe

Everything here is done in the browser at work. No terminal, no admin tools
beyond normal site-owner rights.

## What this proves

The spike page verifies, on the real SP2019 site, every assumption the
production app depends on. Until you report results, nothing in Phase 2+ gets
built on those assumptions.

| Check | Assumption being verified |
|---|---|
| P0-1 | A static `.aspx` page in a document library renders and its bundled script runs (not blocked by Strict file handling or custom-script policy) |
| P0-2 | `/_api/web/currentuser` + group membership works with `odata=nometadata` |
| P0-3 | `/_api/contextinfo` hands out a form digest for writes |
| P0-4 | Creating a list, creating an item, reading it back, and updating via `X-HTTP-Method: MERGE` + `IF-MATCH: *` all work — and whether writes need `__metadata` (verbose) or not (nometadata) |
| P0-5 | Item attachments via `AttachmentFiles/add` work |

## One-time setup

1. On your SharePoint site, create a **document library** named `DMPApp`
   (Gear icon → Site contents → New → Document library).
2. Build the package at home: `npm run package:sp`. It produces a `dist-sp/`
   folder (and `dmp-sp.zip`).

## Upload

1. Open the `DMPApp` library in the browser.
2. Drag in **`spike.aspx`** from `dist-sp/`.
3. Create a folder named **`assets`** in the library, open it, and drag in
   **`assets/spike.js`** and **`assets/client.js`** (the shared React
   runtime — the spike needs both).
4. Click `spike.aspx` in the library (or browse to
   `https://<your-site>/DMPApp/spike.aspx`).

## Run and report

1. If the page is **blank or downloads instead of rendering** → that itself is
   the result. Report: "P0-1 failed — page blank/downloaded", plus any message
   shown. (Likely cause: custom script blocked on the web application; the
   fix is an admin setting — we'll address it before anything else.)
2. Otherwise click **Run all checks**. The write checks will create a scratch
   list called `DMP_Spike` — that's intentional and safe to delete afterwards.
   - If list creation fails with an access error, create the list manually
     (Site contents → New → List, name it `DMP_Spike`) and click Run again.
3. Click **Copy results to clipboard** and paste the text back to me — or
   take a screenshot of the whole panel. Either is a complete report.

## What happens with the results

- All green → Phase 2 (the real SharePoint data provider) gets built exactly
  to the modes that passed (especially P0-4's nometadata-vs-verbose finding).
- Any red → we fix or redesign around that specific assumption before
  building anything that depends on it.

## Cleanup (optional)

Delete the `DMP_Spike` list and `spike.aspx` whenever you're done — the real
app doesn't use them.
