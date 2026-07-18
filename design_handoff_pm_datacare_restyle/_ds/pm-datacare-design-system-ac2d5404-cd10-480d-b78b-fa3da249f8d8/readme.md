# PM DataCare Design System

**PM DataCare** is an internal web portal that simplifies SAP PM (Plant Maintenance) master data changes. End users submit change requests (equipment, functional locations, task lists, maintenance plans); requests are assigned to a data maintainer who carries the actual change into the SAP PM system. Tagline: **"Streamlining SAP PM Master Data Changes."**

Source material: `uploads/PM_DataCare_Brand_Guide.pdf` (one-page brand guide: logo lockups, 7-color palette, header UI example, usage rules). No codebase, Figma, or font files were provided.

## Brand usage rules (from the guide)
- Preferred header asset: horizontal transparent logo. Icon-only mark for favicons, app tiles, compact nav, profile tiles.
- Clear space: at least the height of "PM" on all sides. Never stretch, rotate, recolor, add shadows, or place on busy backgrounds.
- Tagline may be omitted below 500px logo width.
- Use "SAP PM" descriptively; never incorporate the SAP corporate logo without approval.

## CONTENT FUNDAMENTALS
- **Tone**: calm, competent, service-desk friendly. Plain operational English, no hype, no exclamation marks, no emoji.
- **Person**: "you/your" for the user, "we/our team" for the maintainers. E.g. "Submit a request and one of our data maintainers will carry the change into SAP PM."
- **Casing**: sentence case everywhere (headings, buttons, labels). UPPERCASE only for small section labels/table headers (11–12px, +0.06em tracking).
- **Domain language**: use exact SAP PM terms — equipment, functional location, task list, maintenance plan, notification, cost center, plant. Reference transactions when helpful (e.g. "as shown in IE03").
- **IDs**: requests are `CR-####`; render IDs and metrics with tabular figures.
- **Buttons**: verb-first, specific ("Submit request", "View all requests" — not "OK", "Go").
- **Status vocabulary**: New → In progress → Completed, plus On hold and Rejected. Rejections always state the reason and the next step.

## VISUAL FOUNDATIONS
- **Colors**: Navy #0D3B66 (headings, inverse surfaces), Blue #1E63D6 (primary actions, links, active nav), Sky #38A9E0 (info, focus ring, accents), Teal #00A79D (success/completed, the "Care" in the wordmark), Light blue #E6F2FA (tint surfaces), Surface #F2F6FA (page background), Slate #607D8B (muted text, on-hold). Warning #E19A2F and Danger #D6455A are **intentional additions** (the guide defines no warning/error colors).
- **Type**: Open Sans (Google Fonts — substitution, see Caveats), weights 400/600/700/800. Navy headings, weight-driven hierarchy; 14px body, 13px secondary, 11–12px uppercase labels. Tabular numerals for IDs/counts.
- **Backgrounds**: flat pale blue-gray page (#F2F6FA), white cards. No gradients, textures, patterns, or illustrations.
- **Cards**: white, 10px radius, 1px #D6E2ED border + soft navy-tinted shadow (`--shadow-card`). Modals 14px radius over a navy scrim (rgba(13,59,102,.45)).
- **Radii**: 6px inputs/buttons, 10px cards, 14px modals, pill for badges.
- **Spacing**: 4px scale (`--space-1..12`); 1200px max content width; 64px header.
- **Borders**: hairline #D6E2ED; inputs #C3D4E2; sky focus ring (border + `--shadow-focus` glow).
- **Shadows**: all navy-tinted rgba(13,59,102,…), three levels: card / raised / overlay.
- **Animation**: subtle and fast — 120ms color/background transitions, 200ms switch travel, ease `cubic-bezier(.4,0,.2,1)`. No bounces, no large motion.
- **Hover**: darker fill on primary buttons, light-blue tint fill on ghost/rows/nav. Press: slightly darker again. Links underline on hover.
- **Imagery**: cool blue tones only; the brand uses flat gradient-filled iconographic marks (database + gear + shield), no photography in the guide.
- **Transparency/blur**: none observed — surfaces are opaque.
- **Layout**: fixed white top header with underline nav (per the guide's header example), centered content column, stat cards in a row, table-style request lists.

## ICONOGRAPHY
- The guide's header example uses thin stroke line icons (home, document, arrows, bar chart, clock, bell) — Lucide-style, ~2px stroke, no fill. No icon font or SVG set was provided; components draw minimal inline stroke SVGs matching this style. **Recommended set: Lucide (CDN)** — flag: this is a substitution, not a shipped asset.
- The logo mark (database + gear + shield-check, blue→teal gradients) is used only as a logo, never as a decorative illustration.
- No emoji, no unicode-as-icon.
- Notification counts render as small blue pill badges on the bell.

## Assets (`assets/`)
- `logo-horizontal.png` — primary lockup with tagline (cropped from the brand guide page; the original `PM_DataCare_Logo_Horizontal_Transparent_Trimmed.png` was NOT provided — see Caveats).
- `logo-icon.png` — icon-only mark. `logo-header.png` — compact header lockup, no tagline.
- `pdf_img_p1_0.png` — full brand-guide page render (reference).

## Index
- `styles.css` → `tokens/{colors,typography,spacing,effects}.css` — all custom properties.
- `guidelines/` — 12 specimen cards (Colors, Type, Spacing, Brand groups).
- `components/forms/` — Button, IconButton, Input, Select, Textarea, Checkbox (+Radio, Switch in Checkbox.jsx).
- `components/display/` — Card, Badge (+Tag). `components/navigation/` — Tabs, AppHeader. `components/feedback/` — Dialog, Toast (+Tooltip).
- `ui_kits/portal/` — interactive portal recreation: dashboard, requests queue, new-request form, request detail with status timeline (`index.html`).
- `SKILL.md` — agent skill entry point.

**Intentional additions** (no source defined them): warning/danger feedback colors; Field wrapper inside Input.jsx; AppHeader (recreated from the guide's header example); UI-kit screens beyond the header (no product screens were provided — layouts follow the guide's dashboard sketch).
