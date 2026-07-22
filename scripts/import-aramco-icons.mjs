// Converts official Aramco icon-library SVGs into theme-aware app assets:
// square viewBox, no embedded styles, stroke="currentColor" so the icon
// follows the surrounding text color. Source library (not in the repo):
// C:\ClaudeProjects\Iconography — see docs/BRAND_REVIEW.md.
// Usage: node scripts/import-aramco-icons.mjs   (re-run after adding names)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'C:/ClaudeProjects/Iconography/Iconography/Icons_SVG_2'
const OUT = 'src/assets/icons'
const ICONS = ['add_item', 'list', 'sheet']

mkdirSync(OUT, { recursive: true })
for (const name of ICONS) {
  let svg = readFileSync(join(SRC, `${name}.svg`), 'utf8')
  if (/fill:\s*#/.test(svg)) console.warn(`${name}: contains filled shapes — result may need manual review`)
  const [, vb] = /viewBox="([^"]+)"/.exec(svg)
  const [x, y, w, h] = vb.split(/\s+/).map(Number)
  const side = Math.max(w, h)
  const square = `${(x - (side - w) / 2).toFixed(2)} ${(y - (side - h) / 2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`
  svg = svg
    .replace(/<defs>[\s\S]*?<\/defs>/, '')
    .replace(/\s(?:id|data-name|class)="[^"]*"/g, '')
    .replace(/viewBox="[^"]*"/, `viewBox="${square}"`)
    .replace('<svg ', '<svg fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" ')
  writeFileSync(join(OUT, `${name}.svg`), svg)
  console.log(`${name}.svg -> ${OUT}`)
}
