# Handoff: PM DataCare design-system restyle of dmp-portal

## Overview
Apply the **PM DataCare brand design system** to the existing `dmp-portal` React app (repo: `hejailaf/dmp-portal`, branch `master`). This is a **presentation-layer-only** change: no changes to `src/domain/` or `src/data/` except the request-reference format. The app's structure (pages, components, routing, state) stays exactly as it is today.

## About the Design Files
`PM DataCare Portal.dc.html` in this bundle is a **design reference created in HTML** — a clickable prototype showing the intended look and behavior. It is NOT production code to copy. The task is to **recreate this styling inside dmp-portal's existing environment** (React 18 + Tailwind + shadcn-style components + CSS-variable theme in `src/styles.css`). Almost everything maps to token changes plus small class edits in existing files.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and states are final. Recreate pixel-perfectly using the codebase's existing Tailwind/shadcn patterns.

## Scope of changes (by file in dmp-portal)

### 1. `src/styles.css` — replace the theme tokens
The app already reads every color from HSL CSS variables. Replace with the PM DataCare palette.

**Light (`:root`)** — brand hex → HSL triplets for the existing variable names:
| Variable | Brand hex | HSL value |
|---|---|---|
| `--background` | #F2F6FA (Surface) | `210 44% 96%` |
| `--foreground` | #33475B (body text) | `210 28% 28%` |
| `--card` | #FFFFFF | `0 0% 100%` |
| `--card-foreground` | #33475B | `210 28% 28%` |
| `--primary` | #1E63D6 (Blue) | `218 71% 48%` |
| `--primary-foreground` | #FFFFFF | `0 0% 100%` |
| `--secondary` | #E7EDF4 (navy tint) | `212 37% 93%` |
| `--secondary-foreground` | #0D3B66 (Navy) | `209 78% 23%` |
| `--muted` | #F2F6FA | `210 44% 96%` |
| `--muted-foreground` | #607D8B (Slate) | `199 18% 46%` |
| `--accent` | #E6F2FA (Light blue) | `204 67% 94%` |
| `--accent-foreground` | #1854B8 (blue hover) | `217 77% 41%` |
| `--destructive` | #D6455A (Danger) | `352 64% 55%` |
| `--destructive-foreground` | #FFFFFF | `0 0% 100%` |
| `--border` | #D6E2ED (hairline) | `209 39% 88%` |
| `--input` | #C3D4E2 (input border) | `207 35% 83%` |
| `--ring` | #38A9E0 (Sky — focus) | `200 73% 55%` |
| `--radius` | 10px cards / 6px inputs | keep `0.5rem`; see Radii note |

**Dark (`.dark`)** — derived navy palette (approved in the prototype):
| Variable | Hex | HSL value |
|---|---|---|
| `--background` | #0B1E33 | `212 65% 12%` |
| `--foreground` | #C2D4E4 | `208 39% 83%` |
| `--card` | #102A44 | `210 62% 16%` |
| `--card-foreground` | #C2D4E4 | `208 39% 83%` |
| `--primary` | #4E8FE8 | `215 77% 61%` |
| `--primary-foreground` | #FFFFFF | `0 0% 100%` |
| `--secondary` | #1A3A57 | `208 54% 22%` |
| `--secondary-foreground` | #DCE9F5 | `209 56% 91%` |
| `--muted` | #16405F | `205 62% 23%` |
| `--muted-foreground` | #84A0B5 | `206 25% 61%` |
| `--accent` | #16405F | `205 62% 23%` |
| `--accent-foreground` | #A5C8F5 | `214 80% 80%` |
| `--destructive` | #E36A7B | `352 68% 65%` |
| `--border` | #1E3C58 | `209 49% 23%` |
| `--input` | #2E5170 | `208 42% 31%` |
| `--ring` | #4FB8E8 | `199 77% 61%` |

Also add non-shadcn brand hexes as plain variables (used by badges below): `--teal: #00A79D`, `--teal-tint: #E0F5F3`, `--warning: #E19A2F`, `--warning-tint: #FBF1DE`, `--danger-tint: #FBE7EA`, `--sky-tint: #EAF6FC`, `--navy: #0D3B66`. Dark equivalents: teal #2BBFB4 on #0E3A38, warning #E9AA4B on #3A2A12, danger tint #3D1B24, sky tint #12374C.

**Font**: keep `'Segoe UI', system-ui, -apple-system, sans-serif` (production constraint: no CDN fonts). Do NOT add Open Sans.

### 2. `src/app/components/ui/badge.tsx` — brand badge colors + dot
Replace stock Tailwind colors with brand values and add a 7px status dot before the label (see prototype). Pill shape stays. Variant mapping (light / dark):
- `neutral` (Draft): text Slate #607D8B on #E7EDF4 / #8AA5B8 on #1A3A57
- `blue` (In process): text #1E63D6 on #EAF6FC / #4E8FE8 on #12374C
- `green` (Completed): text #00A79D on #E0F5F3 / #2BBFB4 on #0E3A38
- `amber` (Waiting to be started): text #E19A2F on #FBF1DE / #E9AA4B on #3A2A12
- `red` (Rejected/overdue): text #D6455A on #FBE7EA / #E36A7B on #3D1B24
- `outline` (SLA countdown): border `--border-strong` #B9CDDD, muted text, transparent bg
Badge spec: height 24px, padding 0 11px, font 12.5px/600, pill radius, 7px round dot in the text color (dot on status badges; SLA badges have no dot).

### 3. `src/app/App.tsx` — brand-guide header
- Header height **64px** (`h-16`, currently `h-14`), white card background, 1px bottom hairline (as today).
- Replace the wrench-icon square + app name with the logo image: `logo-header.png` (light) / `logo-header-dark.png` (dark), `height: 34px`. Both files are in `assets/` in this bundle — copy to the repo (e.g. `src/assets/`) and import. Swap on theme (simplest: render both with `dark:hidden` / `hidden dark:block`).
- `NavLink`: change from rounded-pill to **underline nav**: no background, `text-sm font-semibold`, full header height, `border-b-[2.5px]`; active = primary text + primary underline; inactive = muted text, transparent underline, hover → foreground. 120ms color transition.
- Keep ThemeToggle and user name on the right; optionally add the bell with a blue count pill (see prototype header — 20px stroke icon, 16px blue pill, count = overdue requests in the user's scope).

### 4. `src/domain/ref.ts` — reference format
Change generated refs from `REQ-YYYY-NNNN` to **`DCR-YYNNNN`** (e.g. `DCR-260009`): "DCR-" + 2-digit year + 4-digit sequence. Update any parsing/tests accordingly. Status vocabulary is **unchanged** (Draft / Waiting to be started / In process / Completed / Rejected).

### 5. Everything else — verify, don't redesign
Tables, tab pills, editor grid, dialogs, cards all inherit the new tokens automatically. Check against the prototype:
- Cards: 10px radius, 1px border + navy-tinted shadow `0 1px 2px rgba(13,59,102,.06), 0 3px 10px rgba(13,59,102,.07)`.
- Dialogs: 14px radius, scrim `rgba(13,59,102,.45)`, shadow `0 12px 40px rgba(13,59,102,.22)`.
- Inputs/buttons: 6px radius, 40px height (sm 32px), focus = sky border + `0 0 0 3px rgba(56,169,224,.35)` glow.
- Table headers: uppercase 11px, +0.06em tracking, muted, on `--background` — already close in `ui/table.tsx`.
- Editor mandatory cells: warning tint #FBF1DE (dark #3A2A12) instead of Tailwind amber-50; invalid cells danger tint #FBE7EA.
- Transitions: 120ms, ease `cubic-bezier(.4,0,.2,1)`. No new animations.
- Row/nav/ghost hover: light-blue tint fill (`--accent`), links underline on hover.
- IDs and counts: tabular numerals (`font-variant-numeric: tabular-nums`).

## Interactions & Behavior
All existing behavior is unchanged. The prototype demonstrates: underline nav, stat-card hover (border → sky), row hover tint, claim/assign/reject/transition flows, dark-mode toggle, editor tabs with counts + error dots. Use it as the visual acceptance reference — open `PM DataCare Portal.dc.html` in a browser; the bundled `_ds/` and `assets/` folders must sit next to it.

## Design Tokens (canonical)
Navy #0D3B66 · Blue #1E63D6 (hover #1854B8, active #134497) · Sky #38A9E0 · Teal #00A79D (hover #00907F) · Light blue #E6F2FA · Surface #F2F6FA · Slate #607D8B · Warning #E19A2F · Danger #D6455A. Border #D6E2ED, border-strong #B9CDDD, input border #C3D4E2. Spacing on a 4px scale; content max 1200px (home page cap; data pages full-width as today). Radii: 6 / 10 / 14 / pill. Type: Segoe UI 400/600/700/800; 14px body, 13px secondary, 11-12px uppercase labels; headings navy (#0D3B66 light, #DCE9F5 dark).

## Assets
- `assets/logo-header.png` — header lockup for light mode (from the PM DataCare brand guide).
- `assets/logo-header-dark.png` — dark-mode variant (transparent background, navy "PM" recolored light; generated for this handoff).
- `assets/logo-icon.png` — icon-only mark (favicon / compact use).

## Files in this bundle
- `README.md` — this document (self-sufficient implementation spec).
- `PM DataCare Portal.dc.html` + `support.js` + `_ds/` — the clickable design reference and its token stylesheets (`_ds/.../tokens/*.css` hold every custom property).
- `assets/` — logo assets to copy into the repo.

## Suggested Claude Code prompt
> Open this repo (dmp-portal). Implement the design restyle described in `design_handoff_pm_datacare_restyle/README.md`, sections 1-5, exactly. Presentation layer only — do not change domain logic or data providers except the ref format in section 4. Run the existing tests when done.
