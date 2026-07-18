import { describe, expect, it } from 'vitest'
import { formatRef, nextRef } from '../ref'

describe('reference numbers', () => {
  it('formats as DCR-YYNNNN with 4-digit padding', () => {
    expect(formatRef(2026, 7)).toBe('DCR-260007')
    expect(formatRef(2026, 1234)).toBe('DCR-261234')
  })

  it('starts at 0001 for a fresh year', () => {
    expect(nextRef([], 2026)).toBe('DCR-260001')
    expect(nextRef(['DCR-250042'], 2026)).toBe('DCR-260001')
  })

  it('increments past the max, ignoring gaps and other years', () => {
    expect(nextRef(['DCR-260001', 'DCR-260010', 'DCR-250099'], 2026)).toBe('DCR-260011')
  })

  it('ignores legacy REQ-YYYY-NNNN refs', () => {
    expect(nextRef(['REQ-2026-0042', 'DCR-260003'], 2026)).toBe('DCR-260004')
  })

  it('keeps counting past 9999', () => {
    expect(formatRef(2026, 10000)).toBe('DCR-2610000')
    expect(nextRef(['DCR-2610000'], 2026)).toBe('DCR-2610001')
  })
})
