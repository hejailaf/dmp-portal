# Aramco Corporate Brand Review — PM DataCare

Reviewed 2026-07-22 against all 12 sections of the Aramco Brand Portal
(https://brand.aramco.com/guidelines/corporate). Decisions below are the
user's; the V1 palette shipped on the `experiments` branch.

## Official values used (from the portal)

- Primary: Aramco Green `#84BD00`, Aramco Blue `#00A3E0`, Dark Green
  `#00843D`, Dark Blue `#0033A0`; grays `#323232` / `#5F6369` / `#C0C0C0`
  / `#DADADA` / white.
- Secondary (internal-use palette): Teal `#26A8AB`, Purple `#643278`,
  Yellow `#FFC846`, Red `#F05F41`; only 70%/40% tints allowed.
- Rules that shaped the palette: "Don't add additional colors to the
  palette"; "The secondary color palette should be used for internal use,
  supported by primary"; data-viz uses the approved color set only, no
  gradients.

## Findings → outcomes

| Area | Guideline | App | Outcome |
|---|---|---|---|
| Typography | Segoe UI is the official English business-comms font; sentence case | Segoe UI stack, sentence case | Already compliant |
| Colors | Official palette only; secondary set for internal | Invented PM DataCare palette | **Remapped** (V1 "Teal internal", user-selected from 3 mockups): Dark Blue `#0033A0` interactive, Teal `#26A8AB` accent/Completed, gray-ramp chrome, Aramco Blue tint = In process, Yellow tint = Waiting, Red = Rejected/Overdue. See styles.css |
| Data & info | Approved chart colors, no gradients | Var-driven | Complies via the remap |
| Aramco mark | Institutional logo for internal audiences | None shown | **User decision: no Aramco mark** — app stays PM DataCare-branded |
| Iconography | No third-party icon sets; official library (15×15 grid, rounded) | lucide-react | **Hybrid**: official Aramco icons on the requester launchpad cards (`scripts/import-aramco-icons.mjs` converts from the local library at `C:\ClaudeProjects\Iconography`); lucide stays for functional UI chrome — the official library lacks UI verbs (close, trash, filter, copy…) |
| Gradient / energy lines / photography / illustration / sonic / grid | Marketing-material rules | Not used in the app | No action |

## Known deliberate deviations

1. `--warning` text `#997310`: Aramco Yellow `#FFC846` is illegible as
   text (1.6:1 on white). Yellow appears only as fills/tints; waiting and
   due-soon TEXT uses this derived dark ochre. Same derivation logic the
   dark theme applies to every accent (brightening for contrast).
2. Dark mode: guidelines don't define one. The warm-graphite neutral set
   is kept; accents are the V1 hues brightened for dark-surface contrast.
3. PM DataCare logo SVGs keep the pre-review blues/teal — the user is
   redesigning the wordmark in Figma (direction explored 2026-07-22:
   bold "Data"/"Care" stacked, "PM" full stack height); swap the SVGs in
   src/assets/ when the new artwork lands.
4. Excel export cell fills (amber `#FCE4A6` mandatory / grey `#E9E9E9`
   inapplicable) unchanged — functional colors in the SAP handover sheet,
   visually within the Yellow/gray families already.
