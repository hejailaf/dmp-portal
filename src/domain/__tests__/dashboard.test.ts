import { describe, expect, it } from 'vitest'
import { computeDashboard } from '../dashboard'
import type { Request } from '../types'

const NOW = new Date('2026-07-19T12:00:00Z')

let n = 0
function req(partial: Partial<Request>): Request {
  n += 1
  return {
    id: String(n),
    ref: `DCR-26${String(n).padStart(4, '0')}`,
    description: 'test request',
    status: 'Draft',
    requesterId: 'u-r',
    requesterName: 'Rana',
    createdAt: '2026-07-01T08:00:00Z',
    lineSummary: '',
    ...partial,
  }
}

describe('computeDashboard', () => {
  it('returns zeros and no maintainers for empty input', () => {
    const { kpis, maintainers } = computeDashboard([], NOW)
    expect(kpis).toEqual({ total: 0, waiting: 0, inProcess: 0, completed: 0, overdue: 0, unassigned: 0 })
    expect(maintainers).toEqual([])
  })

  it('counts KPIs including overdue and unassigned', () => {
    const requests = [
      req({ status: 'Draft' }),
      req({ status: 'Waiting to be started', dueDate: '2026-07-25T00:00:00Z' }), // unassigned, not overdue
      req({
        status: 'Waiting to be started',
        assigneeId: 'u-m',
        assigneeName: 'Malik',
        dueDate: '2026-07-10T00:00:00Z', // overdue
      }),
      req({ status: 'In process', assigneeId: 'u-m', assigneeName: 'Malik', dueDate: '2026-07-30T00:00:00Z' }),
      req({ status: 'Completed', assigneeId: 'u-m', assigneeName: 'Malik' }),
      req({ status: 'Rejected' }),
    ]
    const { kpis } = computeDashboard(requests, NOW)
    expect(kpis).toEqual({ total: 6, waiting: 2, inProcess: 1, completed: 1, overdue: 1, unassigned: 1 })
  })

  it('groups maintainer stats and sorts by open desc then name', () => {
    const requests = [
      req({ status: 'In process', assigneeId: 'u-a', assigneeName: 'Aya' }),
      req({ status: 'Waiting to be started', assigneeId: 'u-m', assigneeName: 'Malik' }),
      req({ status: 'In process', assigneeId: 'u-m', assigneeName: 'Malik' }),
      req({ status: 'Completed', assigneeId: 'u-a', assigneeName: 'Aya' }),
    ]
    const { maintainers } = computeDashboard(requests, NOW)
    expect(maintainers.map((m) => m.name)).toEqual(['Malik', 'Aya'])
    expect(maintainers[0]).toMatchObject({ open: 2, completed: 0 })
    expect(maintainers[1]).toMatchObject({ open: 1, completed: 1 })
  })

  it('computes on-time % (completed exactly at due is on-time) and avg cycle', () => {
    const requests = [
      req({
        status: 'Completed',
        assigneeId: 'u-m',
        assigneeName: 'Malik',
        submittedAt: '2026-07-01T00:00:00Z',
        dueDate: '2026-07-06T00:00:00.000Z',
        completedAt: '2026-07-06T00:00:00.000Z', // boundary: on time
      }),
      req({
        status: 'Completed',
        assigneeId: 'u-m',
        assigneeName: 'Malik',
        submittedAt: '2026-07-01T00:00:00Z',
        dueDate: '2026-07-03T00:00:00Z',
        completedAt: '2026-07-05T00:00:00Z', // late; cycle 4 days
      }),
    ]
    const { maintainers } = computeDashboard(requests, NOW)
    expect(maintainers[0].onTimePct).toBe(50)
    expect(maintainers[0].avgCycleDays).toBe(4.5) // (5 + 4) / 2
  })

  it('counts legacy Completed without completedAt but excludes it from ratios', () => {
    const requests = [
      req({ status: 'Completed', assigneeId: 'u-m', assigneeName: 'Malik', dueDate: '2026-07-03T00:00:00Z' }),
    ]
    const { maintainers } = computeDashboard(requests, NOW)
    expect(maintainers[0].completed).toBe(1)
    expect(maintainers[0].onTimePct).toBeUndefined()
    expect(maintainers[0].avgCycleDays).toBeUndefined()
  })
})
