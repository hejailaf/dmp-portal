import { formatDateTime } from '@/lib/utils'
import { S } from './strings'

/** "today, 7:32 PM" / "yesterday, 7:32 PM"; older entries keep the absolute form. */
export function relativeDateTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return S.time.todayAt(time)
  if (d.toDateString() === yesterday.toDateString()) return S.time.yesterdayAt(time)
  return formatDateTime(iso)
}
