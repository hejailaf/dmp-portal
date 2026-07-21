import { useState } from 'react'
import { getProvider, PROVIDER_NAME } from '@/data'
import type { ProvisionResult } from '@/data/provider'
import { checkDmpGroups, runConnectionSelfTest, setAppAsSiteHome, setListsHidden } from '@/data/sp'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const STATUS_VARIANT = { ok: 'green', created: 'blue', missing: 'amber', error: 'red' } as const

export function ProvisionPage() {
  const user = useCurrentUser()
  const provider = getProvider()
  const isSharePoint = PROVIDER_NAME === 'sharepoint'
  const [results, setResults] = useState<ProvisionResult[]>()
  const [groups, setGroups] = useState<{ name: string; exists: boolean }[]>()
  const [selfTest, setSelfTest] = useState<string[]>()
  const [homeResult, setHomeResult] = useState<string>()
  const [hideResult, setHideResult] = useState<string[]>()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  if (!user.roles.includes('admin')) {
    return <p className="text-destructive">{S.provision.adminOnly}</p>
  }

  const run = (label: string, fn: () => Promise<void>) => async () => {
    setBusy(label)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{S.provision.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{S.provision.intro}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!!busy}
          onClick={run('provision', async () => {
            setResults(await provider.provisionLists())
            if (isSharePoint) setGroups(await checkDmpGroups())
          })}
        >
          {busy === 'provision' ? S.provision.running : S.provision.provisionNow}
        </Button>
        {isSharePoint && (
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={run('selftest', async () => setSelfTest(await runConnectionSelfTest()))}
          >
            {busy === 'selftest' ? S.provision.running : S.provision.selfTest}
          </Button>
        )}
        {isSharePoint && (
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={run('sethome', async () => setHomeResult(S.provision.setHomeDone(await setAppAsSiteHome())))}
          >
            {busy === 'sethome' ? S.provision.running : S.provision.setHome}
          </Button>
        )}
        {isSharePoint && (
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={run('hidelists', async () =>
              setHideResult([...(await setListsHidden(true)), S.provision.hideListsNote]),
            )}
          >
            {busy === 'hidelists' ? S.provision.running : S.provision.hideLists}
          </Button>
        )}
        {isSharePoint && (
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={run('showlists', async () => setHideResult(await setListsHidden(false)))}
          >
            {busy === 'showlists' ? S.provision.running : S.provision.showLists}
          </Button>
        )}
      </div>

      {hideResult && (
        <pre className="whitespace-pre-wrap rounded-md border bg-accent/50 p-3 text-sm">{hideResult.join('\n')}</pre>
      )}

      {homeResult && <p className="rounded-md border bg-accent/50 p-3 text-sm">{homeResult}</p>}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-[var(--danger-tint)] p-3 text-sm text-destructive">{error}</p>
      )}
      {!isSharePoint && <p className="text-sm text-muted-foreground">{S.provision.mockNote}</p>}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>{S.provision.listsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r) => (
              <div key={r.list} className="flex items-start gap-3 text-sm">
                <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                <span className="font-medium">{r.list}</span>
                <span className="text-muted-foreground">{r.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {groups && (
        <Card>
          <CardHeader>
            <CardTitle>{S.provision.groupsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((g) => (
              <div key={g.name} className="flex items-center gap-3 text-sm">
                <Badge variant={g.exists ? 'green' : 'amber'}>
                  {g.exists ? S.provision.groupExists : S.provision.groupMissing}
                </Badge>
                <span className="font-medium">{g.name}</span>
              </div>
            ))}
            {groups.some((g) => !g.exists) && (
              <p className="pt-1 text-sm text-muted-foreground">{S.provision.groupsHint}</p>
            )}
          </CardContent>
        </Card>
      )}

      {selfTest && (
        <Card>
          <CardHeader>
            <CardTitle>{S.provision.selfTestTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-xs">{selfTest.join('\n')}</pre>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">{S.provision.recipeHint}</p>
    </div>
  )
}
