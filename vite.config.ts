import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Hard constraints (see docs/DMP_FROM_SCRATCH_PROMPT.md §9):
// - base './' — the app lives in a SharePoint document library, not a site root
// - fixed output filenames (no hashes) — cache-busting is done with ?v=BUILD
//   query strings stamped by scripts/package-sp.mjs
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // inline the ~9KB header logo SVGs as data URIs (default limit is 4KB) —
    // fewer files to upload to the SharePoint library, and no reliance on
    // SP2019 serving .svg from a doc library
    assetsInlineLimit: 16384,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        spike: fileURLToPath(new URL('./spike.html', import.meta.url)),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
