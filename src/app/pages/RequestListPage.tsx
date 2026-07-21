import { useEffect, useMemo, useState } from 'react'
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { Plus, X } from 'lucide-react'
import { getProvider, type RequestScope } from '@/data'
import { isOverdue } from '@/domain/sla'
import { STATUSES, type Request, type User } from '@/domain/types'
import { formatDate } from '@/lib/utils'
import { useAsync, usePageTitle } from '../hooks'
import { href, navigate, useRoute } from '../router'
import { S } from '../strings'
import { useCurrentUser } from '../user-context'
import { SlaBadge, StatusBadge } from '../components/badges'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input, Select } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { autoColumnSize, ClippedCell, DataGrid, usePersistedColumnSizing } from '../components/DataGrid'

// last-used scope/filters, restored when the list is opened without a query
// (the detail page's back-link reads it too)
export const LIST_STATE_KEY = 'dmp-list-state'
export interface StoredListState {
  scope?: RequestScope
  status?: string
  overdue?: boolean
}
export function readListState(): StoredListState {
  try {
    return (JSON.parse(localStorage.getItem(LIST_STATE_KEY) ?? '{}') as StoredListState) ?? {}
  } catch {
    return {}
  }
}

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
  // bare "#/requests" restores the last-used scope + filters; an explicit
  // query (nav links, dashboard KPIs) always wins
  const noQuery = [...route.query.keys()].length === 0
  const stored = useMemo(readListState, [])
  const scope: RequestScope =
    requestedScope && scopes.includes(requestedScope)
      ? requestedScope
      : noQuery && stored.scope && scopes.includes(stored.scope)
        ? stored.scope
        : scopes[0]
  const statusFilter = route.query.get('status') ?? (noQuery ? (stored.status ?? '') : '')
  const overdueOnly = route.query.get('overdue') === '1' || (noQuery && stored.overdue === true)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [claiming, setClaiming] = useState<string>()
  const [claimError, setClaimError] = useState<string>()

  usePageTitle(S.list.title[scope])
  useEffect(() => {
    localStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({ scope, status: statusFilter, overdue: overdueOnly } satisfies StoredListState),
    )
  }, [scope, statusFilter, overdueOnly])

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
      description: autoColumnSize(S.list.columns.description, filtered.map((r) => r.description)),
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
      columnHelper.accessor('description', {
        header: S.list.columns.description,
        size: autoSizes.description,
        cell: (info) => <ClippedCell value={info.getValue()} />,
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
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 60 },
    state: { columnSizing: sizing.columnSizing, sorting },
    onColumnSizingChange: sizing.onColumnSizingChange,
    onSortingChange: setSorting,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{S.list.title[scope]}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={S.list.searchPlaceholder}
            className="pr-8"
          />
          {search && (
            <button
              type="button"
              aria-label={S.list.clearSearch}
              title={S.list.clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
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
        {/* Overdue and Unassigned are mutually exclusive (user decision
            2026-07-21) — checking one clears the other */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) =>
              setQuery({
                overdue: e.target.checked ? '1' : '',
                ...(e.target.checked && scope === 'unassigned'
                  ? { scope: scopes.find((s) => s !== 'unassigned') ?? scopes[0] }
                  : {}),
              })
            }
            className="h-4 w-4 accent-primary"
          />
          {S.list.overdueOnly}
        </label>
        {/* the pool is the one scope without a nav link (user decision
            2026-07-21) — a checkbox here swaps scope, base scope on uncheck */}
        {scopes.includes('unassigned') && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scope === 'unassigned'}
              onChange={(e) =>
                setQuery({
                  scope: e.target.checked
                    ? 'unassigned'
                    : (scopes.find((s) => s !== 'unassigned') ?? scopes[0]),
                  ...(e.target.checked ? { overdue: '' } : {}),
                })
              }
              className="h-4 w-4 accent-primary"
            />
            {S.list.unassignedOnly}
          </label>
        )}
        {requests.data && (
          <span className="ml-auto text-sm text-muted-foreground">
            {S.list.count(filtered.length, requests.data.length)}
          </span>
        )}
      </div>

      {claimError && <p className="text-sm text-destructive">{claimError}</p>}

      <Card>
        {requests.loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : requests.error ? (
          <div className="p-6">
            <p className="text-destructive">{requests.error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={requests.reload}>
              {S.errors.retry}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          requests.data?.length === 0 && scope === 'mine' && !search && !statusFilter && !overdueOnly ? (
            // a brand-new requester's first visit: invite, don't apologize
            <div className="p-10 text-center">
              <p className="font-medium">{S.list.emptyMineTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{S.list.emptyMineBody}</p>
              <a href={href('/new')} className="mt-4 inline-block">
                <Button>
                  <Plus className="h-4 w-4" /> {S.home.newRequestCta}
                </Button>
              </a>
            </div>
          ) : (
            <p className="p-6 text-muted-foreground">{S.list.empty}</p>
          )
        ) : (
          <DataGrid
            table={table}
            // overdue rows carry a red left edge in addition to the badge
            rowClassName={(row) => (isOverdue(row.original) ? 'border-l-[3px] border-l-destructive' : undefined)}
          />
        )}
      </Card>
    </div>
  )
}
