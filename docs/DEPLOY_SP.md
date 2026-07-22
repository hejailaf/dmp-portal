# DEPLOY_SP.md — Browser-only deployment guide

Everything here happens in the browser at work. No terminal, no admin center
beyond site-owner rights on the **PM DataCare subsite** (created 2026-07-19,
unique permissions — Phase 0 verified everything renders and writes there;
URL segment renamed `dmp` → `pmdc` on 2026-07-19).

> **Note on location:** the site currently lives under a personal site
> collection (`/personal/<you>/pmdc`). That's fine for the pilot but tied to
> your account — before broad rollout, move to a subsite under a team site:
> see "Moving to a new subsite" at the end of this file.

## First-time setup (once — Phase 2)

1. **Document library** — `PMDCApp` on the pmdc subsite.
2. **Upload the app** — from `dist-sp/`: `index.aspx` (+ `spike.aspx` if you
   want diagnostics available) into the library root; everything from
   `dist-sp/assets/` into the library's `assets` folder.
3. **Groups** — create `PMDC Requesters` / `PMDC Maintainers` / `PMDC Admins`
   per `LIST_SETUP.md` §1 and put yourself in PMDC Admins.
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
3. Open the `PMDCApp` library → drag in `index.aspx` (and `spike.aspx` if you
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

## Friendly URL: the app as the site home page (added 2026-07-19)

Site setup screen -> "Make the app the site home page" points the site
welcome page at PMDCApp/index.aspx, so the bare site URL (…/pmdc) opens
the app directly - that is the link to share with users. Revert by
setting it back to SitePages/Home.aspx (ask Claude, or use the same REST
call). Note: the LIBRARY URL (…/pmdc/PMDCApp) cannot be redirected -
SharePoint hardwires it to the file list; users landing there click
index.aspx.

## Pilot

Before inviting pilot users, run docs/SMOKE_TEST.md top to bottom, and
execute docs/WORKFLOW_RECIPE.md once for the email notifications.

## Moving to a new subsite (off the personal site collection)

Groups, permission levels, lists, and workflows are all per site
collection — NOTHING carries over. The move is a clean re-run of
first-time setup on the new site; only the subsite creation step below is
new. Budget ~1–2 hours.

**0. Ask IT for a team site.** This is the step that actually fixes the
risks (account-tied deletion, backup/retention, quota). Ask for a small
**team site collection** and **Full Control** (site owner) on it. Creating
the new subsite under your personal site again would change nothing.

**1. Create the subsite.** On the team site: Gear → **Site contents** →
**New → Subsite**:
- Title `PM DataCare`, URL name `pmdc`
- Template: **Team Site (classic experience)** preferred — matches the
  verified setup; the modern "Team Site" also works (if used, just
  re-check the "Make the app the site home page" step at the end)
- User Permissions: **Use unique permissions** ← important; this saves the
  "Stop Inheriting" detour in LIST_SETUP.md §4a
- Create. On the "Set Up Groups for this Site" page accept the defaults
  (create new Visitor/Member/Owner groups) — the PMDC groups come next and
  are the ones that matter. (§4b's note applies: Members get Edit; you can
  trim that to Read later.)

**2. Library.** Site contents → New → **Document library** named `PMDCApp`;
inside it create a folder named `assets`.

**3. Upload the current build** — `index.aspx` (+ `spike.aspx` if wanted)
to the library root, everything from `dist-sp/assets/` into `assets`
(same as a routine update).

**4. Groups** — LIST_SETUP.md §1: create the three `PMDC *` groups fresh on
this site, exact names. Then per §6: set "Who can view the membership" =
**Everyone** on all three, add yourself to PMDC Admins, and re-add the AD
security group into PMDC Requesters.

**5. Lists** — open `index.aspx` → **Site setup** → **Verify & provision
lists** (all green — this creates all four lists with every current
column, CompletedAt/Description/LastNotified*/KeyedAt included, and the
`Withdrawn` status choice, so no re-run needed later) → **Run connection
self-test** (ends "DELETE OK"). Provision with a build from 2026-07-22
or later: earlier builds create the RequestStatus choice WITHOUT
`Withdrawn`, and provisioning never edits an existing column's choices.

**6. Permissions** — LIST_SETUP.md §4 in full: recreate the two custom
permission levels (per-collection, so they don't exist here yet) and the
per-list grants; Read on the subsite for all three groups.

**7. Verify** — LIST_SETUP.md §5 with a non-owner colleague.

**8. Friendly URL** — Site setup → "Make the app the site home page";
share the bare `…/pmdc` URL.

**9. Emails** — workflows live on the old site's lists and do not move:
re-run WORKFLOW_RECIPE.md on the new lists. Then SMOKE_TEST.md before
inviting anyone. After the workflow works: Site setup → **"Hide lists
from Site contents"** (LIST_SETUP.md §7.7).

**10. Retire the old site.** If the old site holds only test data there is
nothing to migrate — once §5/§7 pass on the new site, delete the old
`pmdc` subsite (or leave it and just stop sharing the link) so nobody
files requests in two places. If real requests exist by then, ask Claude
for a one-off copy plan first.
