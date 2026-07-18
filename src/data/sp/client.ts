// SP2019 REST client — built to the Phase-0 spike findings (2026-07-19):
//   - nometadata JSON is accepted for ALL writes (no __metadata needed)
//   - digest TTL 1800s (refreshed on demand with a safety margin — no timers)
//   - the app lives in a document library below the web, so the web URL is
//     discovered by walking up the path until /_api answers (spike-proven)

const NOMETA = 'application/json;odata=nometadata'
const DIGEST_MARGIN_MS = 120_000

const short = (data: unknown) => {
  const s = typeof data === 'string' ? data : JSON.stringify(data)
  return s && s.length > 300 ? s.slice(0, 300) + '…' : (s ?? '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorMessage(data: any): string {
  return (
    data?.['odata.error']?.message?.value ??
    data?.error?.message?.value ??
    (typeof data === 'string' && data ? short(data) : 'SharePoint request failed')
  )
}

let webUrlPromise: Promise<string> | undefined

async function discoverWebUrl(): Promise<string> {
  const segs = window.location.pathname.split('/').filter(Boolean).slice(0, -1)
  for (let i = segs.length; i >= 0; i--) {
    const candidate = i === 0 ? '' : '/' + segs.slice(0, i).join('/')
    try {
      const res = await fetch(candidate + '/_api/web?$select=Title', {
        headers: { Accept: NOMETA },
        credentials: 'same-origin',
      })
      if (res.ok) return candidate
    } catch {
      // keep walking up
    }
  }
  throw new Error(`Could not locate the SharePoint site from ${window.location.pathname}`)
}

/** Server-relative URL of the SharePoint web hosting the app (cached). */
export function webUrl(): Promise<string> {
  return (webUrlPromise ??= discoverWebUrl())
}

let digest: { value: string; fetchedAt: number; ttlMs: number } | undefined

async function getDigest(force = false): Promise<string> {
  if (!force && digest && Date.now() - digest.fetchedAt < digest.ttlMs - DIGEST_MARGIN_MS) {
    return digest.value
  }
  const base = await webUrl()
  const res = await fetch(base + '/_api/contextinfo', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: NOMETA },
  })
  const data = await readJson(res)
  if (!res.ok || !data?.FormDigestValue) {
    throw new Error('Could not get a SharePoint form digest: ' + errorMessage(data))
  }
  digest = {
    value: data.FormDigestValue,
    fetchedAt: Date.now(),
    ttlMs: (data.FormDigestTimeoutSeconds ?? 1800) * 1000,
  }
  return digest.value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function spGet(path: string): Promise<any> {
  const base = await webUrl()
  const res = await fetch(base + path, { headers: { Accept: NOMETA }, credentials: 'same-origin' })
  const data = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(data))
  return data
}

async function writeRequest(
  path: string,
  body: unknown,
  headers: Record<string, string>,
  retried = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const base = await webUrl()
  const res = await fetch(base + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: NOMETA,
      'X-RequestDigest': await getDigest(),
      ...(body !== undefined && !(body instanceof ArrayBuffer) && { 'Content-Type': NOMETA }),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof ArrayBuffer ? body : JSON.stringify(body),
  })
  // expired digest → refresh once and retry (spec: digest-expiry handling)
  if (res.status === 403 && !retried) {
    await getDigest(true)
    return writeRequest(path, body, headers, true)
  }
  if (res.status === 204) return {}
  const data = await readJson(res)
  if (!res.ok) throw new Error(errorMessage(data))
  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function spPost(path: string, body?: unknown): Promise<any> {
  return writeRequest(path, body, {})
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function spMerge(path: string, body: unknown): Promise<any> {
  return writeRequest(path, body, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' })
}

/** Verified on-site 2026-07-19 via the provision screen's connection self-test ("DELETE OK"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function spDelete(path: string): Promise<any> {
  return writeRequest(path, undefined, { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' })
}

/** Raw-body POST (attachments). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function spPostRaw(path: string, body: ArrayBuffer): Promise<any> {
  return writeRequest(path, body, {})
}

/** REST path for a list by title. */
export function listPath(title: string): string {
  return `/_api/web/lists/getbytitle('${title}')`
}
