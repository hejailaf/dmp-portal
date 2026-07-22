import { describe, expect, it } from 'vitest'
import { parseLineSummary, summarizeLines } from '../field-map'
import type { RequestLine } from '../types'

// parseLineSummary must stay the exact inverse of summarizeLines — list
// views derive "Req. Type" and the line count from the stored summary string.
const line = (objectType: RequestLine['objectType'], action: RequestLine['action']) => ({
  objectType,
  action,
})

describe('parseLineSummary round-trips summarizeLines', () => {
  it('single type: one label, correct total', () => {
    const summary = summarizeLines([line('EQUIPMENT', 'ADD'), line('EQUIPMENT', 'DELETE')])
    expect(parseLineSummary(summary)).toEqual({ types: ['Equipment'], total: 2 })
  })

  it('multiple types and actions: labels in config order, counts summed', () => {
    const summary = summarizeLines([
      line('PM', 'ADD'),
      line('EQUIPMENT', 'ADD'),
      line('EQUIPMENT', 'ADD'),
      line('EQUIPMENT', 'CHANGE'),
      line('FLOC', 'DELETE'),
    ])
    expect(parseLineSummary(summary)).toEqual({
      types: ['Equipment', 'Functional Locations', 'PM'],
      total: 5,
    })
  })

  it('no lines: empty summary parses to zero', () => {
    expect(parseLineSummary(summarizeLines([]))).toEqual({ types: [], total: 0 })
  })
})
