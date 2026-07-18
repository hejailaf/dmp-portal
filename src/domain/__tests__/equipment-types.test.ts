import { describe, expect, it } from 'vitest'
import { applyDerivations, EQUIPMENT_TYPE_NAMES, EQUIPMENT_TYPES, FIELD_MAP } from '../field-map'

describe('equipment type derivation', () => {
  it('fills category / object type / catalog profile from the selected type', () => {
    const derived = applyDerivations('EQUIPMENT', { equipmentType: 'Pump', description: 'P-101' })
    expect(derived).toMatchObject({
      equipmentType: 'Pump',
      equipmentCategory: 'M',
      technicalObjectType: '16X',
      catalogProfile: 'PM016X',
      description: 'P-101',
    })
  })

  it('overwrites stale derived values when the type changes', () => {
    const derived = applyDerivations('EQUIPMENT', {
      equipmentType: 'UPS',
      equipmentCategory: 'M',
      technicalObjectType: '16X',
      catalogProfile: 'PM016X',
    })
    expect(derived).toMatchObject({ equipmentCategory: 'E', technicalObjectType: '60X', catalogProfile: 'PM060X' })
  })

  it('leaves existing values untouched for empty or unknown types (legacy lines)', () => {
    const legacy = { equipmentCategory: 'M', technicalObjectType: 'COMP' }
    expect(applyDerivations('EQUIPMENT', legacy)).toEqual(legacy)
    expect(applyDerivations('EQUIPMENT', { ...legacy, equipmentType: 'No Such Type' })).toEqual({
      ...legacy,
      equipmentType: 'No Such Type',
    })
  })

  it('does not touch other object types', () => {
    const pm = { equipmentNumber: '1', equipmentType: 'Pump' }
    expect(applyDerivations('PM', pm)).toEqual(pm)
  })
})

describe('correlation table invariants (guards future xlsx re-imports)', () => {
  it('unique type names, complete rows, categories within M/E/I', () => {
    const names = new Set<string>()
    for (const row of EQUIPMENT_TYPES) {
      expect(names.has(row.equipmentType), `duplicate: ${row.equipmentType}`).toBe(false)
      names.add(row.equipmentType)
      expect(row.equipmentCategory).toMatch(/^[MEI]$/)
      expect(row.technicalObjectType.length).toBeGreaterThan(0)
      expect(row.catalogProfile.length).toBeGreaterThan(0)
    }
  })

  it('the editor dropdown options exactly cover the table, alphabetically', () => {
    expect(EQUIPMENT_TYPE_NAMES).toHaveLength(EQUIPMENT_TYPES.length)
    expect([...EQUIPMENT_TYPE_NAMES].sort((a, b) => a.localeCompare(b))).toEqual(EQUIPMENT_TYPE_NAMES)
    const field = FIELD_MAP.EQUIPMENT.fields.find((f) => f.key === 'equipmentType')
    expect(field?.options).toEqual(EQUIPMENT_TYPE_NAMES)
  })

  it('derived fields are flagged and never required', () => {
    for (const key of ['equipmentCategory', 'technicalObjectType', 'catalogProfile']) {
      const field = FIELD_MAP.EQUIPMENT.fields.find((f) => f.key === key)
      expect(field?.derived, `${key} should be derived`).toBe(true)
      expect(field?.requiredFor ?? []).toHaveLength(0)
    }
  })
})
