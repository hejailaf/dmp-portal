import { describe, expect, it } from 'vitest'
import { buildSeed } from '../mock/seed'
import { normalizeFieldData } from '@/domain/field-map'
import { validateForSubmit } from '@/domain/schemas'

// Guards seed/config drift: every submitted (non-draft) demo request must
// satisfy current field-map validation, including character limits.
describe('demo seed stays valid under the current field map', () => {
  it('all non-draft requests pass submit validation', () => {
    const db = buildSeed()
    for (const req of db.requests.filter((r) => r.status !== 'Draft')) {
      const lines = db.lines.filter((l) => l.requestId === req.id)
      const v = validateForSubmit(lines, req.description)
      const problems = Object.entries(v.lineResults)
        .filter(([, r]) => !r.ok)
        .map(([id, r]) => `${req.ref}/${id}: ${[...r.lineErrors, ...Object.values(r.fieldErrors)].join('; ')}`)
      expect(problems, problems.join(' | ')).toHaveLength(0)
    }
  })

  it('no seeded line carries data its action does not use', () => {
    // normalization may ADD derived values (the seed stores only the source
    // field); what it must never do here is REMOVE one — that would mean the
    // seed holds a value for a field the line's action doesn't use
    for (const l of buildSeed().lines) {
      expect(normalizeFieldData(l.objectType, l.action, l.fieldData), `${l.id}`).toMatchObject(l.fieldData)
    }
  })
})
