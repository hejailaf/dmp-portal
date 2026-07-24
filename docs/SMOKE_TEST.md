# SMOKE_TEST.md — pre-pilot checklist

Run top to bottom on the production site before inviting pilot users.
Everything is browser-only. Tick as you go.

## 1. Deployment current

- [ ] Latest `dist-sp` uploaded: `index.aspx`, `assets/index.js`,
      `assets/index.css` (hard refresh, Ctrl+F5).
- [ ] Browser tab shows the PM DataCare favicon and title.
- [ ] Dark mode toggle works; pick either theme for the rest.

## 2. Site setup screen (as admin)

- [ ] Verify & provision → all four lists green, "All fields present"
      (a first run on a fresh site reports ADDED fields, incl.
      CompletedAt/Description and the LastNotified* pair — the latter are
      unused since emails left SPD, but still provisioned and harmless).
- [ ] Groups check → all three exist.
- [ ] Connection self-test → all lines OK incl. DELETE and the
      EffectiveBasePermissions line ("AddListItems OK").
- [ ] "Make the app the site home page" → the confirmation echoes back
      **your** library path (e.g. `app/index.aspx` — it is derived from
      the page you are on, NOT a fixed name); opening the bare site URL
      now loads the app. If it echoes a library you do not have, the
      site URL will 404 — that was the 2026-07-24 bug.

## 3. Access & roles

- [ ] A DIRECT member of PMDC Requesters sees the Requester home.
- [ ] An AD-GROUP member (no direct membership) sees the Requester home.
- [ ] A maintainer sees queue/unassigned nav; an admin sees Dashboard +
      Site setup.
- [ ] All three PMDC groups have "view membership: Everyone"
      (LIST_SETUP.md §6.4).

## 4. Vertical slice (the money test)

- [ ] Requester: New request → description (counter caps at 60) → add an
      Equipment line (mandatory cells amber; number fields digits-only) →
      Save draft → Edit draft → Submit.
- [ ] Submit without description or with an invalid line is blocked with
      a clear message.
- [ ] Maintainer: request appears in Unassigned pool → Claim → Start
      work → Complete. Status badges update; the Action log fills in.
- [ ] Detail header shows the description headline, ref label, meta
      strip incl. Changed (updates after any action) and Completed.
- [ ] Reject path: second request → admin rejects with reason → requester
      sees the banner → Reopen → resubmit (SLA recomputed, reason gone).
- [ ] Return path: maintainer returns a request with a reason → requester
      EDITS IT DIRECTLY (no reopen) → resubmits → it goes back to the
      same assignee and the due date is pushed out by the paused time.
- [ ] Withdraw path: requester withdraws a waiting request → it leaves
      the maintainer queue → requester reopens it as a draft.

## 5. Attachments, comments, export

- [ ] Stage two files (one wrong pick → remove it before Upload) →
      Upload → both listed, audit updated. Blocked type (.txt) and the
      6-file cap show clear messages.
- [ ] Comment: capped at 1000 chars, long unbroken text wraps inside the
      card.
- [ ] Excel template: download for Equipment → fill two rows → import →
      lines appear with derived classification filled.
- [ ] Export to Excel on a detail page → Summary + one sheet per object
      type, derived columns present, amber/grey shading sensible.

## 5b. Pre-pilot features (added 2026-07-23)

- [ ] **Draft autosave**: start a request, type a description and a line,
      close the tab WITHOUT saving → reopen → the amber restore notice
      offers the draft back; Discard returns to the server copy.
- [ ] **Duplicate as draft** (More menu): produces a new draft with the
      same lines and a NEW ref; attachments are not copied.
- [ ] **List export**: filter the list, then "Export view" → the sheet
      holds exactly the filtered rows, in the on-screen sort order.
- [ ] **Fit columns**: drag a column wider → the button activates → click
      → widths return to auto-fit.
- [ ] Line-items tabs on the detail page: switching type keeps the grid
      OPEN; clicking the active tab (or the chevron) collapses it.

## 6. Dashboard (as admin)

- [ ] KPI cards match the request counts, including **Withdrawn**; cards
      click through to filtered lists.
- [ ] Time window (all / this month / this quarter) re-scopes the KPIs
      and the maintainer table; drafts drop out of a windowed view.
- [ ] Maintainer table shows open/completed; on-time % and cycle time
      populate for requests completed AFTER the CompletedAt upgrade.

## 7. Email notifications (sent by the app — WORKFLOW_RECIPE.md §A)

Nothing to build first; the notifications ship in the build. Prove the
farm can actually send (§A "On-site checks") before ticking these.

- [ ] Submit → maintainers email. Assign → assignee email.
      Reject → requester email with reason. Complete → requester email.
- [ ] Return → requester email with the reason. Resubmit after a return →
      the ASSIGNEE only, not the whole maintainer group.
- [ ] Withdraw → the assignee is told. Add a comment → the other
      participants get it.
- [ ] You are never emailed about your own action (self-claim a request:
      no mail to you).
- [ ] Deep links in the emails open the right request on THIS site
      (they are derived from the running page, not hardcoded).
- [ ] A blocked/failing send never breaks the action — the status change
      still commits and the UI shows no error.

## 8. Pilot readiness

- [ ] Share ONE link: the bare site URL of THIS site (whatever the
      subsite is called — e.g. `…/ss`), which serves the app once §2's
      home-page step is done.
- [ ] Nominate 3–5 pilot requesters + the maintainer team; agree the
      pilot window and a feedback channel.
- [ ] Known limits communicated: no overdue reminder emails (dashboard
      shows overdue), no in-app attachment delete, pending attachment
      picks are lost on page reload.
- [ ] Backlog reminder: migrate off the personal site collection to a
      team site before broad (post-pilot) rollout — DEPLOY_SP.md note.

Training collateral: docs/PM-DataCare-Requester-Guide.pptx (annotated
walkthrough for pilot requesters). ⚠ **Screenshots are from 2026-07-20,
before the UI overhaul and the "Action log" rename — the flow is right
but the pictures and some wording are not.** Refresh deferred until the
new site is live; either redo it before handing out, or tell pilot users
the screens have moved on.
