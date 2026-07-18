import { PROVIDER_NAME } from '@/data'
import { mockControls } from '@/data/mock'
import { S } from '../strings'
import { Select } from './ui/input'
import { Button } from './ui/button'

/**
 * Dev-only role switcher (spec §5): lets one person exercise all three roles
 * against the mock data. Rendered ONLY when the mock provider is active — a
 * production (sharepoint) build never shows it.
 */
export function RoleSwitcher() {
  if (PROVIDER_NAME !== 'mock') return null
  return (
    <div className="fixed bottom-4 right-4 z-40 w-64 rounded-lg border bg-card p-3 shadow-lg">
      <div className="text-xs font-semibold">{S.roleSwitcher.title}</div>
      <div className="mb-2 text-[11px] text-muted-foreground">{S.roleSwitcher.subtitle}</div>
      <Select
        value={mockControls.currentUserId()}
        onChange={(e) => mockControls.setCurrentUser(e.target.value)}
        className="mb-2 h-8 text-xs"
      >
        {mockControls.listUsers().map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName} — {u.roles.map((r) => S.roles[r]).join(', ')}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="outline" className="w-full" onClick={() => mockControls.resetDemoData()}>
        {S.roleSwitcher.reset}
      </Button>
    </div>
  )
}
