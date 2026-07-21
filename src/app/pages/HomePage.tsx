import { getProvider } from '@/data'
import { daysUntilDue, isOverdue } from '@/domain/sla'
import type { Request } from '@/domain/types'
import lockupLight from '@/assets/logo-horizontal-text.svg'
import lockupDark from '@/assets/logo-horizontal-text-dark.svg'
import { AlertCircle, ClipboardList, FileSpreadsheet, Plus, UserPlus } from 'lucide-react'
import { relativeDateTime } from '../format'
import { useAsync } from '../hooks'
import { href } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { StatusBadge } from '../components/badges'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { StatCard } from '../components/StatCard'

/** Launchpad-style action card (requester home) — link, or in-place action via onClick. */
function ActionCard({
  to,
  onClick,
  icon,
  title,
  body,
  primary,
}: {
  to?: string
  onClick?: () => void
  icon: React.ReactNode
  title: React.ReactNode
  body: string
  primary?: boolean
}) {
  const card = (
    <Card className={primary ? 'border-2 border-primary transition-colors hover:border-ring' : 'transition-colors hover:border-ring'}>
      <CardContent className="p-4">
        <div className={primary ? 'text-primary' : 'text-muted-foreground'}>{icon}</div>
        <div className="mt-2 text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  )
  return to ? (
    <a href={href(to)} className="block">
      {card}
    </a>
  ) : (
    <button type="button" className="block w-full text-left" onClick={onClick}>
      {card}
    </button>
  )
}

/** Amber/red callout row — the WHOLE bar is the link (user decision 2026-07-21). */
function Callout({
  tone,
  icon,
  text,
  to,
}: {
  tone: 'red' | 'amber'
  icon: React.ReactNode
  text: string
  to: string
}) {
  const toneCls =
    tone === 'red'
      ? 'border-destructive/40 bg-[var(--danger-tint)] text-destructive'
      : 'border-[rgba(225,154,47,.4)] bg-[var(--warning-tint)] text-foreground'
  return (
    <a
      href={href(to)}
      className={`flex items-center gap-2.5 rounded-md border p-2.5 text-sm hover:underline ${toneCls}`}
    >
      {icon}
      <span className="min-w-0">{text}</span>
    </a>
  )
}

/** Due-date suffix colored by urgency (shared by the due-this-week rows). */
function DueSuffix({ request }: { request: Request }) {
  if (!request.dueDate) return null
  const days = daysUntilDue(request.dueDate)
  if (isOverdue(request)) return <span className="flex-none text-destructive">{S.sla.overdue(-days)}</span>
  return (
    <span className={`flex-none ${days <= 1 ? 'text-[var(--warning)]' : 'text-muted-foreground'}`}>
      {days <= 0 ? S.sla.dueToday : S.sla.dueIn(days)}
    </span>
  )
}

export function HomePage() {
  const user = useCurrentUser()
  const provider = getProvider()
  // the home page shows ONE layout, picked by the user's highest role
  // (Admin > Maintainer > Requester — user decision 2026-07-21). Display
  // only: nav links and permissions stay multi-role.
  const topRole = user.roles.includes('admin')
    ? ('admin' as const)
    : user.roles.includes('maintainer')
      ? ('maintainer' as const)
      : user.roles.includes('requester')
        ? ('requester' as const)
        : undefined

  const overview = useAsync(async () => {
    const empty: Request[] = []
    const [mine, queue, unassigned, all] = await Promise.all([
      topRole === 'requester' ? provider.listRequests('mine') : empty,
      topRole === 'maintainer' ? provider.listRequests('queue') : empty,
      topRole === 'maintainer' || topRole === 'admin' ? provider.listRequests('unassigned') : empty,
      topRole === 'admin' ? provider.listRequests('all') : empty,
    ])
    return { mine, queue, unassigned, all }
  }, [user.id])

  if (overview.loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-[10px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  if (overview.error || !overview.data)
    return <p className="text-destructive">{S.home.errorLoading}</p>

  const { mine, queue, unassigned, all } = overview.data
  const open = (rs: Request[]) =>
    rs.filter((r) => r.status === 'Waiting to be started' || r.status === 'In process')
  const overdue = (rs: Request[]) => rs.filter((r) => isOverdue(r))
  const latestOf = (r: Request) => r.completedAt ?? r.submittedAt ?? r.createdAt

  // requester bits
  const rejectedMine = mine.filter((r) => r.status === 'Rejected').slice(0, 3)
  const recentMine = [...mine].sort((a, b) => latestOf(b).localeCompare(latestOf(a))).slice(0, 5)

  // maintainer bits
  const queueOpen = open(queue)
  const queueWaiting = queue.filter((r) => r.status === 'Waiting to be started').length
  const queueInProcess = queue.filter((r) => r.status === 'In process').length
  const dueSoon = queueOpen
    .filter((r) => r.dueDate && daysUntilDue(r.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, 5)

  // admin bits
  const oldestUnassigned = [...unassigned]
    .filter((r) => r.submittedAt)
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))[0]
  const unassignedDays = oldestUnassigned?.submittedAt
    ? Math.floor((Date.now() - new Date(oldestUnassigned.submittedAt).getTime()) / 86400000)
    : 0
  const allOverdue = overdue(all)
  const teamLoad = Object.entries(
    open(all)
      .filter((r) => r.assigneeName)
      .reduce<Record<string, number>>((acc, r) => {
        acc[r.assigneeName!] = (acc[r.assigneeName!] ?? 0) + 1
        return acc
      }, {}),
  ).sort((a, b) => b[1] - a[1])
  const maxLoad = Math.max(1, ...teamLoad.map(([, n]) => n))
  // activity is DERIVED from request fields (submitted/completed timestamps) —
  // the audit log is per-request, so a true cross-request feed would need N fetches
  const activity = all
    .flatMap((r) => [
      ...(r.submittedAt
        ? [{ who: r.requesterName, verb: S.home.activitySubmitted, ref: r.ref, id: r.id, at: r.submittedAt }]
        : []),
      ...(r.completedAt
        ? [
            {
              who: r.assigneeName ?? r.requesterName,
              verb: S.home.activityCompleted,
              ref: r.ref,
              id: r.id,
              at: r.completedAt,
            },
          ]
        : []),
    ])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      {/* text-only brand lockup (the header shows the icon on this page);
          variants swap on the `.dark` html class */}
      <div className="flex justify-center pb-2 pt-4">
        <img src={lockupLight} alt={S.appName} className="h-24 w-auto dark:hidden" />
        <img src={lockupDark} alt={S.appName} className="hidden h-24 w-auto dark:block" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{S.home.welcome(user.displayName)}</h1>
          {/* requesters don't need telling they're requesters; the role-less
              red badge stays — it's the app's only "access broken" signal */}
          {topRole !== 'requester' && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {S.home.roleLabel}:
              {topRole ? (
                <Badge variant="blue">{S.roles[topRole]}</Badge>
              ) : (
                <Badge variant="red">{S.roles.none}</Badge>
              )}
            </div>
          )}
        </div>
        {topRole === 'admin' && (
          <a
            href={href('/new')}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {S.home.newRequestCta}
          </a>
        )}
      </div>

      {/* requester: launchpad + attention + recent + how-it-works */}
      {topRole === 'requester' && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <ActionCard
              to="/new"
              primary
              icon={<Plus className="h-5 w-5" />}
              title={S.home.newRequestCta}
              body={S.home.newRequestCardBody}
            />
            <ActionCard
              to="/requests?scope=mine"
              icon={<ClipboardList className="h-5 w-5" />}
              title={
                <>
                  {S.home.cards.myRequests}{' '}
                  <span className="font-normal text-muted-foreground">({mine.length})</span>
                </>
              }
              body={S.home.myRequestsCardBody(
                mine.filter((r) => r.status === 'Draft').length,
                open(mine).length,
                mine.filter((r) => r.status === 'Completed').length,
              )}
            />
            <ActionCard
              onClick={() =>
                void (async () => {
                  // direct download — exceljs loads lazily on first use
                  const { makeUnifiedTemplate, TEMPLATE_FILENAME } = await import('@/lib/excel-lines')
                  const blob = await makeUnifiedTemplate()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = TEMPLATE_FILENAME
                  a.click()
                  URL.revokeObjectURL(url)
                })()
              }
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title={S.home.templatesCardTitle}
              body={S.home.templatesCardBody}
            />
          </div>
          {rejectedMine.map((r) => (
            <Callout
              key={r.id}
              tone="red"
              icon={<AlertCircle className="h-4 w-4 flex-none text-destructive" />}
              text={S.home.rejectedCallout(r.ref)}
              to={`/requests/${r.id}`}
            />
          ))}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-sm font-semibold">{S.home.recentTitle}</h3>
                <a href={href('/requests?scope=mine')} className="text-sm text-primary hover:underline">
                  {S.home.viewAll}
                </a>
              </div>
              {recentMine.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{S.list.emptyMineBody}</p>
              ) : (
                recentMine.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-2 text-sm ${i > 0 ? 'border-t' : ''}`}
                  >
                    <a href={href(`/requests/${r.id}`)} className="flex-none font-medium text-primary hover:underline">
                      {r.ref}
                    </a>
                    <span className="min-w-0 truncate text-muted-foreground">{r.description}</span>
                    <span className="ml-auto flex-none">
                      <StatusBadge status={r.status} />
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              {S.home.howSteps.map((step, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* maintainer: queue bar + due-this-week + tiles */}
      {topRole === 'maintainer' && (
        <div className="space-y-3">
          {/* same dispatch alert as the admin home — maintainers CLAIM from
              the pool instead of assigning */}
          {oldestUnassigned && unassignedDays >= 1 && (
            <Callout
              tone={isOverdue(oldestUnassigned) ? 'red' : 'amber'}
              icon={
                isOverdue(oldestUnassigned) ? (
                  <AlertCircle className="h-4 w-4 flex-none text-destructive" />
                ) : (
                  <UserPlus className="h-4 w-4 flex-none text-[var(--warning)]" />
                )
              }
              text={S.home.unassignedAging(
                oldestUnassigned.ref,
                unassignedDays,
                isOverdue(oldestUnassigned) && oldestUnassigned.dueDate
                  ? -daysUntilDue(oldestUnassigned.dueDate)
                  : undefined,
              )}
              to={`/requests/${oldestUnassigned.id}`}
            />
          )}
          {queueOpen.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2.5 text-sm font-semibold text-muted-foreground">{S.home.queueByStatus}</h3>
                <div className="flex h-3.5 overflow-hidden rounded-full">
                  <div
                    className="bg-[var(--warning)]"
                    style={{ width: `${(queueWaiting / queueOpen.length) * 100}%` }}
                  />
                  <div className="bg-primary" style={{ width: `${(queueInProcess / queueOpen.length) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-[var(--warning)]" />
                    {S.status['Waiting to be started']} {queueWaiting}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-primary" />
                    {S.status['In process']} {queueInProcess}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardContent className="p-4">
                <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">{S.home.dueThisWeek}</h3>
                {dueSoon.length === 0 ? (
                  <p className="py-1.5 text-sm text-muted-foreground">{S.home.nothingDue}</p>
                ) : (
                  dueSoon.map((r, i) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-2 py-1.5 text-sm ${i > 0 ? 'border-t' : ''}`}
                    >
                      <a href={href(`/requests/${r.id}`)} className="flex-none font-medium text-primary hover:underline">
                        {r.ref}
                      </a>
                      <span className="min-w-0 truncate text-muted-foreground">{r.description}</span>
                      <span className="ml-auto" />
                      <DueSuffix request={r} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <StatCard label={S.home.cards.myQueue} value={queueOpen.length} to="/requests?scope=queue" />
              <StatCard label={S.home.cards.unassignedPool} value={unassigned.length} to="/requests?scope=unassigned" />
              <StatCard label={S.home.cards.overdue} value={overdue(queue).length} to="/requests?scope=queue&overdue=1" tone="red" />
              <StatCard
                label={S.home.cards.completed}
                value={queue.filter((r) => r.status === 'Completed').length}
                to="/requests?scope=queue&status=Completed"
              />
            </div>
          </div>
        </div>
      )}

      {/* admin: command center — tiles, dispatch callouts, team load, activity */}
      {topRole === 'admin' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={S.home.cards.all} value={all.length} to="/requests?scope=all" />
            <StatCard label={S.home.cards.overdue} value={allOverdue.length} to="/requests?scope=all&overdue=1" tone="red" />
            <StatCard label={S.home.cards.unassignedPool} value={unassigned.length} to="/requests?scope=unassigned" />
            <StatCard
              label={S.home.cards.completed}
              value={all.filter((r) => r.status === 'Completed').length}
              to="/requests?scope=all&status=Completed"
            />
          </div>
          {/* one banner per request, worst facts combined — the Overdue tile
              already carries the count, so no count-only callout */}
          {oldestUnassigned && unassignedDays >= 1 && (
            <Callout
              tone={isOverdue(oldestUnassigned) ? 'red' : 'amber'}
              icon={
                isOverdue(oldestUnassigned) ? (
                  <AlertCircle className="h-4 w-4 flex-none text-destructive" />
                ) : (
                  <UserPlus className="h-4 w-4 flex-none text-[var(--warning)]" />
                )
              }
              text={S.home.unassignedAging(
                oldestUnassigned.ref,
                unassignedDays,
                isOverdue(oldestUnassigned) && oldestUnassigned.dueDate
                  ? -daysUntilDue(oldestUnassigned.dueDate)
                  : undefined,
              )}
              to={`/requests/${oldestUnassigned.id}`}
            />
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{S.home.teamLoad}</h3>
                {teamLoad.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2.5 py-1 text-sm">
                    <span className="w-32 flex-none truncate">{name}</span>
                    <div className="h-2.5 min-w-0 flex-1 rounded-full bg-muted">
                      <div
                        className="h-2.5 rounded-full bg-primary"
                        style={{ width: `${(count / maxLoad) * 100}%` }}
                      />
                    </div>
                    <span className="w-5 flex-none text-right tabular-nums">{count}</span>
                  </div>
                ))}
                {teamLoad.length === 0 && (
                  <p className="py-1 text-sm text-muted-foreground">{S.dashboard.noMaintainers}</p>
                )}
                <a href={href('/admin/dashboard')} className="mt-2 inline-block text-sm text-primary hover:underline">
                  {S.home.cards.dashboardLink}
                </a>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{S.home.latestActivity}</h3>
                {activity.map((a, i) => (
                  <p key={i} className="py-1 text-sm">
                    <span className="font-medium">{a.who}</span> {a.verb}{' '}
                    <a href={href(`/requests/${a.id}`)} className="font-medium text-primary hover:underline">
                      {a.ref}
                    </a>{' '}
                    <span className="text-xs text-muted-foreground">· {relativeDateTime(a.at)}</span>
                  </p>
                ))}
                {activity.length === 0 && (
                  <p className="py-1 text-sm text-muted-foreground">{S.list.empty}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
