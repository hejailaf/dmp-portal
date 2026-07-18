// Turns the Vite build (dist/) into a SharePoint-ready package (dist-sp/ + zip):
//  - renames the .html entry pages to .aspx (Strict file handling on SP2019
//    downloads .html instead of rendering it; .aspx renders)
//  - stamps ?v=<build id> on every asset reference for cache busting, since
//    output filenames are fixed (no hashes) to keep uploads simple
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const build = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) // e.g. 202607161435
const out = 'dist-sp'

rmSync(out, { recursive: true, force: true })
mkdirSync(out)
cpSync('dist/assets', `${out}/assets`, { recursive: true })

for (const [src, dest] of [
  ['dist/index.html', `${out}/index.aspx`],
  ['dist/spike.html', `${out}/spike.aspx`],
]) {
  const html = readFileSync(src, 'utf8').replace(
    /(\.\/assets\/[\w.-]+\.(?:js|css))/g,
    `$1?v=${build}`,
  )
  writeFileSync(dest, html)
}

// ponytail: Windows-only zip via PowerShell; swap for a zip lib if this ever runs on CI/linux
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${out}/*' -DestinationPath 'dmp-sp.zip' -Force"`,
  { stdio: 'inherit' },
)

console.log(`Packaged build ${build} -> ${out}/ and dmp-sp.zip`)
