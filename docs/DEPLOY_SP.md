# DEPLOY_SP.md — Browser-only deployment guide

Everything here happens in the browser at work. No terminal, no admin center
beyond site-owner rights on the **dmp subsite** (created 2026-07-19, unique
permissions — Phase 0 verified everything renders and writes there).

> **Note on location:** the site currently lives under a personal site
> collection (`/personal/<you>/dmp`). That's fine for the pilot but tied to
> your account — before broad rollout, ask IT for a small team site and
> repeat this first-time setup there (re-upload + re-provision; moving
> existing list data across is a separate exercise).

## First-time setup (once — Phase 2)

1. **Document library** — `DMPApp` on the dmp subsite (done during Phase 0).
2. **Upload the app** — from `dist-sp/`: `index.aspx` (+ `spike.aspx` if you
   want diagnostics available) into the library root; everything from
   `dist-sp/assets/` into the library's `assets` folder.
3. **Groups** — create `DMP Requesters` / `DMP Maintainers` / `DMP Admins`
   per `LIST_SETUP.md` §1 and put yourself in DMP Admins.
4. **Lists** — open `index.aspx` → **Site setup** in the nav → **Verify &
   provision lists** (all green), then **Run connection self-test** (ends
   with "DELETE OK"). Manual fallback: `LIST_SETUP.md` §3.
5. **Permissions** — apply `LIST_SETUP.md` §4 (two custom levels, per-list
   grants, Read on the subsite for all three groups).
6. **Vertical slice** — run `LIST_SETUP.md` §5's checks, including a
   non-owner colleague opening the app.
7. **Notifications** — Phase 4 ships `WORKFLOW_RECIPE.md` (SharePoint
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
