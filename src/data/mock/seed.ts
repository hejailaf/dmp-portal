import type { AuditEntry, Comment, Request, RequestLine, User } from '@/domain/types'
import { computeDueDate, slaDaysFor } from '@/domain/sla'
import { summarizeLines } from '@/domain/field-map'
import { formatRef } from '@/domain/ref'

// Demo seed: one user per role (plus a second requester/maintainer for
// realistic assignment), ~10 requests across all statuses and object types.
// Dates are relative to "now" so overdue badges are always demonstrable.

export const SEED_USERS: User[] = [
  { id: 'u-rana', displayName: 'Rana Requester', email: 'rana@example.com', roles: ['requester'] },
  { id: 'u-omar', displayName: 'Omar Operator', email: 'omar@example.com', roles: ['requester'] },
  { id: 'u-malik', displayName: 'Malik Maintainer', email: 'malik@example.com', roles: ['maintainer'] },
  { id: 'u-mona', displayName: 'Mona Maintainer', email: 'mona@example.com', roles: ['maintainer'] },
  { id: 'u-aya', displayName: 'Aya Admin', email: 'aya@example.com', roles: ['admin'] },
]

export const DEFAULT_USER_ID = 'u-rana'

export interface MockDb {
  requests: Request[]
  lines: RequestLine[]
  comments: Comment[]
  audit: AuditEntry[]
  attachments: Record<string, { fileName: string; url: string; size: number }[]>
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

interface SeedSpec {
  status: Request['status']
  description: string
  requester: User
  assignee?: User
  /** days ago the request was submitted (omit for drafts) */
  submittedDaysAgo?: number
  /** days ago the request was completed (Completed seeds only) */
  completedDaysAgo?: number
  rejectReason?: string
  lines: Array<Pick<RequestLine, 'objectType' | 'action' | 'fieldData'>>
}

export function buildSeed(): MockDb {
  const db: MockDb = { requests: [], lines: [], comments: [], audit: [], attachments: {} }
  const year = new Date().getFullYear()
  let seq = 0

  const audit = (requestId: string, event: AuditEntry['event'], actor: User, at: string, oldValue?: string, newValue?: string) =>
    db.audit.push({ id: `a-${db.audit.length + 1}`, requestId, event, actorId: actor.id, actorName: actor.displayName, oldValue, newValue, at })

  const add = (spec: SeedSpec) => {
    seq += 1
    const id = `r-${seq}`
    const lines: RequestLine[] = spec.lines.map((l, i) => ({
      ...l,
      id: `${id}-l${i + 1}`,
      requestId: id,
      order: i + 1,
    }))
    const submittedAt = spec.submittedDaysAgo !== undefined ? daysAgo(spec.submittedDaysAgo) : undefined
    const slaDays = submittedAt ? slaDaysFor(lines) : undefined
    const createdAt = daysAgo((spec.submittedDaysAgo ?? 0) + 1)
    const req: Request = {
      id,
      ref: formatRef(year, seq),
      description: spec.description,
      status: spec.status,
      requesterId: spec.requester.id,
      requesterName: spec.requester.displayName,
      assigneeId: spec.assignee?.id,
      assigneeName: spec.assignee?.displayName,
      createdAt,
      submittedAt,
      slaDays,
      dueDate: submittedAt && slaDays ? computeDueDate(submittedAt, slaDays) : undefined,
      completedAt: spec.completedDaysAgo !== undefined ? daysAgo(spec.completedDaysAgo) : undefined,
      rejectReason: spec.rejectReason,
      lineSummary: summarizeLines(lines),
    }
    db.requests.push(req)
    db.lines.push(...lines)

    // a plausible audit trail per status
    audit(id, 'Created', spec.requester, createdAt)
    if (submittedAt) audit(id, 'Submitted', spec.requester, submittedAt, 'Draft', 'Waiting to be started')
    if (spec.assignee && submittedAt)
      audit(id, 'Assigned', SEED_USERS[4], submittedAt, undefined, spec.assignee.displayName)
    if ((spec.status === 'In process' || spec.status === 'Completed') && spec.assignee && submittedAt)
      audit(id, 'StatusChanged', spec.assignee, daysAgo((spec.submittedDaysAgo ?? 1) - 0.5), 'Waiting to be started', 'In process')
    if (spec.status === 'Completed' && spec.assignee)
      audit(id, 'StatusChanged', spec.assignee, req.completedAt ?? daysAgo(0.2), 'In process', 'Completed')
    if (spec.status === 'Rejected' && spec.rejectReason)
      audit(id, 'Rejected', SEED_USERS[4], daysAgo(0.5), 'Waiting to be started', spec.rejectReason)
    return req
  }

  const [rana, omar, malik, mona, aya] = SEED_USERS

  // Drafts
  add({
    status: 'Draft',
    requester: rana,
    description: 'New feed pump for SITE-B (project WO-77812)',
    lines: [
      {
        objectType: 'EQUIPMENT',
        action: 'ADD',
        fieldData: { description: 'Centrifugal pump P-2205', equipmentType: 'Pump' },
      },
    ],
  })
  add({
    status: 'Draft',
    requester: omar,
    description: 'Task list correction for compressor PM',
    lines: [
      { objectType: 'PM', action: 'CHANGE', fieldData: { equipmentNumber: '10004711', taskListNumber: '889' } },
    ],
  })

  // Waiting — one unassigned (claimable), one assigned, one assigned & overdue
  add({
    status: 'Waiting to be started',
    requester: rana,
    submittedDaysAgo: 1,
    description: 'New air compressor AC-310 install - MOC-2201',
    lines: [
      {
        objectType: 'EQUIPMENT',
        action: 'ADD',
        fieldData: {
          description: 'Air compressor AC-310',
          equipmentType: 'Compressors',
          equipmentCategory: 'M',
          technicalObjectType: '18X',
          catalogProfile: 'PM018X',
          manufacturer: 'Atlas Copco',
          model: 'GA-30',
          planningPlant: '1000',
          functionalLocation: 'SITE-A-UTIL-COMP-01',
          costCenter: '1100',
          plannerGroup: 'P01',
          mainWorkCenter: 'MECH01',
          startupDate: '2026-06-01',
        },
      },
      {
        objectType: 'BOM_LINKAGE',
        action: 'ADD',
        fieldData: {
          parentNumber: '10003310',
          material: '90012345',
        },
      },
    ],
  })
  add({
    status: 'Waiting to be started',
    requester: omar,
    assignee: malik,
    submittedDaysAgo: 2,
    description: 'Create compressor bay functional location - MOC-2188',
    lines: [
      {
        objectType: 'FLOC',
        action: 'ADD',
        fieldData: {
          description: 'Compressor bay 1',
          superiorFunctionalLocation: 'SITE-A-UTIL',
          costCenter: '1100',
          startupDate: '2026-05-15',
        },
      },
    ],
  })
  add({
    status: 'Waiting to be started',
    requester: rana,
    assignee: mona,
    submittedDaysAgo: 9,
    description: 'Cooling tower fan replacement - WO-77250', // overdue (max SLA here is 5)
    lines: [
      {
        objectType: 'EQUIPMENT',
        action: 'ADD',
        fieldData: {
          description: 'Cooling tower fan CT-104',
          equipmentType: 'Fan/Blowers',
          equipmentCategory: 'M',
          technicalObjectType: '19X',
          catalogProfile: 'PM019X',
          manufacturer: 'SPX',
          model: 'CT-F400',
          planningPlant: '2000',
          functionalLocation: 'SITE-B-COOL-CT-04',
          costCenter: '2100',
          plannerGroup: 'P02',
          mainWorkCenter: 'MECH02',
          startupDate: '2026-04-20',
        },
      },
      { objectType: 'EQUIPMENT', action: 'DELETE', fieldData: { equipmentNumber: '10001899', deletionReason: 'Duplicate record' } },
    ],
  })

  // Unassigned AND overdue — exercises the pool + overdue combination
  // (list filters are mutually exclusive; this row shows red in the pool)
  add({
    status: 'Waiting to be started',
    requester: omar,
    submittedDaysAgo: 5, // CHANGE SLA is 3 days → 2 days overdue
    description: 'Tank farm FLoc cost center correction',
    lines: [
      { objectType: 'FLOC', action: 'CHANGE', fieldData: { functionalLocation: 'SITE-A-TANK-TK-01', costCenter: '2300' } },
    ],
  })

  // In process — one on track, one overdue
  add({
    status: 'In process',
    requester: omar,
    assignee: malik,
    submittedDaysAgo: 1,
    description: 'Cost center transfer after area reorg',
    lines: [
      { objectType: 'EQUIPMENT', action: 'CHANGE', fieldData: { equipmentNumber: '10002501', costCenter: '4711' } },
    ],
  })
  add({
    status: 'In process',
    requester: rana,
    assignee: mona,
    submittedDaysAgo: 6,
    description: 'Pump P-07 cost center + PM cycle extension - MOC-2144', // overdue (SLA 3 for change)
    lines: [
      { objectType: 'FLOC', action: 'CHANGE', fieldData: { functionalLocation: 'SITE-B-PROC-PMP-07', costCenter: '2200' } },
      { objectType: 'PM', action: 'CHANGE', fieldData: { equipmentNumber: '10002501', taskListNumber: '102', maintenanceItem: '458', changeDetails: 'Extend cycle to 6 months' } },
    ],
  })

  // Completed
  add({
    status: 'Completed',
    requester: rana,
    assignee: malik,
    submittedDaysAgo: 12,
    description: 'New PM plan for boiler feed pump - MOC-2100',
    completedDaysAgo: 0.2, // SLA 5d, submitted 12d ago → completed LATE (dashboard demo)
    lines: [
      {
        objectType: 'PM',
        action: 'ADD',
        fieldData: {
          equipmentNumber: '10003310',
          taskListNumber: '2001',
          mainWorkCenter: 'MECH01',
          cycleFrequency: '3',
        },
      },
    ],
  })
  add({
    status: 'Completed',
    requester: omar,
    assignee: mona,
    submittedDaysAgo: 20,
    description: 'Remove BOM link for scrapped equipment - WO-76990',
    completedDaysAgo: 19, // SLA 2d → completed ON TIME (dashboard demo)
    lines: [
      { objectType: 'BOM_LINKAGE', action: 'DELETE', fieldData: { parentNumber: '10001899', deletionReason: 'Equipment scrapped' } },
    ],
  })

  // Rejected (reopenable)
  add({
    status: 'Rejected',
    requester: rana,
    submittedDaysAgo: 3,
    description: 'Cost center change for pump P-11',
    rejectReason: 'Cost center CC-9999 does not exist — please verify and resubmit',
    lines: [
      { objectType: 'EQUIPMENT', action: 'CHANGE', fieldData: { equipmentNumber: '10007001', costCenter: '9999' } },
    ],
  })

  // a couple of comments for texture
  db.comments.push(
    {
      id: 'c-1',
      requestId: 'r-6',
      authorId: malik.id,
      authorName: malik.displayName,
      body: 'Checked with planning — cost center confirmed, keying into MDG today.',
      createdAt: daysAgo(0.5),
    },
    {
      id: 'c-2',
      requestId: 'r-10',
      authorId: aya.id,
      authorName: aya.displayName,
      body: 'Rejecting — CC-9999 fails validation in SAP. See reason.',
      createdAt: daysAgo(0.6),
    },
  )
  db.audit.push(
    { id: `a-${db.audit.length + 1}`, requestId: 'r-6', event: 'CommentAdded', actorId: malik.id, actorName: malik.displayName, at: daysAgo(0.5) },
    { id: `a-${db.audit.length + 1}x`, requestId: 'r-10', event: 'CommentAdded', actorId: aya.id, actorName: aya.displayName, at: daysAgo(0.6) },
  )

  return db
}
