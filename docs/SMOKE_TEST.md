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
      (first run after the Phase-3/4 builds reports ADDED fields:
      CompletedAt, Description, LastNotifiedStatus, LastNotifiedAssignee).
- [ ] Groups check → all three exist.
- [ ] Connection self-test → all lines OK incl. DELETE and the
      EffectiveBasePermissions line ("AddListItems OK").
- [ ] "Make the app the site home page" → confirmation shows
      `DMPApp/index.aspx`; opening the bare site URL now loads the app.

## 3. Access & roles

- [ ] A DIRECT member of DMP Requesters sees the Requester home.
- [ ] An AD-GROUP member (no direct membership) sees the Requester home.
- [ ] A maintainer sees queue/unassigned nav; an admin sees Dashboard +
      Site setup.
- [ ] All three DMP groups have "view membership: Everyone"
      (LIST_SETUP.md §6.4).

## 4. Vertical slice (the money test)

- [ ] Requester: New request → description (counter caps at 60) → add an
      Equipment line (mandatory cells amber; number fields digits-only) →
      Save draft → Edit draft → Submit.
- [ ] Submit without description or with an invalid line is blocked with
      a clear message.
- [ ] Maintainer: request appears in Unassigned pool → Claim → Start
      work → Complete. Status badges update; audit trail fills in.
- [ ] Detail header shows the description headline, ref label, meta
      strip incl. Changed (updates after any action) and Completed.
- [ ] Reject path: second request → admin rejects with reason → requester
      sees the banner → Reopen → resubmit (SLA recomputed, reason gone).

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

## 6. Dashboard (as admin)

- [ ] KPI cards match the request counts; cards click through to
      filtered lists.
- [ ] Maintainer table shows open/completed; on-time % and cycle time
      populate for requests completed AFTER the CompletedAt upgrade.

## 7. Email workflow (after WORKFLOW_RECIPE.md is executed)

- [ ] Submit → maintainers email. Assign → assignee email.
      Reject → requester email with reason. Complete → requester email.
- [ ] Deep links in the emails open the right request.
- [ ] No duplicate emails on unrelated edits (guards working).

## 8. Pilot readiness

- [ ] Share ONE link: the bare site URL (…/pmdc).
- [ ] Nominate 3–5 pilot requesters + the maintainer team; agree the
      pilot window and a feedback channel.
- [ ] Known limits communicated: no overdue reminder emails (dashboard
      shows overdue), no in-app attachment delete, pending attachment
      picks are lost on page reload.
- [ ] Backlog reminder: migrate off the personal site collection to a
      team site before broad (post-pilot) rollout — DEPLOY_SP.md note.

Training collateral: docs/PM-DataCare-Requester-Guide.pptx (annotated
walkthrough for pilot requesters).
