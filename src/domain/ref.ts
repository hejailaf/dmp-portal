// Reference numbers: DCR-YYNNNN (2-digit year + sequence, e.g. DCR-260009),
// sequential per year. Pre-restyle REQ-YYYY-NNNN refs are ignored by the
// matcher, so an existing list simply starts DCR numbering at 0001.
//
// There is no server to hand out numbers, so the next number is computed
// from the refs that already exist at submit time. Two truly simultaneous
// submits could compute the same number; the data layer re-checks
// uniqueness after writing and retries once. Accepted for internal-team
// submit rates (plan decision #4).

export function formatRef(year: number, seq: number): string {
  return `DCR-${String(year % 100).padStart(2, '0')}${String(seq).padStart(4, '0')}`
}

export function nextRef(existingRefs: string[], year: number): string {
  const yy = String(year % 100).padStart(2, '0')
  const re = new RegExp(`^DCR-${yy}(\\d{4,})$`)
  let max = 0
  for (const ref of existingRefs) {
    const m = re.exec(ref)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatRef(year, max + 1)
}
