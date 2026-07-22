import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { getProvider } from '@/data'
import { computeDashboard } from '@/domain/dashboard'
import { useAsync, usePageTitle } from '../hooks'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { StatCard } from '../components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

type SortKey = 'name' | 'open' | 'completed' | 'onTimePct' | 'avgCycleDays'

export function DashboardPage() {
  const user = useCurrentUser()
  const provider = getProvider()
  const requests = useAsync(() => provider.listRequests('all'), [])
  // numeric columns start descending (busiest/best first)
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'open', desc: true })
  usePageTitle(S.dashboard.title)

  if (!user.roles.includes('admin')) {
    return <p className="text-destructive">{S.dashboard.adminOnly}</p>
  }
  if (requests.loading)
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <h1 className="font-display text-display">{S.dashboard.title}</h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    )
  if (requests.error || !requests.data) return <p className="text-destructive">{requests.error ?? S.errors.generic}</p>

  const { kpis, maintainers } = computeDashboard(requests.data)
  const k = S.dashboard.kpis

  const rows = [...maintainers].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    const cmp =
      typeof av === 'string' || typeof bv === 'string'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : (av ?? -Infinity) - (bv ?? -Infinity) // "—" (null) sorts below real numbers
    return sort.desc ? -cmp : cmp
  })

  const SortableHead = ({ k: key, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <TableHead className={`px-2 ${right ? 'text-right' : ''}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${right ? 'justify-end' : ''}`}
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
      >
        {label}
        {sort.key === key ? (
          sort.desc ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUp className="h-3 w-3 text-primary" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <h1 className="font-display text-display">{S.dashboard.title}</h1>

      <div className="reveal grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" style={{ '--stagger-i': 1 } as React.CSSProperties}>
        <StatCard label={k.total} value={kpis.total} to="/requests?scope=all" />
        <StatCard label={k.waiting} value={kpis.waiting} to="/requests?scope=all&status=Waiting to be started" />
        <StatCard label={k.inProcess} value={kpis.inProcess} to="/requests?scope=all&status=In process" />
        <StatCard label={k.completed} value={kpis.completed} to="/requests?scope=all&status=Completed" />
        <StatCard label={k.overdue} value={kpis.overdue} to="/requests?scope=all&overdue=1" tone="red" />
        <StatCard label={k.unassigned} value={kpis.unassigned} to="/requests?scope=unassigned" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{S.dashboard.maintainersTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead k="name" label={S.dashboard.columns.maintainer} />
                <SortableHead k="open" label={S.dashboard.columns.open} right />
                <SortableHead k="completed" label={S.dashboard.columns.completed} right />
                <SortableHead k="onTimePct" label={S.dashboard.columns.onTime} right />
                <SortableHead k="avgCycleDays" label={S.dashboard.columns.avgCycle} right />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-2 text-muted-foreground">
                    {S.dashboard.noMaintainers}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="p-2 font-medium">{m.name}</TableCell>
                  <TableCell className="p-2 text-right">{m.open}</TableCell>
                  <TableCell className="p-2 text-right">{m.completed}</TableCell>
                  <TableCell className="p-2 text-right">
                    {m.onTimePct != null ? `${m.onTimePct}%` : S.dashboard.notMeasured}
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    {m.avgCycleDays != null ? m.avgCycleDays : S.dashboard.notMeasured}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">{S.dashboard.note}</p>
        </CardContent>
      </Card>
    </div>
  )
}
