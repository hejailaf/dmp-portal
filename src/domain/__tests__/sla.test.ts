import { describe, expect, it } from 'vitest'
import { computeDueDate, daysUntilDue, extendDueDate, isOverdue, slaDaysFor } from '../sla'

describe('slaDaysFor — max across lines governs the request', () => {
  it('single-action requests use that action’s days', () => {
    expect(slaDaysFor([{ action: 'ADD' }])).toBe(5)
    expect(slaDaysFor([{ action: 'CHANGE' }])).toBe(3)
    expect(slaDaysFor([{ action: 'DELETE' }])).toBe(2)
  })

  it('mixed requests take the max', () => {
    expect(slaDaysFor([{ action: 'DELETE' }, { action: 'CHANGE' }])).toBe(3)
    expect(slaDaysFor([{ action: 'CHANGE' }, { action: 'ADD' }, { action: 'DELETE' }])).toBe(5)
  })

  it('throws for zero lines', () => {
    expect(() => slaDaysFor([])).toThrow()
  })
})

describe('computeDueDate — calendar-day arithmetic', () => {
  it('adds whole days', () => {
    expect(computeDueDate('2026-07-16T08:00:00.000Z', 5)).toBe('2026-07-21T08:00:00.000Z')
  })

  it('rolls over month boundaries', () => {
    expect(computeDueDate('2026-01-30T10:30:00.000Z', 3)).toBe('2026-02-02T10:30:00.000Z')
  })
})

describe('isOverdue — derived at render time', () => {
  const past = '2026-07-01T00:00:00.000Z'
  const future = '2026-08-01T00:00:00.000Z'
  const now = new Date('2026-07-16T00:00:00.000Z')

  it('true for active statuses past due', () => {
    expect(isOverdue({ status: 'Waiting to be started', dueDate: past }, now)).toBe(true)
    expect(isOverdue({ status: 'In process', dueDate: past }, now)).toBe(true)
  })

  it('false when not yet due', () => {
    expect(isOverdue({ status: 'Waiting to be started', dueDate: future }, now)).toBe(false)
  })

  it('false for Completed / Rejected / Draft regardless of date', () => {
    expect(isOverdue({ status: 'Completed', dueDate: past }, now)).toBe(false)
    expect(isOverdue({ status: 'Rejected', dueDate: past }, now)).toBe(false)
    expect(isOverdue({ status: 'Draft', dueDate: undefined }, now)).toBe(false)
  })

  it('false while Returned — the clock is paused with the requester', () => {
    expect(isOverdue({ status: 'Returned', dueDate: past }, now)).toBe(false)
  })
})

describe('extendDueDate — SLA pause over the Returned interval', () => {
  it('adds exactly the time spent with the requester', () => {
    expect(
      extendDueDate('2026-07-25T08:00:00.000Z', '2026-07-20T08:00:00.000Z', '2026-07-22T08:00:00.000Z'),
    ).toBe('2026-07-27T08:00:00.000Z')
  })

  it('handles partial days', () => {
    expect(
      extendDueDate('2026-07-25T08:00:00.000Z', '2026-07-20T08:00:00.000Z', '2026-07-20T20:00:00.000Z'),
    ).toBe('2026-07-25T20:00:00.000Z')
  })

  it('never shrinks the due date on clock skew', () => {
    expect(
      extendDueDate('2026-07-25T08:00:00.000Z', '2026-07-22T08:00:00.000Z', '2026-07-22T07:59:00.000Z'),
    ).toBe('2026-07-25T08:00:00.000Z')
  })
})

describe('daysUntilDue', () => {
  const now = new Date('2026-07-16T00:00:00.000Z')

  it('rounds up partial days remaining', () => {
    expect(daysUntilDue('2026-07-18T12:00:00.000Z', now)).toBe(3)
    expect(daysUntilDue('2026-07-17T00:00:00.000Z', now)).toBe(1)
  })

  it('is negative once past due', () => {
    expect(daysUntilDue('2026-07-14T12:00:00.000Z', now)).toBe(-1)
  })
})
