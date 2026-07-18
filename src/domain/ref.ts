// Reference numbers: REQ-YYYY-NNNN, sequential per year.
//
// There is no server to hand out numbers, so the next number is computed
// from the refs that already exist at submit time. Two truly simultaneous
// submits could compute the same number; the data layer re-checks
// uniqueness after writing and retries once. Accepted for internal-team
// submit rates (plan decision #4).

export function formatRef(year: number, seq: number): string {
  return `REQ-${year}-${String(seq).padStart(4, '0')}`
}

export function nextRef(existingRefs: string[], year: number): string {
  const re = new RegExp(`^REQ-${year}-(\\d{4,})$`)
  let max = 0
  for (const ref of existingRefs) {
    const m = re.exec(ref)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatRef(year, max + 1)
}
