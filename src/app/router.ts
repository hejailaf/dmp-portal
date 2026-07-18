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
