import { getProvider } from '@/data'
import { isOverdue } from '@/domain/sla'
import type { Request } from '@/domain/types'
import lockupLight from '@/assets/logo-horizontal.svg'
import lockupDark from '@/assets/logo-horizontal-dark.svg'
import { Plus } from 'lucide-react'
import { useAsync } from '../hooks'
import { href } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'

function StatCard({ label, value, to, tone }: { label: string; value: number; to: string; tone?: 'red' }) {
  return (
    <a href={href(to)} className="block">
      <Card className="transition-colors hover:border-ring">
        <CardContent className="p-4">
          <div className={`text-3xl font-semibold ${tone === 'red' && value > 0 ? 'text-destructive' : ''}`}>
            {value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </a>
  )
}

export function HomePage() {
  const user = useCurrentUser()
  const provider = getProvider()
  const isRequester = user.roles.includes('requester')
  const isMaintainer = user.roles.includes('maintainer')
  const isAdmin = user.roles.includes('admin')
  // staff (maintainers/admins) don't need their own requester tiles on the
  // home page — they can still file via the nav + "Create a new request"
  const isStaff = isMaintainer || isAdmin
  const showRequesterTiles = isRequester && !isStaff

  const overview = useAsync(async () => {
    const empty: Request[] = []
    const [mine, queue, unassigned, all] = await Promise.all([
      showRequesterTiles ? provider.listRequests('mine') : empty,
      isMaintainer ? provider.listRequests('queue') : empty,
      isMaintainer || isAdmin ? provider.listRequests('unassigned') : empty,
      isAdmin ? provider.listRequests('all') : empty,
    ])
    return { mine, queue, unassigned, all }
  }, [user.id])

  if (overview.loading) return <p className="text-muted-foreground">{S.list.loading}</p>
  if (overview.error || !overview.data)
    return <p className="text-destructive">{S.home.errorLoading}</p>

  const { mine, queue, unassigned, all } = overview.data
  const open = (rs: Request[]) =>
    rs.filter((r) => r.status === 'Waiting to be started' || r.status === 'In process')
  const overdue = (rs: Request[]) => rs.filter((r) => isOverdue(r))

  return (
    <div className="space-y-6">
      {/* brand lockup with tagline; variants swap on the `.dark` html class */}
      <div className="flex justify-center pb-2 pt-4">
        <img src={lockupLight} alt={S.appName} className="h-20 w-auto dark:hidden" />
        <img src={lockupDark} alt={S.appName} className="hidden h-20 w-auto dark:block" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{S.home.welcome(user.displayName)}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {S.home.roleLabel}:
            {user.roles.length === 0 && <Badge variant="red">{S.roles.none}</Badge>}
            {user.roles.map((r) => (
              <Badge key={r} variant="blue">
                {S.roles[r]}
              </Badge>
            ))}
          </div>
        </div>
        {(isRequester || isAdmin) && (
          <a
            href={href('/new')}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {S.home.newRequestCta}
          </a>
        )}
      </div>

      {showRequesterTiles && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {S.home.sectionRequester}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={S.home.cards.myRequests} value={mine.length} to="/requests?scope=mine" />
          <StatCard
            label={S.home.cards.myDrafts}
            value={mine.filter((r) => r.status === 'Draft').length}
            to="/requests?scope=mine&status=Draft"
          />
          <StatCard label={S.home.cards.myOpen} value={open(mine).length} to="/requests?scope=mine" />
          <StatCard label={S.home.cards.overdue} value={overdue(mine).length} to="/requests?scope=mine&overdue=1" tone="red" />
          </div>
        </div>
      )}

      {isMaintainer && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {S.home.sectionMaintainer}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={S.home.cards.myQueue} value={open(queue).length} to="/requests?scope=queue" />
            <StatCard label={S.home.cards.overdue} value={overdue(queue).length} to="/requests?scope=queue&overdue=1" tone="red" />
            <StatCard label={S.home.cards.unassignedPool} value={unassigned.length} to="/requests?scope=unassigned" />
            <StatCard
              label={S.home.cards.completed}
              value={queue.filter((r) => r.status === 'Completed').length}
              to="/requests?scope=queue&status=Completed"
            />
          </div>
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {S.home.sectionAdmin}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={S.home.cards.all} value={all.length} to="/requests?scope=all" />
            <StatCard label={S.home.cards.overdue} value={overdue(all).length} to="/requests?scope=all&overdue=1" tone="red" />
            <StatCard label={S.home.cards.unassignedPool} value={unassigned.length} to="/requests?scope=unassigned" />
            <StatCard
              label={S.home.cards.completed}
              value={all.filter((r) => r.status === 'Completed').length}
              to="/requests?scope=all&status=Completed"
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{S.home.cards.dashboardSoon}</p>
        </div>
      )}
    </div>
  )
}
