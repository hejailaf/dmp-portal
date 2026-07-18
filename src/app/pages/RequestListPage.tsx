import { useMemo, useState } from 'react'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { getProvider, type RequestScope } from '@/data'
import { isOverdue } from '@/domain/sla'
import { STATUSES, type Request, type User } from '@/domain/types'
import { formatDate } from '@/lib/utils'
import { useAsync } from '../hooks'
import { href, navigate, useRoute } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { SlaBadge, StatusBadge } from '../components/badges'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input, Select } from '../components/ui/input'
import { autoColumnSize, ClippedCell, DataGrid, usePersistedColumnSizing } from '../components/DataGrid'

function scopesFor(user: User): RequestScope[] {
  const scopes: RequestScope[] = []
  if (user.roles.includes('admin')) scopes.push('all')
  if (user.roles.includes('maintainer')) scopes.push('queue')
  if (user.roles.includes('maintainer') || user.roles.includes('admin')) scopes.push('unassigned')
  if (user.roles.includes('requester')) scopes.push('mine')
  return scopes.length ? scopes : ['mine']
}

const columnHelper = createColumnHelper<Request>()

export function RequestListPage() {
  const user = useCurrentUser()
  const provider = getProvider()
  const route = useRoute()
  const scopes = scopesFor(user)
  const requestedScope = route.query.get('scope') as RequestScope | null
  const scope: RequestScope = requestedScope && scopes.includes(requestedScope) ? requestedScope : scopes[0]
  const statusFilter = route.query.get('status') ?? ''
  const overdueOnly = route.query.get('overdue') === '1'
  const [search, setSearch] = useState('')
  const [claiming, setClaiming] = useState<string>()
  const [claimError, setClaimError] = useState<string>()

  const requests = useAsync(() => provider.listRequests(scope), [scope, user.id])

  const setQuery = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ scope, ...(statusFilter && { status: statusFilter }), ...(overdueOnly && { overdue: '1' }), ...patch })
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k)
    navigate(`/requests?${q.toString()}`)
  }

  const filtered = useMemo(() => {
    let rows = requests.data ?? []
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
    if (overdueOnly) rows = rows.filter((r) => isOverdue(r))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((r) =>
        [r.ref, r.description, r.lineSummary, r.requesterName, r.assigneeName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return rows
  }, [requests.data, statusFilter, overdueOnly, search])

  const showClaim = scope === 'unassigned' && user.roles.includes('maintainer')

  const claim = async (id: string) => {
    setClaiming(id)
    setClaimError(undefined)
    try {
      await provider.assignRequest(id, user.id)
      requests.reload()
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : String(e))
    } finally {
      setClaiming(undefined)
    }
  }

  // auto-fit text columns from the visible rows; badge columns (status, due)
  // keep explicit sizes since text measurement misses the badge chrome
  const autoSizes = useMemo(
    () => ({
      ref: autoColumnSize(S.list.columns.ref, filtered.map((r) => r.ref)),
      lines: autoColumnSize(S.list.columns.lines, filtered.map((r) => r.lineSummary)),
      requester: autoColumnSize(S.list.columns.requester, filtered.map((r) => r.requesterName)),
      assignee: autoColumnSize(S.list.columns.assignee, filtered.map((r) => r.assigneeName ?? S.detail.unassigned)),
    }),
    [filtered],
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor('ref', {
        header: S.list.columns.ref,
        size: autoSizes.ref,
        cell: (info) => (
          <a href={href(`/requests/${info.row.original.id}`)} className="font-medium text-primary hover:underline">
            {info.getValue()}
          </a>
        ),
      }),
      columnHelper.accessor('status', {
        header: S.list.columns.status,
        size: 170,
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('lineSummary', {
        header: S.list.columns.lines,
        size: autoSizes.lines,
        cell: (info) => <ClippedCell value={info.getValue() ?? ''} className="text-muted-foreground" />,
      }),
      columnHelper.accessor('requesterName', {
        header: S.list.columns.requester,
        size: autoSizes.requester,
        cell: (info) => <ClippedCell value={info.getValue()} />,
      }),
      columnHelper.accessor('assigneeName', {
        header: S.list.columns.assignee,
        size: autoSizes.assignee,
        cell: (info) =>
          info.getValue() ? (
            <ClippedCell value={info.getValue()!} />
          ) : (
            <span className="text-muted-foreground">{S.detail.unassigned}</span>
          ),
      }),
      columnHelper.accessor('dueDate', {
        header: S.list.columns.due,
        size: 210,
        cell: (info) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            {formatDate(info.getValue())}
            <SlaBadge request={info.row.original} />
          </span>
        ),
      }),
      ...(showClaim
        ? [
            columnHelper.display({
              id: 'claim',
              header: '',
              size: 90,
              enableResizing: false,
              cell: (info) => (
                <Button
                  size="sm"
                  disabled={claiming === info.row.original.id}
                  onClick={() => void claim(info.row.original.id)}
                >
                  {S.list.claim}
                </Button>
              ),
            }),
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showClaim, claiming, autoSizes],
  )

  const sizing = usePersistedColumnSizing('request-list')
  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
    state: { columnSizing: sizing.columnSizing },
    onColumnSizingChange: sizing.onColumnSizingChange,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{S.list.title[scope]}</h1>
        {scopes.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {scopes.map((s) => (
              <a
                key={s}
                href={href(`/requests?scope=${s}`)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${s === scope ? 'bg-card shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {S.list.title[s]}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={S.list.searchPlaceholder}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setQuery({ status: e.target.value })}
          className="w-52"
          aria-label={S.list.statusFilter}
        >
          <option value="">{S.list.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {S.status[s]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setQuery({ overdue: e.target.checked ? '1' : '' })}
            className="h-4 w-4 accent-primary"
          />
          {S.list.overdueOnly}
        </label>
      </div>

      {claimError && <p className="text-sm text-destructive">{claimError}</p>}

      <Card>
        {requests.loading ? (
          <p className="p-6 text-muted-foreground">{S.list.loading}</p>
        ) : requests.error ? (
          <div className="p-6">
            <p className="text-destructive">{requests.error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={requests.reload}>
              {S.errors.retry}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-muted-foreground">{S.list.empty}</p>
        ) : (
          <DataGrid table={table} />
        )}
      </Card>
    </div>
  )
}
