import { describe, expect, it } from 'vitest'
import { normalizeFieldData } from '../field-map'

// Guards the fix for: values typed under one action stayed in fieldData after
// the action changed, then leaked into storage, duplicated lines and the Excel
// export (where a maintainer would key them into SAP as truth).

describe('normalizeFieldData', () => {
  it('drops values for fields the action does not use', () => {
    const line = {
      equipmentNumber: '10001234',
      deletionReason: 'Scrapped',
      // typed while the line was still an Add, hidden after the switch:
      description: 'Centrifugal pump P-2205',
      equipmentType: 'Pump',
      manufacturer: 'Atlas Copco',
    }
    // toEqual (not objectContaining): proves the stale keys are gone AND that
    // derivation did not re-add the classification on a Delete line
    expect(normalizeFieldData('EQUIPMENT', 'DELETE', line)).toEqual({
      equipmentNumber: '10001234',
      deletionReason: 'Scrapped',
    })
  })

  it('still fills derived fields where they apply', () => {
    expect(normalizeFieldData('EQUIPMENT', 'ADD', { equipmentType: 'Pump' })).toEqual({
      equipmentType: 'Pump',
      equipmentCategory: 'M',
      technicalObjectType: '16X',
      catalogProfile: 'PM016X',
    })
  })

  it('keeps keys that are not in the field map (data may outlive the map)', () => {
    const out = normalizeFieldData('EQUIPMENT', 'ADD', { legacyKey: 'x', description: 'd' })
    expect(out.legacyKey).toBe('x')
    expect(out.description).toBe('d')
  })

  it('never mutates its input (the editor keeps hidden values recoverable)', () => {
    const input = { equipmentNumber: '1', description: 'stale', equipmentType: 'Pump' }
    const snapshot = { ...input }
    normalizeFieldData('EQUIPMENT', 'DELETE', input)
    expect(input).toEqual(snapshot)
  })

  it('is idempotent', () => {
    const once = normalizeFieldData('EQUIPMENT', 'CHANGE', {
      equipmentNumber: '10001234',
      description: 'New name',
      equipmentType: 'Pump',
      deletionReason: 'stale',
    })
    expect(normalizeFieldData('EQUIPMENT', 'CHANGE', once)).toEqual(once)
  })

  it('leaves data untouched when the action is not offered by the type', () => {
    // BOM Linkage has no Change; such a row can only come from legacy or
    // hand-edited data. Keeping it lets validateLine report the real problem
    // instead of the line silently emptying itself.
    const legacy = { parentNumber: '10003310', deletionReason: 'Equipment scrapped' }
    expect(normalizeFieldData('BOM_LINKAGE', 'CHANGE', legacy)).toEqual(legacy)
  })
})
