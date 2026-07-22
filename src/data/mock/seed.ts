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
    description: 'New feed pump for SITE-B',
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
    description: 'New air compressor AC-310 install',
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
    description: 'Create compressor bay functional location',
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
    description: 'Cooling tower fan replacement', // overdue (max SLA here is 5)
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
    description: 'Pump P-07 cost center and PM cycle extension', // overdue (SLA 3 for change)
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
    description: 'New PM plan for boiler feed pump',
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
    description: 'Remove BOM link for scrapped equipment',
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

  // Big-data seeds — stress the grids, editor, export and activity feed:
  // dozens of lines, near-max-length values, every object type, a fat
  // comment thread. Values stay inside field-map limits so the submit-
  // validation seed test keeps passing.
  const EQUIP_TYPES = ['Electric Motors', 'Pump', 'Valves', 'Fan/Blowers', 'Compressors', 'Heat Exchangers']
  const MAKERS = ['ABB', 'Siemens', 'WEG Industries', 'Toshiba International']
  const motorLine = (i: number): SeedSpec['lines'][number] => ({
    objectType: 'EQUIPMENT',
    action: 'ADD',
    fieldData: {
      description: `Induction motor ${110 + i} kW IE4 train ${1 + (i % 4)}`,
      equipmentType: EQUIP_TYPES[i % EQUIP_TYPES.length],
      manufacturer: MAKERS[i % MAKERS.length],
      model: `M315-${1000 + i}-IE4`,
      serialNumber: `SN26-${100000 + i * 37}`,
      planningPlant: '3000',
      functionalLocation: `SITE-C-PROC-AREA7-TRAIN${1 + (i % 4)}-MOT-${String(i + 1).padStart(3, '0')}`,
      costCenter: `31${10 + (i % 5)}`,
      plannerGroup: 'P03',
      mainWorkCenter: 'ELEC01',
      startupDate: '2026-08-01',
      engTagNo: `7-MOT-${String(i + 1).padStart(3, '0')}-A`,
      pidNo: `PID-A7-${200 + i}`,
    },
  })

  // big DRAFT (Rana) — 46 lines across all four tabs; open it in the editor
  add({
    status: 'Draft',
    requester: rana,
    description: 'Area 7 revamp batch 1 — motors, valves and PM plans',
    lines: [
      ...Array.from({ length: 28 }, (_, i) => motorLine(i)),
      ...Array.from({ length: 6 }, (_, i): SeedSpec['lines'][number] => ({
        objectType: 'FLOC',
        action: 'ADD',
        fieldData: {
          description: `Area 7 substation bay ${i + 1}`,
          superiorFunctionalLocation: 'SITE-C-PROC-AREA7',
          costCenter: '3110',
          startupDate: '2026-08-01',
        },
      })),
      ...Array.from({ length: 6 }, (_, i): SeedSpec['lines'][number] => ({
        objectType: 'BOM_LINKAGE',
        action: 'ADD',
        fieldData: { parentNumber: `100078${10 + i}`, material: `900456${10 + i}` },
      })),
      ...Array.from({ length: 6 }, (_, i): SeedSpec['lines'][number] => ({
        objectType: 'PM',
        action: 'ADD',
        fieldData: {
          equipmentNumber: `100078${10 + i}`,
          taskListNumber: `${3000 + i}`,
          plannerGroup: 'P03',
          mainWorkCenter: 'ELEC01',
          cycleFrequency: '6',
          startDate: '2026-09-01',
        },
      })),
    ],
  })

  // big OPEN request (Rana → Mona) — 40-line detail grid + 12-comment thread
  const bigOpen = add({
    status: 'In process',
    requester: rana,
    assignee: mona,
    submittedDaysAgo: 3,
    description: 'Warehouse 12 spare motor fleet registration',
    lines: Array.from({ length: 40 }, (_, i) => motorLine(i)),
  })
  const chat = [malik, mona, rana, aya]
  for (let i = 0; i < 12; i++) {
    const author = chat[i % chat.length]
    const body =
      i === 11
        ? `Full keying status for the fleet: ${Array.from({ length: 40 }, (_, n) => `motor ${String(n + 1).padStart(3, '0')} ok`).join('; ')}.`
        : `Batch ${i + 1} of the warehouse motors checked against the nameplate list — serials match, keying continues tomorrow.`
    const at = daysAgo(2.5 - i * 0.2)
    db.comments.push({ id: `c-big-${i + 1}`, requestId: bigOpen.id, authorId: author.id, authorName: author.displayName, body, createdAt: at })
    db.audit.push({ id: `a-${db.audit.length + 1}`, requestId: bigOpen.id, event: 'CommentAdded', actorId: author.id, actorName: author.displayName, at })
  }

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
