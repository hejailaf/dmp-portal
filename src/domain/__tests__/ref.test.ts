import { describe, expect, it } from 'vitest'
import { formatRef, nextRef } from '../ref'

describe('reference numbers', () => {
  it('formats with 4-digit padding', () => {
    expect(formatRef(2026, 7)).toBe('REQ-2026-0007')
    expect(formatRef(2026, 1234)).toBe('REQ-2026-1234')
  })

  it('starts at 0001 for a fresh year', () => {
    expect(nextRef([], 2026)).toBe('REQ-2026-0001')
    expect(nextRef(['REQ-2025-0042'], 2026)).toBe('REQ-2026-0001')
  })

  it('increments past the max, ignoring gaps and other years', () => {
    expect(nextRef(['REQ-2026-0001', 'REQ-2026-0010', 'REQ-2025-0099'], 2026)).toBe('REQ-2026-0011')
  })

  it('keeps counting past 9999', () => {
    expect(formatRef(2026, 10000)).toBe('REQ-2026-10000')
    expect(nextRef(['REQ-2026-10000'], 2026)).toBe('REQ-2026-10001')
  })
})
