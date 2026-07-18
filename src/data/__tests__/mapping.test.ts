import { describe, expect, it } from 'vitest'
import {
  filterByScope,
  mapAudit,
  mapComment,
  mapLine,
  mapRequest,
  rolesFromGroups,
} from '../sp/mapping'
import type { Request, User } from '@/domain/types'

describe('mapRequest', () => {
  it('maps a full item', () => {
    const r = mapRequest({
      Id: 7,
      Title: 'REQ-2026-0007',
      RequestStatus: 'In process',
      RequesterLogin: 'i:0#.w|corp\\rana',
      RequesterName: 'Rana R',
      AssigneeLogin: 'i:0#.w|corp\\malik',
      AssigneeName: 'Malik M',
      Created: '2026-07-10T08:00:00Z',
      SubmittedAt: '2026-07-11T08:00:00Z',
      DueDate: '2026-07-14T08:00:00Z',
      SlaDays: 3,
      RejectReason: null,
      LineSummary: 'Equipment: 1 Change',
    })
    expect(r).toMatchObject({
      id: '7',
      ref: 'REQ-2026-0007',
      status: 'In process',
      requesterId: 'i:0#.w|corp\\rana',
      assigneeId: 'i:0#.w|corp\\malik',
      slaDays: 3,
      lineSummary: 'Equipment: 1 Change',
    })
  })

  it('maps a minimal draft (empty optionals become undefined)', () => {
    const r = mapRequest({ Id: 1, Title: 'REQ-2026-0001', Created: '2026-07-10T08:00:00Z' })
    expect(r.status).toBe('Draft')
    expect(r.assigneeId).toBeUndefined()
    expect(r.submittedAt).toBeUndefined()
    expect(r.rejectReason).toBeUndefined()
    expect(r.lineSummary).toBe('')
  })
})

describe('mapLine', () => {
  it('parses the FieldData JSON blob', () => {
    const l = mapLine({
      Id: 11,
      RequestId: 7,
      ObjectType: 'PM',
      LineAction: 'CHANGE',
      LineOrder: 2,
      FieldData: '{"equipmentNumber":"10002501","maintenanceItem":"458"}',
    })
    expect(l).toMatchObject({
      id: '11',
      requestId: '7',
      objectType: 'PM',
      action: 'CHANGE',
      order: 2,
      fieldData: { equipmentNumber: '10002501', maintenanceItem: '458' },
    })
  })

  it('survives a corrupted blob with an empty fieldData', () => {
    const l = mapLine({ Id: 1, RequestId: 1, FieldData: '{not json' })
    expect(l.fieldData).toEqual({})
  })
})

describe('rolesFromGroups', () => {
  it('maps the three exact group names and ignores others', () => {
    expect(rolesFromGroups(['DMP Requesters', 'Random Team'])).toEqual(['requester'])
    expect(rolesFromGroups(['DMP Maintainers', 'DMP Admins'])).toEqual(['maintainer', 'admin'])
    expect(rolesFromGroups(['dmp requesters'])).toEqual([]) // exact match only
  })
})

describe('mapComment / mapAudit author fields', () => {
  it('reads author display name from the expanded Author', () => {
    const c = mapComment({ Id: 1, RequestId: 2, Created: '2026-07-10T08:00:00Z', Author: { Title: 'Aya A' }, Body: 'hi' })
    expect(c.authorName).toBe('Aya A')
    const a = mapAudit({ Id: 1, RequestId: 2, Created: '2026-07-10T08:00:00Z', Author: { Title: 'Aya A' }, Event: 'Submitted', OldValue: 'Draft', NewValue: 'Waiting to be started' })
    expect(a).toMatchObject({ event: 'Submitted', actorName: 'Aya A', oldValue: 'Draft' })
  })
})

describe('filterByScope (same rules as the mock)', () => {
  const req = (over: Partial<Request>): Request => ({
    id: '1',
    ref: 'REQ-2026-0001',
    status: 'Waiting to be started',
    requesterId: 'u-a',
    requesterName: 'A',
    createdAt: '2026-07-10T08:00:00Z',
    lineSummary: '',
    ...over,
  })
  const me = (over: Partial<User>): User => ({ id: 'u-a', displayName: 'A', email: '', roles: ['requester'], ...over })

  const data = [
    req({ id: '1', requesterId: 'u-a', status: 'Draft' }),
    req({ id: '2', requesterId: 'u-b', status: 'Draft' }),
    req({ id: '3', requesterId: 'u-b', status: 'Waiting to be started' }),
    req({ id: '4', requesterId: 'u-b', status: 'Waiting to be started', assigneeId: 'u-m', assigneeName: 'M' }),
    req({ id: '5', requesterId: 'u-b', status: 'In process', assigneeId: 'u-m', assigneeName: 'M' }),
    req({ id: '6', requesterId: 'u-a', status: 'Draft', assigneeId: 'u-m' }),
  ]

  it('mine = own requests incl. drafts', () => {
    expect(filterByScope(data, 'mine', me({})).map((r) => r.id)).toEqual(['1', '6'])
  })

  it('queue = assigned to me, never drafts', () => {
    expect(filterByScope(data, 'queue', me({ id: 'u-m', roles: ['maintainer'] })).map((r) => r.id)).toEqual(['4', '5'])
  })

  it('unassigned = waiting without assignee', () => {
    expect(filterByScope(data, 'unassigned', me({ id: 'u-m', roles: ['maintainer'] })).map((r) => r.id)).toEqual(['3'])
  })

  it('all: admins see everything, others never see foreign drafts', () => {
    expect(filterByScope(data, 'all', me({ roles: ['admin'] }))).toHaveLength(6)
    expect(filterByScope(data, 'all', me({ id: 'u-a' })).map((r) => r.id)).toEqual(['1', '3', '4', '5', '6'])
  })
})
