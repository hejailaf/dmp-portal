// Every user-visible string lives here (spec §6: English only for now, but
// externalized so Arabic/RTL can be added later without touching components).

export const S = {
  appName: 'PM DataCare',
  appTagline: 'Caring for your SAP PM master data',

  nav: {
    home: 'Home',
    myRequests: 'My requests',
    myQueue: 'My queue',
    allRequests: 'All requests',
    dashboard: 'Dashboard',
    setup: 'Site setup',
  },

  home: {
    welcome: (name: string) => `Welcome, ${name}`,
    // only the HIGHEST role is shown (Admin > Maintainer > Requester)
    roleLabel: 'Your role',
    newRequestCta: 'Create a new request',
    open: 'Open',
    cards: {
      myRequests: 'My requests',
      myDrafts: 'Drafts',
      myOpen: 'Open',
      myQueue: 'Assigned to me',
      unassignedPool: 'Unassigned pool',
      overdue: 'Overdue',
      all: 'All requests',
      completed: 'Completed',
      dashboardLink: 'Open the admin dashboard',
    },
    // requester launchpad (home redesign 2026-07-21)
    newRequestCardBody: 'Equipment, FLoc, BOM, or PM changes.',
    myRequestsCardBody: (drafts: number, open: number, completed: number) =>
      `${drafts} ${drafts === 1 ? 'draft' : 'drafts'} · ${open} open · ${completed} completed`,
    templatesCardTitle: 'Excel template',
    templatesCardBody: 'One workbook, a sheet per data type — fill and import in the editor.',
    rejectedCallout: (ref: string) => `${ref} was rejected — fix and resubmit.`,
    openAction: 'Open',
    recentTitle: 'Recent requests',
    viewAll: 'View all',
    howSteps: [
      'Fill in the SAP data lines and submit.',
      'The data team reviews and keys it into SAP.',
      "Track progress here until it's completed.",
    ],
    // maintainer overview
    queueByStatus: 'My queue by status',
    dueThisWeek: 'Due this week',
    nothingDue: 'Nothing due this week.',
    // admin command center
    unassignedAging: (ref: string, days: number) =>
      `${ref} has waited unassigned for ${days} ${days === 1 ? 'day' : 'days'}.`,
    assignAction: 'Assign',
    overdueCallout: (n: number) => `${n} ${n === 1 ? 'request is' : 'requests are'} overdue.`,
    viewAction: 'View',
    teamLoad: 'Team load (open requests)',
    latestActivity: 'Latest activity',
    activitySubmitted: 'submitted',
    activityCompleted: 'completed',
    errorLoading: 'Could not load your overview.',
  },

  roles: {
    requester: 'Requester',
    maintainer: 'Data Maintainer',
    admin: 'Admin',
    none: 'No PM DataCare role',
  } as Record<string, string>,

  list: {
    title: {
      mine: 'My requests',
      queue: 'My queue',
      unassigned: 'Unassigned requests',
      all: 'All requests',
    },
    searchPlaceholder: 'Search ref, content, requester…',
    statusFilter: 'Status',
    allStatuses: 'All statuses',
    overdueOnly: 'Overdue only',
    columns: {
      ref: 'Ref',
      description: 'Description',
      status: 'Status',
      lines: 'Line items',
      requester: 'Requester',
      assignee: 'Assignee',
      due: 'Due',
    },
    claim: 'Claim',
    empty: 'No requests match.',
    loading: 'Loading requests…',
    count: (shown: number, total: number) =>
      shown === total
        ? `${total} ${total === 1 ? 'request' : 'requests'}`
        : `${shown} of ${total} requests`,
    clearSearch: 'Clear search',
    emptyMineTitle: 'No requests yet',
    emptyMineBody: 'Your submitted requests and drafts will appear here.',
  },

  status: {
    Draft: 'Draft',
    'Waiting to be started': 'Waiting to be started',
    'In process': 'In process',
    Completed: 'Completed',
    Rejected: 'Rejected',
  } as Record<string, string>,

  sla: {
    overdue: (days: number) => `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`,
    dueIn: (days: number) => `Due in ${days} ${days === 1 ? 'day' : 'days'}`,
    dueToday: 'Due today',
    noDue: 'No due date',
  },

  editor: {
    newTitle: 'New request',
    editTitle: (ref: string) => `Edit draft ${ref}`,
    descriptionLabel: 'Request description',
    descriptionPlaceholder: 'e.g. Create SCBA Equipment at WIP Area',
    addLine: 'Add line',
    selectLine: 'Select line',
    selectAll: 'Select all lines',
    duplicate: (n: number) => (n > 0 ? `Duplicate (${n})` : 'Duplicate'),
    deleteLines: (n: number) => (n > 0 ? `Delete (${n})` : 'Delete'),
    action: 'Action',
    lineNo: '#',
    notApplicable: 'n/a',
    saveDraft: 'Save draft',
    submit: 'Submit request',
    saving: 'Saving…',
    submitting: 'Submitting…',
    cancel: 'Cancel',
    tabCount: (n: number) => `(${n})`,
    lineErrorsTitle: 'Fix these before submitting:',
    lineError: (tab: string, n: number, msg: string) => `${tab} line ${n}: ${msg}`,
    noLines: 'No lines yet — click "Add line" to start, or import from an Excel template.',
    requiredHintHighlighted: 'Highlighted',
    requiredHintRest: ' fields are mandatory.',
    downloadTemplate: 'Download Excel template',
    importExcel: 'Import from Excel',
    imported: (n: number) => `Imported ${n} ${n === 1 ? 'line' : 'lines'} from Excel.`,
    importNothing: 'No lines were imported.',
    importIssuesTitle: 'Import notes:',
    confirmDropHidden: (n: number) =>
      `${n} ${n === 1 ? 'value does' : 'values do'} not apply to their line's action and will be removed when this request is saved.\n\nContinue?`,
    confirmLeave: 'This request has unsaved changes. They will be lost if you leave now.\n\nLeave anyway?',
  },

  detail: {
    requester: 'Requester',
    assignee: 'Assignee',
    unassigned: 'Unassigned',
    createdAt: 'Created',
    changedAt: 'Changed',
    submittedAt: 'Submitted',
    dueDate: 'Due date',
    slaDays: 'SLA days',
    rejectReason: 'Reject reason',
    linesTitle: 'Line items',
    noLines: 'No line items yet.',
    commentsTitle: 'Comments',
    commentPlaceholder: 'Write a comment…',
    commentAdd: 'Add comment',
    commentHint: 'Ctrl+Enter to send',
    noComments: 'No comments yet.',
    auditTitle: 'Audit trail',
    attachmentsTitle: 'Attachments',
    attachmentsEmpty: 'No attachments yet.',
    attachmentAdd: 'Add attachment',
    attachmentUploading: 'Uploading…',
    attachmentPendingNote: 'not uploaded yet',
    attachmentUpload: (n: number) => `Upload ${n} ${n === 1 ? 'file' : 'files'}`,
    attachmentRemove: 'Remove',
    attachmentCount: (n: number, max: number) => `${n} of ${max} attachments used`,
    exportExcel: 'Export to Excel',
    exporting: 'Exporting…',
    more: 'More',
    completedAt: 'Completed',
    editDraft: 'Edit draft',
    claim: 'Claim this request',
    assign: 'Assign',
    assignTitle: 'Assign to maintainer',
    assignSelect: 'Choose a maintainer',
    reassign: 'Reassign',
    rejectTitle: 'Reject request',
    rejectReasonLabel: 'Reason (required — the requester will see this)',
    rejectConfirm: 'Reject',
    submitBlocked: 'This draft has validation errors — open "Edit draft" to fix them.',
    notFound: 'Request not found.',
    loading: 'Loading request…',
  },

  audit: {
    Created: 'created the request',
    DraftUpdated: 'updated the draft',
    Submitted: 'submitted the request',
    Assigned: 'changed the assignee',
    StatusChanged: 'changed the status',
    Rejected: 'rejected the request',
    Reopened: 'reopened the request as a draft',
    CommentAdded: 'added a comment',
    AttachmentAdded: 'added an attachment',
  } as Record<string, string>,

  provision: {
    title: 'Site setup',
    intro:
      'Creates and verifies the four PMDC lists on this SharePoint site, checks the role groups, and runs a write self-test. Safe to run repeatedly.',
    provisionNow: 'Verify & provision lists',
    selfTest: 'Run connection self-test',
    setHome: 'Make the app the site home page',
    hideLists: 'Hide lists from Site contents',
    showLists: 'Show lists in Site contents',
    hideListsNote:
      'Hidden lists do not appear in SharePoint Designer — click "Show lists in Site contents" before editing the email workflow, and hide again after.',
    setHomeDone: (page: string) =>
      `Site welcome page is now "${page}" — opening the bare site URL serves the app. (Revert: set it back to SitePages/Home.aspx the same way.)`,
    running: 'Working…',
    listsTitle: 'Lists',
    groupsTitle: 'Role groups',
    groupExists: 'exists',
    groupMissing: 'missing',
    groupsHint: 'Create missing groups by hand — see docs/LIST_SETUP.md for the exact names and permissions.',
    selfTestTitle: 'Connection self-test',
    mockNote: 'Running on the mock provider — nothing to provision; the buttons demonstrate the screen only.',
    recipeHint: 'Groups and permissions are set up manually once — the click-by-click recipe is docs/LIST_SETUP.md.',
    adminOnly: 'Site setup is only available to PMDC Admins.',
  },

  dashboard: {
    title: 'Admin dashboard',
    adminOnly: 'The dashboard is only available to PMDC Admins.',
    kpis: {
      total: 'All requests',
      waiting: 'Waiting to be started',
      inProcess: 'In process',
      completed: 'Completed',
      overdue: 'Overdue',
      unassigned: 'Unassigned',
    },
    maintainersTitle: 'Maintainer performance',
    columns: {
      maintainer: 'Maintainer',
      open: 'Open workload',
      completed: 'Completed',
      onTime: 'On-time %',
      avgCycle: 'Avg cycle (days)',
    },
    noMaintainers: 'No requests have been assigned yet.',
    notMeasured: '—',
    note: 'On-time % and cycle time cover requests completed after the CompletedAt upgrade; older completions show —.',
  },

  theme: {
    toDark: 'Switch to dark mode',
    toLight: 'Switch to light mode',
  },

  time: {
    todayAt: (t: string) => `today, ${t}`,
    yesterdayAt: (t: string) => `yesterday, ${t}`,
  },

  footer: {
    developedBy: 'Developed by Abdullah F. Alharbi',
    supportLabel: 'Support',
    supportEmail: 'abdullah.hejaili@aramco.com',
  },

  roleSwitcher: {
    title: 'Demo role switcher',
    subtitle: 'Mock data only — not part of the real app',
    reset: 'Reset demo data',
  },

  errors: {
    generic: 'Something went wrong.',
    retry: 'Retry',
  },

  notFound: {
    title: 'Page not found',
    goHome: 'Go to home',
  },
} as const
