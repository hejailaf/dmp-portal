import { useSyncExternalStore } from 'react'

// Hash-based routing, hand-rolled (~40 lines): the app is served as a static
// page from a document library, so path-based routing can never work there —
// and a router dependency isn't justified for five routes.

export interface Route {
  /** hash path without query, e.g. "/requests/r-1" */
  path: string
  segments: string[]
  query: URLSearchParams
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, queryString] = raw.split('?')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return {
    path: normalized,
    segments: normalized.split('/').filter(Boolean),
    query: new URLSearchParams(queryString ?? ''),
  }
}

let current = parse()

// ── navigation guard ────────────────────────────────────────────────────────
// The editor blocks leaving with unsaved changes. This listener is registered
// at module load, BEFORE React's subscribe below — so it runs first and can
// revert the hash before the router re-renders (a component-level hashchange
// listener would be unmounted mid-event and never fire).
type NavGuard = () => boolean
let activeGuard: NavGuard | null = null
let lastHash = window.location.hash
let reverting = false

/** One guard at a time (only the editor uses it). Pass null to clear. */
export function setNavGuard(guard: NavGuard | null) {
  activeGuard = guard
  lastHash = window.location.hash
}

window.addEventListener('hashchange', () => {
  if (reverting) {
    reverting = false
    return
  }
  if (activeGuard && !activeGuard()) {
    reverting = true
    window.location.hash = lastHash // synchronous — the router below sees the old route
    return
  }
  lastHash = window.location.hash
})

function subscribe(cb: () => void) {
  const handler = () => {
    current = parse()
    cb()
  }
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current)
}

export function navigate(to: string) {
  window.location.hash = to
}

export function href(to: string) {
  return `#${to}`
}
