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

  it('clears the classification when no type is chosen', () => {
    // the derived trio has no source then — leaving a previous selection's
    // values behind would show and export them as if they were true
    const stale = { equipmentCategory: 'M', technicalObjectType: 'COMP', catalogProfile: 'PM0X' }
    expect(applyDerivations('EQUIPMENT', stale)).toEqual({})
    expect(applyDerivations('EQUIPMENT', { ...stale, equipmentType: '' })).toEqual({ equipmentType: '' })
    expect(applyDerivations('EQUIPMENT', { ...stale, description: 'keep me' })).toEqual({
      description: 'keep me',
    })
  })

  it('keeps existing values for a present-but-unknown type (renamed in a later import)', () => {
    // history must stay readable; an unknown type is already a validation error
    const legacy = { equipmentType: 'Retired Type Name', equipmentCategory: 'M', technicalObjectType: 'COMP' }
    expect(applyDerivations('EQUIPMENT', legacy)).toEqual(legacy)
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
