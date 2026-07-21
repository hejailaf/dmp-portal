import { describe, expect, it } from 'vitest'
import {
  assertTransition,
  availableTransitions,
  canTransition,
  TransitionError,
  type TransitionCtx,
} from '../status'
import { STATUSES } from '../types'

const admin: TransitionCtx = { roles: ['admin'] }
const owner: TransitionCtx = { roles: ['requester'], isOwner: true }
const otherRequester: TransitionCtx = { roles: ['requester'], isOwner: false }
const assignee: TransitionCtx = { roles: ['maintainer'], isAssignee: true }
const otherMaintainer: TransitionCtx = { roles: ['maintainer'], isAssignee: false }

describe('legal transitions and who may perform them', () => {
  it('Draft → Waiting (submit): owning requester and admin only', () => {
    expect(canTransition(owner, 'Draft', 'Waiting to be started')).toBe(true)
    expect(canTransition(admin, 'Draft', 'Waiting to be started')).toBe(true)
    expect(canTransition(otherRequester, 'Draft', 'Waiting to be started')).toBe(false)
    expect(canTransition(assignee, 'Draft', 'Waiting to be started')).toBe(false)
  })

  it('Waiting → In process (start): assigned maintainer and admin only', () => {
    expect(canTransition(assignee, 'Waiting to be started', 'In process')).toBe(true)
    expect(canTransition(admin, 'Waiting to be started', 'In process')).toBe(true)
    expect(canTransition(otherMaintainer, 'Waiting to be started', 'In process')).toBe(false)
    expect(canTransition(owner, 'Waiting to be started', 'In process')).toBe(false)
  })

  it('In process → Completed: assigned maintainer and admin only', () => {
    expect(canTransition(assignee, 'In process', 'Completed')).toBe(true)
    expect(canTransition(admin, 'In process', 'Completed')).toBe(true)
    expect(canTransition(otherMaintainer, 'In process', 'Completed')).toBe(false)
    expect(canTransition(owner, 'In process', 'Completed')).toBe(false)
  })

  it('reject (from Waiting and In process): admin only', () => {
    for (const from of ['Waiting to be started', 'In process'] as const) {
      expect(canTransition(admin, from, 'Rejected')).toBe(true)
      expect(canTransition(assignee, from, 'Rejected')).toBe(false)
      expect(canTransition(owner, from, 'Rejected')).toBe(false)
    }
  })

  it('Rejected → Draft (reopen): owning requester and admin only', () => {
    expect(canTransition(owner, 'Rejected', 'Draft')).toBe(true)
    expect(canTransition(admin, 'Rejected', 'Draft')).toBe(true)
    expect(canTransition(otherRequester, 'Rejected', 'Draft')).toBe(false)
    expect(canTransition(assignee, 'Rejected', 'Draft')).toBe(false)
  })

  it('return (from Waiting and In process): assigned maintainer and admin only', () => {
    for (const from of ['Waiting to be started', 'In process'] as const) {
      expect(canTransition(assignee, from, 'Returned')).toBe(true)
      expect(canTransition(admin, from, 'Returned')).toBe(true)
      expect(canTransition(otherMaintainer, from, 'Returned')).toBe(false)
      expect(canTransition(owner, from, 'Returned')).toBe(false)
    }
  })

  it('Returned → Waiting (resubmit): owning requester and admin only', () => {
    expect(canTransition(owner, 'Returned', 'Waiting to be started')).toBe(true)
    expect(canTransition(admin, 'Returned', 'Waiting to be started')).toBe(true)
    expect(canTransition(otherRequester, 'Returned', 'Waiting to be started')).toBe(false)
    expect(canTransition(assignee, 'Returned', 'Waiting to be started')).toBe(false)
  })
})

describe('illegal transitions are impossible for everyone, including admin', () => {
  const legal = new Set([
    'Draft>Waiting to be started',
    'Waiting to be started>In process',
    'In process>Completed',
    'Waiting to be started>Rejected',
    'In process>Rejected',
    'Rejected>Draft',
    'Waiting to be started>Returned',
    'In process>Returned',
    'Returned>Waiting to be started',
  ])

  it('every from×to pair outside the table is rejected', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (legal.has(`${from}>${to}`)) continue
        expect(canTransition(admin, from, to), `${from} → ${to}`).toBe(false)
      }
    }
  })

  it('Completed is terminal', () => {
    expect(availableTransitions(admin, 'Completed')).toEqual([])
  })
})

describe('assertTransition', () => {
  it('throws TransitionError on an illegal transition', () => {
    expect(() => assertTransition(admin, 'Draft', 'Completed')).toThrow(TransitionError)
  })

  it('throws TransitionError when the actor is not permitted', () => {
    expect(() => assertTransition(otherRequester, 'Draft', 'Waiting to be started')).toThrow(
      TransitionError,
    )
  })

  it('returns the transition (with audit event) when valid', () => {
    expect(assertTransition(owner, 'Draft', 'Waiting to be started').event).toBe('Submitted')
    expect(assertTransition(admin, 'In process', 'Rejected').event).toBe('Rejected')
    expect(assertTransition(owner, 'Rejected', 'Draft').event).toBe('Reopened')
    expect(assertTransition(assignee, 'In process', 'Returned').event).toBe('Returned')
    expect(assertTransition(owner, 'Returned', 'Waiting to be started').event).toBe('Submitted')
  })
})

describe('availableTransitions (drives the action buttons)', () => {
  it('admin from Waiting: start + reject + return', () => {
    expect(availableTransitions(admin, 'Waiting to be started').map((t) => t.to)).toEqual([
      'In process',
      'Rejected',
      'Returned',
    ])
  })

  it('assigned maintainer from Waiting: start + return', () => {
    expect(availableTransitions(assignee, 'Waiting to be started').map((t) => t.to)).toEqual([
      'In process',
      'Returned',
    ])
  })

  it('owning requester from Waiting: nothing', () => {
    expect(availableTransitions(owner, 'Waiting to be started')).toEqual([])
  })
})
