import { describe, expect, it } from 'vitest'
import { buildSeed } from '../mock/seed'
import { validateForSubmit } from '@/domain/schemas'

// Guards seed/config drift: every submitted (non-draft) demo request must
// satisfy current field-map validation, including character limits.
describe('demo seed stays valid under the current field map', () => {
  it('all non-draft requests pass submit validation', () => {
    const db = buildSeed()
    for (const req of db.requests.filter((r) => r.status !== 'Draft')) {
      const lines = db.lines.filter((l) => l.requestId === req.id)
      const v = validateForSubmit(lines)
      const problems = Object.entries(v.lineResults)
        .filter(([, r]) => !r.ok)
        .map(([id, r]) => `${req.ref}/${id}: ${[...r.lineErrors, ...Object.values(r.fieldErrors)].join('; ')}`)
      expect(problems, problems.join(' | ')).toHaveLength(0)
    }
  })
})
