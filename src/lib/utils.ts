import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// All displayed dates use numeric US format (user decision 2026-07-18);
// stored values remain ISO everywhere.
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Date-only FieldData values (YYYY-MM-DD) → MM/DD/YYYY. String-parsed on
 * purpose: new Date('2026-07-01') is UTC midnight and can shift a day in
 * some timezones. Non-date strings pass through unchanged.
 */
export function formatDateValue(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value
}

/** Inverse of formatDateValue: MM/DD/YYYY → YYYY-MM-DD. Non-matching strings pass through unchanged. */
export function parseUsDate(value: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : value
}

/** Browser file download for a generated blob (Excel export/template). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
