# DEPLOY_SP.md — Browser-only deployment guide

Everything here happens in the browser at work. No terminal, no admin center
beyond normal site-owner rights.

> **Where we are now:** only Phase 0 (the spike) should be uploaded so far.
> Follow `PHASE0_UPLOAD.md` for that. The full first-time setup below becomes
> relevant when Phase 2 ships; the routine-update procedure at the bottom is
> final and won't change.

## First-time setup (once, when the real app deploys — Phase 2+)

1. **Document library** — create a library named `DMPApp` (Site contents →
   New → Document library).
2. **Groups** — create three SharePoint groups (Site settings → People and
   groups): `DMP Requesters`, `DMP Maintainers`, `DMP Admins`, and add the
   right people. The app maps roles from these exact names.
3. **Lists** — Phase 2 ships an admin Provision screen in the app plus
   `LIST_SETUP.md` with the manual recipe (4 lists: DMP_Requests,
   DMP_RequestLines, DMP_Comments, DMP_AuditLog).
4. **Permissions** — recipe ships with `LIST_SETUP.md` (Requesters
   contribute-no-delete, Maintainers edit, Admins full).
5. **Notifications** — Phase 4 ships `WORKFLOW_RECIPE.md` (SharePoint
   Designer 2013 workflow, click-by-click).

## Routine update (every new build)

1. At home: `npm run package:sp` → produces `dist-sp/` and `dmp-sp.zip`.
2. Bring the files to work (per your normal transfer method).
3. Open the `DMPApp` library → drag in `index.aspx` (and `spike.aspx` if you
   want the diagnostics page updated), replacing the existing files.
4. Open the `assets` folder → drag in everything from `dist-sp/assets/`,
   replacing existing files.
5. Hard-refresh the app (Ctrl+F5). Stale caches are already defeated by the
   `?v=BUILD` query stamped on every asset reference, so a normal reload
   works too.

Filenames never change between builds (no hashes), so an upload is always a
clean in-place replace — no orphaned files accumulate.

## Rollback

Document libraries keep version history: select the file → Version history →
restore the previous version of `index.aspx` and the `assets` files.
