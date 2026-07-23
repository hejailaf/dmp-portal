import { getProvider } from '@/data'
import { daysUntilDue, isOverdue } from '@/domain/sla'
import type { Request } from '@/domain/types'
import lockupLight from '@/assets/logo-horizontal-text.svg'
import lockupDark from '@/assets/logo-horizontal-text-dark.svg'
import { AlertCircle, CornerUpLeft, Plus, Undo2, UserPlus } from 'lucide-react'
import addItemSvg from '@/assets/icons/add_item.svg?raw'
import listSvg from '@/assets/icons/list.svg?raw'
import sheetSvg from '@/assets/icons/sheet.svg?raw'
import { relativeDateTime } from '../format'
import { useAsync } from '../hooks'
import { href } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { DueSuffix, StatusBadge } from '../components/badges'
import { downloadBlob } from '@/lib/utils'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { StatCard } from '../components/StatCard'

/** Official Aramco-library icon (docs/BRAND_REVIEW.md) — stroke follows the text color. */
function AramcoIcon({ svg, className }: { svg: string; className?: string }) {
  return (
    <span
      className={`block [&>svg]:h-full [&>svg]:w-full ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

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
    <Card
      className={`transition hover:-translate-y-px hover:border-ring hover:shadow-raised ${primary ? 'border-2 border-primary' : ''}`}
    >
      <CardContent className="p-4">
        {/* Aramco-library icon in a teal chip — the stroke follows text color */}
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-md ${primary ? 'bg-[var(--teal-tint)] text-primary' : 'bg-secondary text-muted-foreground'}`}
        >
          {icon}
        </div>
        <div className="mt-2.5 text-sm font-semibold">{title}</div>
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
  // left accent bar echoes the list's overdue row edge
  const toneCls =
    tone === 'red'
      ? 'border-destructive/40 border-l-destructive bg-[var(--danger-tint)] text-destructive'
      : 'border-[var(--warning-border)] border-l-[var(--warning)] bg-[var(--warning-tint)] text-foreground'
  return (
    <a
      href={href(to)}
      className={`flex items-center gap-2.5 rounded-md border border-l-[3px] p-2.5 text-sm hover:underline ${toneCls}`}
    >
      {icon}
      <span className="min-w-0">{text}</span>
    </a>
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
      <div className="space-y-5">
        <Skeleton className="h-24 w-full rounded-card" />
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
  const returnedMine = mine.filter((r) => r.status === 'Returned').slice(0, 3)
  // like Rejected/Returned, Withdrawn only moves when the requester acts
  const withdrawnMine = mine.filter((r) => r.status === 'Withdrawn')
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

  // dispatch alert shared by the maintainer + admin homes (maintainers CLAIM
  // from the pool instead of assigning; admins assign). One banner, worst
  // facts combined — the Overdue tile already carries the count.
  const dispatchCallout = oldestUnassigned && unassignedDays >= 1 && (
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
  )

  return (
    <div className="space-y-5">
      {/* letterhead hero: drafting-grid texture, welcome in display type,
          text lockup right (variants swap on the `.dark` html class) */}
      <div className="drafting-grid reveal relative overflow-hidden rounded-card border bg-card px-6 py-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-display">{S.home.welcome(user.displayName)}</h1>
            {/* requesters don't need telling they're requesters; the role-less
                red badge stays — it's the app's only "access broken" signal */}
            {topRole !== 'requester' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                {S.home.roleLabel}:
                {topRole ? (
                  <Badge variant="blue">{S.roles[topRole]}</Badge>
                ) : (
                  <Badge variant="red">{S.roles.none}</Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            <img src={lockupLight} alt={S.appName} className="h-16 w-auto dark:hidden" />
            <img src={lockupDark} alt={S.appName} className="hidden h-16 w-auto dark:block" />
            {topRole === 'admin' && (
              <a
                href={href('/new')}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-[0.5px]"
              >
                <Plus className="h-4 w-4" /> {S.home.newRequestCta}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* requester: launchpad + attention + recent + how-it-works */}
      {topRole === 'requester' && (
        <div className="space-y-3">
          <div className="reveal grid gap-3 md:grid-cols-3" style={{ '--stagger-i': 1 } as React.CSSProperties}>
            <ActionCard
              to="/new"
              primary
              icon={<AramcoIcon svg={addItemSvg} className="h-5 w-5" />}
              title={S.home.newRequestCta}
              body={S.home.newRequestCardBody}
            />
            {/* segmented tile — NOT one big anchor: the title opens the full
                list, the draft/completed counts deep-link to filtered views
                ("open" spans two statuses, so it stays plain text) */}
            <Card>
              <CardContent className="p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <AramcoIcon svg={listSvg} className="h-5 w-5" />
                </div>
                <div className="mt-2.5 text-sm font-semibold">
                  <a href={href('/requests?scope=mine')} className="hover:text-primary hover:underline">
                    {S.home.cards.myRequests}
                  </a>{' '}
                  <span className="font-normal text-muted-foreground">({mine.length})</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <a
                    href={href('/requests?scope=mine&status=Draft')}
                    className="text-primary hover:underline"
                  >
                    {S.home.statDrafts(mine.filter((r) => r.status === 'Draft').length)}
                  </a>
                  {' · '}
                  {S.home.statOpen(open(mine).length)}
                  {' · '}
                  <a
                    href={href('/requests?scope=mine&status=Completed')}
                    className="text-primary hover:underline"
                  >
                    {S.home.statCompleted(mine.filter((r) => r.status === 'Completed').length)}
                  </a>
                  {withdrawnMine.length > 0 && (
                    <>
                      {' · '}
                      <a
                        href={href('/requests?scope=mine&status=Withdrawn')}
                        className="text-primary hover:underline"
                      >
                        {S.home.statWithdrawn(withdrawnMine.length)}
                      </a>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            <ActionCard
              onClick={() =>
                void (async () => {
                  // direct download — exceljs loads lazily on first use
                  const { makeUnifiedTemplate, TEMPLATE_FILENAME } = await import('@/lib/excel-lines')
                  downloadBlob(await makeUnifiedTemplate(), TEMPLATE_FILENAME)
                })()
              }
              icon={<AramcoIcon svg={sheetSvg} className="h-5 w-5" />}
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
          {returnedMine.map((r) => (
            <Callout
              key={r.id}
              tone="amber"
              icon={<CornerUpLeft className="h-4 w-4 flex-none text-[var(--warning)]" />}
              text={S.home.returnedCallout(r.ref)}
              to={`/requests/${r.id}`}
            />
          ))}
          {withdrawnMine.slice(0, 3).map((r) => (
            <Callout
              key={r.id}
              tone="amber"
              icon={<Undo2 className="h-4 w-4 flex-none text-[var(--warning)]" />}
              text={S.home.withdrawnCallout(r.ref)}
              to={`/requests/${r.id}`}
            />
          ))}
          <Card className="reveal" style={{ '--stagger-i': 2 } as React.CSSProperties}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-section">{S.home.recentTitle}</h3>
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
                      <StatusBadge status={r.status} assigneeId={r.assigneeId} />
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="reveal" style={{ '--stagger-i': 3 } as React.CSSProperties}>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              {S.home.howSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                    {i + 1}
                  </span>
                  <p className="min-w-0 text-xs text-muted-foreground">{step}</p>
                  {/* hairline connector to the next step — echoes the stepper */}
                  {i < S.home.howSteps.length - 1 && (
                    <span aria-hidden className="mt-2.5 hidden h-px flex-1 bg-border md:block" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* maintainer: queue bar + due-this-week + tiles */}
      {topRole === 'maintainer' && (
        <div className="space-y-3">
          {dispatchCallout}
          {queueOpen.length > 0 && (
            <Card className="reveal" style={{ '--stagger-i': 1 } as React.CSSProperties}>
              <CardContent className="p-4">
                <h3 className="mb-2.5 text-section text-muted-foreground">{S.home.queueByStatus}</h3>
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
                    {/* queue items are assigned by definition */}
                    {S.statusLabel('Waiting to be started', true)} {queueWaiting}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-primary" />
                    {S.status['In process']} {queueInProcess}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="reveal grid gap-3 lg:grid-cols-2" style={{ '--stagger-i': 2 } as React.CSSProperties}>
            <Card className="min-w-0">
              <CardContent className="p-4">
                <h3 className="mb-1.5 text-section text-muted-foreground">{S.home.dueThisWeek}</h3>
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
              <StatCard label={S.home.cards.myOverdue} value={overdue(queue).length} to="/requests?scope=queue&overdue=1" tone="red" />
              <StatCard
                label={S.home.cards.myCompleted}
                value={queue.filter((r) => r.status === 'Completed').length}
                to="/requests?scope=queue&status=Completed"
              />
            </div>
          </div>
        </div>
      )}

      {/* admin: command center — dispatch callout, tiles, team load, activity */}
      {topRole === 'admin' && (
        <div className="space-y-3">
          {dispatchCallout}
          <div className="reveal grid grid-cols-2 gap-3 md:grid-cols-4" style={{ '--stagger-i': 1 } as React.CSSProperties}>
            <StatCard label={S.home.cards.all} value={all.length} to="/requests?scope=all" />
            <StatCard label={S.home.cards.overdue} value={allOverdue.length} to="/requests?scope=all&overdue=1" tone="red" />
            <StatCard label={S.home.cards.unassignedPool} value={unassigned.length} to="/requests?scope=unassigned" />
            <StatCard
              label={S.home.cards.completed}
              value={all.filter((r) => r.status === 'Completed').length}
              to="/requests?scope=all&status=Completed"
            />
          </div>
          <div className="reveal grid gap-3 lg:grid-cols-2" style={{ '--stagger-i': 2 } as React.CSSProperties}>
            <Card className="min-w-0">
              <CardContent className="p-4">
                <h3 className="mb-2 text-section text-muted-foreground">{S.home.teamLoad}</h3>
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
                <h3 className="mb-2 text-section text-muted-foreground">{S.home.latestActivity}</h3>
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
