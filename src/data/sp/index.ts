import type { DataProvider } from '../provider'

// SharePointProvider — Phase 2. Deliberately not implemented yet: it will be
// built to the modes the Phase 0 spike verifies on the real site (nometadata
// vs verbose writes, digest lifetime, attachment API). See docs/PHASE0_UPLOAD.md.

export function createSharePointProvider(): DataProvider {
  throw new Error(
    'SharePointProvider is Phase 2 — run the Phase 0 spike on the real site first (docs/PHASE0_UPLOAD.md)',
  )
}
