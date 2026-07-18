import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { S } from '../strings'

/**
 * Light/dark switch. Initial state comes from the no-flash boot script in
 * index.html (saved choice, else the OS preference); toggling stores an
 * explicit choice per browser.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('dmp-theme', next ? 'dark' : 'light')
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? S.theme.toLight : S.theme.toDark}
      title={dark ? S.theme.toLight : S.theme.toDark}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
