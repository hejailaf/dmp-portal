import { describe, expect, it } from 'vitest'
import { buildSeed, SEED_USERS } from '../mock/seed'
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

  it('user-role invariants hold (guards against list-order drift)', () => {
    const db = buildSeed()
    const byId = new Map(SEED_USERS.map((u) => [u.id, u]))
    for (const r of db.requests) {
      // assignees must be maintainers — never requesters
      if (r.assigneeId) expect(byId.get(r.assigneeId)?.roles, r.ref).toContain('maintainer')
      // requesters of seeds must hold the requester role
      expect(byId.get(r.requesterId)?.roles, r.ref).toContain('requester')
    }
    // Noor demos the first-visit empty states — she owns and is assigned nothing
    expect(db.requests.some((r) => r.requesterId === 'u-noor' || r.assigneeId === 'u-noor')).toBe(false)
    // admin-only audit events are performed by an admin
    for (const a of db.audit.filter((x) => x.event === 'Assigned' || x.event === 'Rejected')) {
      expect(byId.get(a.actorId)?.roles, a.event).toContain('admin')
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
