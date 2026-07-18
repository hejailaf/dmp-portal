import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

// ─────────────────────────────────────────────────────────────────────────────
// DMP Phase 0 feasibility spike (spec §10, Phase 0).
//
// A standalone diagnostics page that verifies, ON THE REAL SP2019 SITE, every
// assumption the production SharePointProvider will be built on. Each check
// maps to one VERIFY-ON-SITE assumption. Upload dist-sp/spike.aspx and
// dist-sp/assets/spike.js to the DMPApp document library, open spike.aspx,
// click "Run all checks", then copy/screenshot the results.
//
// Run at home (npm run dev → /spike.html): the page renders but the API
// checks fail — that is expected; there is no SharePoint at home.
// ─────────────────────────────────────────────────────────────────────────────

const SCRATCH_LIST = 'DMP_Spike'
const NOMETA = 'application/json;odata=nometadata'
const VERBOSE = 'application/json;odata=verbose'

type Status = 'pending' | 'running' | 'pass' | 'fail'

interface Check {
  id: string
  name: string
  verifies: string
  status: Status
  detail: string[]
}

const INITIAL: Check[] = [
  {
    id: 'P0-1',
    name: 'Page renders from a document library',
    verifies: 'Static .aspx shell + bundled ES module script execute (not blocked by file handling / custom-script settings)',
    status: 'pass',
    detail: ['You can see this panel, so the bundle executed. PASS by definition.'],
  },
  {
    id: 'P0-2',
    name: 'Identity via Windows auth',
    verifies: "GET /_api/web/currentuser?$expand=Groups with Accept: odata=nometadata",
    status: 'pending',
    detail: [],
  },
  {
    id: 'P0-3',
    name: 'Form digest',
    verifies: 'POST /_api/contextinfo returns FormDigestValue (+ timeout) for authenticating writes',
    status: 'pending',
    detail: [],
  },
  {
    id: 'P0-4',
    name: 'List create / item write / MERGE update',
    verifies: `Create list "${SCRATCH_LIST}" if missing, add an item, read it back, update via X-HTTP-Method: MERGE + IF-MATCH: *`,
    status: 'pending',
    detail: [],
  },
  {
    id: 'P0-5',
    name: 'Attachment',
    verifies: "POST .../AttachmentFiles/add(FileName='spike.txt'), then list attachments",
    status: 'pending',
    detail: [],
  },
]

const short = (data: unknown) => {
  const s = typeof data === 'string' ? data : JSON.stringify(data)
  return s.length > 400 ? s.slice(0, 400) + '…' : s
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * VERIFY-ON-SITE (P0-1/P0-2): the SPA lives in a document library somewhere
 * below the web root, so the web URL is discovered by walking up the path
 * until /_api/web answers. No dependency on _spPageContextInfo, which a
 * static .aspx page does not have.
 */
async function probeWebUrl(): Promise<{ webUrl: string; webTitle: string }> {
  const segs = window.location.pathname.split('/').filter(Boolean).slice(0, -1)
  for (let i = segs.length; i >= 0; i--) {
    const candidate = i === 0 ? '' : '/' + segs.slice(0, i).join('/')
    try {
      const res = await fetch(candidate + '/_api/web?$select=Title', {
        headers: { Accept: NOMETA },
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await readJson(res)
        return { webUrl: candidate, webTitle: data.Title ?? '(untitled)' }
      }
    } catch {
      // keep walking up
    }
  }
  throw new Error(`No /_api endpoint found walking up from ${window.location.pathname}`)
}

async function spGet(webUrl: string, path: string): Promise<any> {
  const res = await fetch(webUrl + path, {
    headers: { Accept: NOMETA },
    credentials: 'same-origin',
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}: ${short(data)}`)
  return data
}

/**
 * VERIFY-ON-SITE (P0-3/P0-4): SP2019 is expected to accept JSON writes
 * without __metadata when Content-Type is odata=nometadata. If that fails,
 * this helper retries in verbose mode (__metadata.type included) and reports
 * which mode worked — Phase 2's SharePointProvider will be built to match.
 */
async function spPost(
  webUrl: string,
  path: string,
  digest: string,
  body: Record<string, unknown>,
  opts: { verboseType?: string; headers?: Record<string, string> } = {},
): Promise<{ data: any; mode: string }> {
  const attempt = async (contentType: string, payload: unknown) => {
    const res = await fetch(webUrl + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: contentType === VERBOSE ? VERBOSE : NOMETA,
        'Content-Type': contentType,
        'X-RequestDigest': digest,
        ...opts.headers,
      },
      body: JSON.stringify(payload),
    })
    if (res.status === 204) return {}
    const data = await readJson(res)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${short(data)}`)
    return data
  }
  try {
    return { data: await attempt(NOMETA, body), mode: 'nometadata' }
  } catch (e1) {
    if (!opts.verboseType) throw e1
    try {
      const data = await attempt(VERBOSE, { __metadata: { type: opts.verboseType }, ...body })
      return { data, mode: 'verbose — __metadata REQUIRED, nometadata write failed' }
    } catch (e2) {
      throw new Error(`nometadata: ${(e1 as Error).message} | verbose: ${(e2 as Error).message}`)
    }
  }
}

async function spPostRaw(webUrl: string, path: string, digest: string, body: string): Promise<any> {
  const res = await fetch(webUrl + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: NOMETA, 'X-RequestDigest': digest },
    body,
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}: ${short(data)}`)
  return data
}

function App() {
  const [checks, setChecks] = useState<Check[]>(INITIAL)
  const [running, setRunning] = useState(false)
  const [site, setSite] = useState('')

  const report = (id: string, status: Status, ...lines: string[]) =>
    setChecks((cs) =>
      cs.map((c) => (c.id === id ? { ...c, status, detail: [...c.detail, ...lines] } : c)),
    )

  async function runAll() {
    setRunning(true)
    setChecks(INITIAL.map((c) => ({ ...c, detail: [...c.detail] })))

    let webUrl = ''
    try {
      const probe = await probeWebUrl()
      webUrl = probe.webUrl
      setSite(`Web: "${probe.webTitle}" at ${probe.webUrl || '/'} (from ${window.location.pathname})`)
    } catch (e) {
      setSite('')
      for (const id of ['P0-2', 'P0-3', 'P0-4', 'P0-5'])
        report(id, 'fail', `Could not locate the SharePoint web: ${(e as Error).message}`)
      setRunning(false)
      return
    }

    // P0-2 identity
    let identityOk = false
    report('P0-2', 'running')
    try {
      const user = await spGet(
        webUrl,
        '/_api/web/currentuser?$expand=Groups&$select=Id,Title,Email,LoginName,Groups/Title',
      )
      const groups = (user.Groups ?? []).map((g: { Title: string }) => g.Title)
      report(
        'P0-2',
        'pass',
        `User: ${user.Title} (${user.LoginName})`,
        `Email: ${user.Email || '(none)'}`,
        `Groups: ${groups.length ? groups.join(', ') : '(none — add yourself to the DMP groups later)'}`,
      )
      identityOk = true
    } catch (e) {
      report('P0-2', 'fail', (e as Error).message)
    }

    // P0-3 digest
    let digest = ''
    report('P0-3', 'running')
    try {
      const { data, mode } = await spPost(webUrl, '/_api/contextinfo', '', {})
      // nometadata: flat; verbose: nested under d.GetContextWebInformation
      const info = data.FormDigestValue ? data : data?.d?.GetContextWebInformation
      digest = info?.FormDigestValue ?? ''
      if (!digest) throw new Error(`No FormDigestValue in response: ${short(data)}`)
      report(
        'P0-3',
        'pass',
        `Digest: ${digest.slice(0, 24)}… (mode: ${mode})`,
        `Timeout: ${info.FormDigestTimeoutSeconds}s — provider will refresh before expiry`,
      )
    } catch (e) {
      report('P0-3', 'fail', (e as Error).message)
    }

    if (!digest) {
      report('P0-4', 'fail', 'Skipped — no digest')
      report('P0-5', 'fail', 'Skipped — no digest')
      setRunning(false)
      return
    }

    // P0-4 list + item writes
    let itemId = 0
    report('P0-4', 'running')
    try {
      const listPath = `/_api/web/lists/getbytitle('${SCRATCH_LIST}')`
      let entityType = ''
      try {
        const list = await spGet(webUrl, `${listPath}?$select=Title,ListItemEntityTypeFullName`)
        entityType = list.ListItemEntityTypeFullName
        report('P0-4', 'running', `List "${SCRATCH_LIST}" already exists (item type: ${entityType})`)
      } catch (e) {
        if (!(e as Error).message.includes('404')) throw e
        const created = await spPost(
          webUrl,
          '/_api/web/lists',
          digest,
          { Title: SCRATCH_LIST, BaseTemplate: 100 },
          { verboseType: 'SP.List' },
        )
        report('P0-4', 'running', `Created list "${SCRATCH_LIST}" via REST (mode: ${created.mode})`)
        const list = await spGet(webUrl, `${listPath}?$select=ListItemEntityTypeFullName`)
        entityType = list.ListItemEntityTypeFullName
      }

      const title = `Spike ${new Date().toISOString()}`
      const createRes = await spPost(
        webUrl,
        `${listPath}/items`,
        digest,
        { Title: title },
        { verboseType: entityType },
      )
      itemId = createRes.data.Id ?? createRes.data?.d?.Id
      if (!itemId) throw new Error(`Item created but no Id in response: ${short(createRes.data)}`)
      report('P0-4', 'running', `Created item ${itemId} (mode: ${createRes.mode})`)

      const readBack = await spGet(webUrl, `${listPath}/items(${itemId})?$select=Id,Title`)
      if (readBack.Title !== title) throw new Error(`Read-back mismatch: ${short(readBack)}`)
      report('P0-4', 'running', 'Read back OK')

      const merged = await spPost(
        webUrl,
        `${listPath}/items(${itemId})`,
        digest,
        { Title: `${title} (updated)` },
        { verboseType: entityType, headers: { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' } },
      )
      const confirm = await spGet(webUrl, `${listPath}/items(${itemId})?$select=Title`)
      if (!String(confirm.Title).endsWith('(updated)'))
        throw new Error(`MERGE did not stick: ${short(confirm)}`)
      report('P0-4', 'pass', `MERGE update OK (mode: ${merged.mode})`)
    } catch (e) {
      report('P0-4', 'fail', (e as Error).message)
    }

    // P0-5 attachment
    report('P0-5', 'running')
    try {
      if (!itemId) throw new Error('Skipped — no item to attach to (P0-4 failed)')
      const itemPath = `/_api/web/lists/getbytitle('${SCRATCH_LIST}')/items(${itemId})`
      await spPostRaw(
        webUrl,
        `${itemPath}/AttachmentFiles/add(FileName='spike.txt')`,
        digest,
        `DMP Phase 0 spike attachment, created ${new Date().toISOString()}`,
      )
      const atts = await spGet(webUrl, `${itemPath}/AttachmentFiles`)
      const names = (atts.value ?? []).map((a: { FileName: string }) => a.FileName)
      if (!names.includes('spike.txt')) throw new Error(`Uploaded but not listed: ${short(atts)}`)
      report('P0-5', 'pass', `Attached and listed: ${names.join(', ')}`)
    } catch (e) {
      report('P0-5', 'fail', (e as Error).message)
    }

    void identityOk
    setRunning(false)
  }

  const copyReport = () => {
    const lines = [
      `DMP Phase 0 spike results — ${new Date().toISOString()}`,
      `Page: ${window.location.href}`,
      site,
      '',
      ...checks.flatMap((c) => [
        `${c.id} ${c.name}: ${c.status.toUpperCase()}`,
        ...c.detail.map((d) => `    ${d}`),
      ]),
    ]
    void navigator.clipboard.writeText(lines.join('\n'))
  }

  const badge = (s: Status) => ({
    pass: { background: '#dcfce7', color: '#166534' },
    fail: { background: '#fee2e2', color: '#991b1b' },
    running: { background: '#fef9c3', color: '#854d0e' },
    pending: { background: '#e5e7eb', color: '#374151' },
  })[s]

  return (
    <div style={{ maxWidth: 860, margin: '2rem auto', padding: '0 1rem', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#111827' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>DMP Phase 0 — SP2019 Feasibility Spike</h1>
      <p style={{ color: '#4b5563', marginTop: 0 }}>
        Verifies every SharePoint 2019 assumption the Data Maintenance Portal will be built on. Click{' '}
        <b>Run all checks</b>, then copy or screenshot the results. Write checks create/use a scratch
        list named <code>{SCRATCH_LIST}</code>. (Running this outside SharePoint fails by design.)
      </p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={runAll} disabled={running} style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          {running ? 'Running…' : 'Run all checks'}
        </button>
        <button onClick={copyReport} style={{ padding: '8px 16px', background: '#fff', color: '#1d4ed8', border: '1px solid #1d4ed8', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          Copy results to clipboard
        </button>
      </div>
      {site && <p style={{ fontSize: 13, color: '#374151' }}>{site}</p>}
      {checks.map((c) => (
        <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 10, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...badge(c.status), padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
              {c.status}
            </span>
            <b>
              {c.id} · {c.name}
            </b>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', margin: '4px 0' }}>Verifies: {c.verifies}</div>
          {c.detail.length > 0 && (
            <pre style={{ fontSize: 12, background: '#f9fafb', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap', margin: 0 }}>
              {c.detail.join('\n')}
            </pre>
          )}
        </div>
      ))}
      <p style={{ fontSize: 12, color: '#6b7280' }}>
        See docs/PHASE0_UPLOAD.md for the upload recipe and what to report back.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
