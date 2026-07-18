import { describe, expect, it } from 'vitest'
import { isEmptyLine, validateForSubmit, validateLine } from '../schemas'
import { actionsFor, FIELD_MAP, OBJECT_TYPE_CONFIGS } from '../field-map'
import { LINE_ACTIONS, type RequestLine } from '../types'

// Company field set (field-map review 2026-07-17): equipment ADD mandatory set
const validEquipmentAdd = {
  description: 'Centrifugal pump P-101',
  equipmentType: 'Pump',
  manufacturer: 'KSB',
  model: 'Etanorm 200',
  planningPlant: '1000',
  functionalLocation: 'SITE-A-PROC-PMP-01',
  costCenter: 'CC-1100',
  plannerGroup: 'P01',
  mainWorkCenter: 'MECH01',
  startupDate: '2026-07-16',
}

const validPmAdd = {
  equipmentNumber: '10001234',
  taskListNumber: '2001',
  mainWorkCenter: 'MECH01',
}

function line(partial: Partial<RequestLine> & Pick<RequestLine, 'objectType' | 'action'>): RequestLine {
  return { id: 'L1', requestId: 'R1', order: 1, fieldData: {}, ...partial }
}

describe('required fields per objectType × action', () => {
  it('equipment ADD passes with the mandatory set filled', () => {
    const v = validateLine(line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: validEquipmentAdd }))
    expect(v.ok).toBe(true)
  })

  it('equipment ADD fails when a mandatory field is missing', () => {
    const { description, ...rest } = validEquipmentAdd
    const v = validateLine(line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: rest }))
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.description).toMatch(/required/i)
  })

  it('equipment DELETE requires the identifier and a deletion reason', () => {
    const bad = validateLine(line({ objectType: 'EQUIPMENT', action: 'DELETE', fieldData: {} }))
    expect(bad.ok).toBe(false)
    expect(bad.fieldErrors.equipmentNumber).toMatch(/required/i)
    expect(bad.fieldErrors.deletionReason).toMatch(/required/i)

    const good = validateLine(
      line({
        objectType: 'EQUIPMENT',
        action: 'DELETE',
        fieldData: { equipmentNumber: '10001234', deletionReason: 'Scrapped' },
      }),
    )
    expect(good.ok).toBe(true)
  })

  it('FLoc identifier is required only on Change/Delete, not Add', () => {
    const add = validateLine(
      line({
        objectType: 'FLOC',
        action: 'ADD',
        fieldData: {
          description: 'Compressor bay',
          superiorFunctionalLocation: 'SITE-A-UTIL',
          startupDate: '2026-07-01',
        },
      }),
    )
    expect(add.ok).toBe(true)

    const del = validateLine(line({ objectType: 'FLOC', action: 'DELETE', fieldData: { deletionReason: 'Obsolete' } }))
    expect(del.ok).toBe(false)
    expect(del.fieldErrors.functionalLocation).toMatch(/required/i)
  })

  it('PM actions have their own mandatory sets (Maintenance Item identifies Change/Delete)', () => {
    const add = validateLine(line({ objectType: 'PM', action: 'ADD', fieldData: { equipmentNumber: '10001234' } }))
    expect(add.ok).toBe(false)
    expect(add.fieldErrors.taskListNumber).toMatch(/required/i)
    expect(add.fieldErrors.mainWorkCenter).toMatch(/required/i)

    const change = validateLine(
      line({ objectType: 'PM', action: 'CHANGE', fieldData: { changeDetails: 'Extend cycle' } }),
    )
    expect(change.ok).toBe(false)
    expect(change.fieldErrors.maintenanceItem).toMatch(/required/i)

    const del = validateLine(line({ objectType: 'PM', action: 'DELETE', fieldData: {} }))
    expect(del.ok).toBe(false)
    expect(del.fieldErrors.maintenanceItem).toMatch(/required/i)
    expect(del.fieldErrors.deletionReason).toMatch(/required/i)
  })
})

describe('per-object-type allowed actions', () => {
  it('BOM linkage offers only Add and Delete', () => {
    expect(actionsFor('BOM_LINKAGE')).toEqual(['ADD', 'DELETE'])
    expect(actionsFor('EQUIPMENT')).toEqual([...LINE_ACTIONS])
  })

  it('a BOM Change line is rejected outright', () => {
    const v = validateLine(line({ objectType: 'BOM_LINKAGE', action: 'CHANGE', fieldData: { parentNumber: '10001' } }))
    expect(v.ok).toBe(false)
    expect(v.lineErrors.join(' ')).toMatch(/not available/i)
  })
})

describe('input-type validation', () => {
  it('choice fields only accept configured options', () => {
    const v = validateLine(
      line({
        objectType: 'EQUIPMENT',
        action: 'ADD',
        fieldData: { ...validEquipmentAdd, equipmentType: 'Not A Real Type' },
      }),
    )
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.equipmentType).toMatch(/allowed values/i)
  })

  it('number fields validate the pattern but allow empty when optional', () => {
    const bad = validateLine(
      line({ objectType: 'PM', action: 'ADD', fieldData: { ...validPmAdd, equipmentNumber: 'EQ-abc' } }),
    )
    expect(bad.ok).toBe(false)
    expect(bad.fieldErrors.equipmentNumber).toMatch(/number/i)

    const empty = validateLine(
      line({ objectType: 'PM', action: 'ADD', fieldData: { ...validPmAdd, cycleFrequency: '' } }),
    )
    expect(empty.ok).toBe(true)
  })

  it('date fields require YYYY-MM-DD', () => {
    const bad = validateLine(
      line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: { ...validEquipmentAdd, startupDate: '16/07/2026' } }),
    )
    expect(bad.fieldErrors.startupDate).toMatch(/date/i)
  })

  it('tolerates unknown keys from older field-map versions', () => {
    const v = validateLine(
      line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: { ...validEquipmentAdd, legacyField: 'x' } }),
    )
    expect(v.ok).toBe(true)
  })
})

describe('character limits (SAP field lengths)', () => {
  it('rejects over-limit values on required fields', () => {
    const v = validateLine(
      line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: { ...validEquipmentAdd, description: 'X'.repeat(41) } }),
    )
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.description).toMatch(/at most 40 characters/i)
  })

  it('accepts values exactly at the limit', () => {
    const v = validateLine(
      line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: { ...validEquipmentAdd, description: 'X'.repeat(40) } }),
    )
    expect(v.ok).toBe(true)
  })

  it('rejects over-limit values on optional fields too', () => {
    const v = validateLine(
      line({ objectType: 'EQUIPMENT', action: 'ADD', fieldData: { ...validEquipmentAdd, serialNumber: '9'.repeat(19) } }),
    )
    expect(v.ok).toBe(false)
    expect(v.fieldErrors.serialNumber).toMatch(/at most 18 characters/i)
  })
})

describe('change-line rule', () => {
  it('a change line must fill at least one non-identifier field', () => {
    const onlyId = validateLine(
      line({ objectType: 'EQUIPMENT', action: 'CHANGE', fieldData: { equipmentNumber: '10001234' } }),
    )
    expect(onlyId.ok).toBe(false)
    expect(onlyId.lineErrors.join(' ')).toMatch(/at least one field/i)

    const withChange = validateLine(
      line({
        objectType: 'EQUIPMENT',
        action: 'CHANGE',
        fieldData: { equipmentNumber: '10001234', costCenter: 'CC-4711' },
      }),
    )
    expect(withChange.ok).toBe(true)
  })
})

describe('isEmptyLine (pruned at submit instead of validated)', () => {
  it('true for lines with no data or whitespace-only values', () => {
    expect(isEmptyLine({ fieldData: {} })).toBe(true)
    expect(isEmptyLine({ fieldData: { description: '', costCenter: '   ' } })).toBe(true)
  })

  it('false as soon as any field has a real value', () => {
    expect(isEmptyLine({ fieldData: { description: 'Pump' } })).toBe(false)
    expect(isEmptyLine({ fieldData: { equipmentType: 'Pump' } })).toBe(false)
  })
})

describe('validateForSubmit', () => {
  it('rejects a request with no lines', () => {
    const v = validateForSubmit([], 'valid description')
    expect(v.ok).toBe(false)
    expect(v.requestErrors.join(' ')).toMatch(/at least one line/i)
  })

  it('rejects a request with a blank description', () => {
    const good = line({ id: 'A', objectType: 'EQUIPMENT', action: 'ADD', fieldData: validEquipmentAdd })
    const v = validateForSubmit([good], '   ')
    expect(v.ok).toBe(false)
    expect(v.requestErrors.join(' ')).toMatch(/description/i)
    expect(validateForSubmit([good], 'MOC-1234 pump replacement').ok).toBe(true)
  })

  it('reports per-line results keyed by line id', () => {
    const good = line({ id: 'A', objectType: 'EQUIPMENT', action: 'ADD', fieldData: validEquipmentAdd })
    const bad = line({ id: 'B', objectType: 'EQUIPMENT', action: 'DELETE', fieldData: {} })
    const v = validateForSubmit([good, bad], 'valid description')
    expect(v.ok).toBe(false)
    expect(v.lineResults.A.ok).toBe(true)
    expect(v.lineResults.B.ok).toBe(false)
  })
})

describe('field-map config invariants (guards future config edits)', () => {
  it('choice fields declare options; requiredFor/appliesTo consistent with allowed actions; keys unique', () => {
    for (const cfg of OBJECT_TYPE_CONFIGS) {
      const allowed = cfg.actions ?? LINE_ACTIONS
      const keys = new Set<string>()
      for (const f of cfg.fields) {
        expect(keys.has(f.key), `${cfg.objectType}.${f.key} duplicated`).toBe(false)
        keys.add(f.key)
        if (f.input === 'choice') {
          expect(f.options?.length, `${cfg.objectType}.${f.key} needs options`).toBeGreaterThan(0)
        }
        if (f.maxLength !== undefined) {
          expect(f.maxLength, `${cfg.objectType}.${f.key} maxLength must be positive`).toBeGreaterThan(0)
          expect(
            f.input === 'text' || f.input === 'number',
            `${cfg.objectType}.${f.key} maxLength only applies to text/number fields`,
          ).toBe(true)
        }
        for (const action of f.requiredFor ?? []) {
          expect(
            !f.appliesTo || f.appliesTo.includes(action),
            `${cfg.objectType}.${f.key} required for ${action} but not shown for it`,
          ).toBe(true)
          expect(allowed.includes(action), `${cfg.objectType}.${f.key} required for disallowed action ${action}`).toBe(true)
        }
        for (const action of f.appliesTo ?? []) {
          expect(allowed.includes(action), `${cfg.objectType}.${f.key} shown for disallowed action ${action}`).toBe(true)
        }
      }
    }
  })

  it('every object type is present in FIELD_MAP with matching key', () => {
    for (const [key, cfg] of Object.entries(FIELD_MAP)) {
      expect(cfg.objectType).toBe(key)
    }
  })
})
