import { getProvider } from '@/data'
import { computeDashboard } from '@/domain/dashboard'
import { useAsync } from '../hooks'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { StatCard } from '../components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

export function DashboardPage() {
  const user = useCurrentUser()
  const provider = getProvider()
  const requests = useAsync(() => provider.listRequests('all'), [])

  if (!user.roles.includes('admin')) {
    return <p className="text-destructive">{S.dashboard.adminOnly}</p>
  }
  if (requests.loading) return <p className="text-muted-foreground">{S.list.loading}</p>
  if (requests.error || !requests.data) return <p className="text-destructive">{requests.error ?? S.errors.generic}</p>

  const { kpis, maintainers } = computeDashboard(requests.data)
  const k = S.dashboard.kpis

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-2xl font-semibold">{S.dashboard.title}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
                <TableHead className="px-2">{S.dashboard.columns.maintainer}</TableHead>
                <TableHead className="px-2 text-right">{S.dashboard.columns.open}</TableHead>
                <TableHead className="px-2 text-right">{S.dashboard.columns.completed}</TableHead>
                <TableHead className="px-2 text-right">{S.dashboard.columns.onTime}</TableHead>
                <TableHead className="px-2 text-right">{S.dashboard.columns.avgCycle}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintainers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-2 text-muted-foreground">
                    {S.dashboard.noMaintainers}
                  </TableCell>
                </TableRow>
              )}
              {maintainers.map((m) => (
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
