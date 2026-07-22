import { useCallback, useEffect, useState } from 'react'
import { S } from './strings'

interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
  reload: () => void
}

/** Tiny data-fetching hook — enough for a same-origin internal tool; no query library needed. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [bump, setBump] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    fn().then(
      (d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      },
      (e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, bump])

  const reload = useCallback(() => setBump((b) => b + 1), [])
  return { data, error, loading, reload }
}

/** Browser-tab title per screen: "DCR-260003 · PM DataCare". Pass undefined while loading. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${S.appName}` : S.appName
    return () => {
      document.title = S.appName
    }
  }, [title])
}
