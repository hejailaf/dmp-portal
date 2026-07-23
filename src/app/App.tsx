import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getProvider } from '@/data'
import logoLight from '@/assets/logo-header.svg'
import logoDark from '@/assets/logo-header-dark.svg'
import { useAsync } from './hooks'
import { href, useRoute } from './router'
import { S } from './strings'
import { UserContext, useCurrentUser } from './user-context'
import { HeaderCtaContext } from './shell-context'
import { RoleSwitcher } from './components/RoleSwitcher'
import { ThemeToggle } from './components/ThemeToggle'
import { Button } from './components/ui/button'
import { DashboardPage } from './pages/DashboardPage'
import { HomePage } from './pages/HomePage'
import { ProvisionPage } from './pages/ProvisionPage'
import { RequestDetailPage } from './pages/RequestDetailPage'
import { RequestEditorPage } from './pages/RequestEditorPage'
import { RequestListPage } from './pages/RequestListPage'

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <a
      href={href(to)}
      className={`flex h-full items-center border-b-2 px-3 text-sm font-semibold transition-colors ${active ? 'border-[var(--teal)] text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </a>
  )
}

/** "Rana Requester" → "RR" — the header identity disc. */
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()

function Shell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser()
  const route = useRoute()
  const scope = route.query.get('scope')
  // a page showing its own create CTA (list first-visit invitation) hides
  // the header one — one primary per screen
  const [headerCtaHidden, setHeaderCtaHidden] = useState(false)
  const isRequester = user.roles.includes('requester')
  const isMaintainer = user.roles.includes('maintainer')
  const isAdmin = user.roles.includes('admin')
  // content width per route: home + request list at 1280 (the list's columns
  // fit since Req. Type went short — user decision 2026-07-23), detail/editor
  // keep 1536 for the wide field grids; the header ITEMS are independently
  // fixed at 1280 on every page (user decision 2026-07-23) — the full-width
  // band + teal rule carry the header visual, so the items don't need to
  // align with the content edges
  const pageCap = route.path === '/' || route.path === '/requests' ? 'max-w-7xl' : 'max-w-screen-2xl'
  // highest role labels the identity cluster (same precedence as the home page)
  const roleLabel = isAdmin
    ? S.roles.admin
    : isMaintainer
      ? S.roles.maintainer
      : isRequester
        ? S.roles.requester
        : S.roles.none

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-card">
        {/* header items: constant 1280 cap on every page — never shifts on
            navigation (user decision 2026-07-23) */}
        <div className="mx-auto flex h-16 w-full max-w-7xl items-stretch gap-4 px-4">
          <a href={href('/')} className="flex items-center">
            {/* light/dark lockups swap on the `.dark` html class */}
            <img src={logoLight} alt={S.appName} className="h-[34px] w-auto dark:hidden" />
            <img src={logoDark} alt={S.appName} className="hidden h-[34px] w-auto dark:block" />
          </a>
          {/* zone ruling: brand | workspace | identity — drafting-document hairlines */}
          <span aria-hidden className="h-8 w-px self-center bg-border" />
          <nav className="flex items-stretch gap-1">
            <NavLink to="/" label={S.nav.home} active={route.path === '/'} />
            {isRequester && (
              <NavLink to="/requests?scope=mine" label={S.nav.myRequests} active={route.path === '/requests' && scope === 'mine'} />
            )}
            {isMaintainer && (
              <NavLink to="/requests?scope=queue" label={S.nav.myQueue} active={route.path === '/requests' && scope === 'queue'} />
            )}
            {/* Unassigned link removed (user decision 2026-07-21) — the pool
                is reachable via the list page's scope switcher + home tiles */}
            {isAdmin && (
              <NavLink
                to="/requests?scope=all"
                label={S.nav.allRequests}
                active={route.path === '/requests' && (scope === 'all' || !scope)}
              />
            )}
            {isAdmin && (
              <NavLink to="/admin/dashboard" label={S.nav.dashboard} active={route.path === '/admin/dashboard'} />
            )}
            {isAdmin && (
              <NavLink to="/admin/provision" label={S.nav.setup} active={route.path === '/admin/provision'} />
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* the primary CTA lives on the right; hidden on home (which
                carries its own) and on the editor itself */}
            {(isRequester || isAdmin) && !headerCtaHidden && route.path !== '/' && route.path !== '/new' && (
              <a
                href={href('/new')}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-[0.5px]"
              >
                <Plus className="h-4 w-4" /> {S.home.newRequestCta}
              </a>
            )}
            <ThemeToggle />
            <span aria-hidden className="h-8 w-px bg-border" />
            {/* identity cluster: initials disc + name over role caption */}
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--teal-tint)] text-xs font-semibold text-primary"
              >
                {initialsOf(user.displayName)}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">{user.displayName}</span>
                <span className="block text-[11px] text-muted-foreground">{roleLabel}</span>
              </span>
            </div>
          </div>
        </div>
        {/* letterhead rule — the brand's teal line under the masthead */}
        <div aria-hidden className="h-[2px] w-full bg-[var(--teal)]" />
      </header>
      {/* home stays a bit tighter; data pages center under the 1536px site cap */}
      <main className={`mx-auto px-4 py-6 ${pageCap}`}>
        <HeaderCtaContext.Provider value={setHeaderCtaHidden}>{children}</HeaderCtaContext.Provider>
      </main>
      <footer className="border-t px-4 py-4 text-center text-[11px] tracking-[0.02em] text-muted-foreground">
        {S.footer.developedBy} · {S.footer.supportLabel}:{' '}
        <a href={`mailto:${S.footer.supportEmail}`} className="text-primary hover:underline">
          {S.footer.supportEmail}
        </a>
      </footer>
    </div>
  )
}

function Routes() {
  const route = useRoute()
  const [first, second, third] = route.segments

  if (route.path === '/') return <HomePage />
  // `key` per target: these render the same component at the same position, so
  // without it React reuses the instance and the previous request's editor
  // state (lines, description, tab) leaks into the next one
  if (route.path === '/new') return <RequestEditorPage key="new" />
  if (first === 'requests' && !second) return <RequestListPage />
  if (first === 'requests' && second && third === 'edit')
    return <RequestEditorPage key={second} requestId={second} />
  if (first === 'requests' && second && !third) return <RequestDetailPage key={second} id={second} />
  if (first === 'admin' && second === 'dashboard') return <DashboardPage />
  if (first === 'admin' && second === 'provision') return <ProvisionPage />

  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-display">{S.notFound.title}</h1>
      <a href={href('/')} className="mt-4 inline-block">
        <Button variant="outline">{S.notFound.goHome}</Button>
      </a>
    </div>
  )
}

export function App() {
  const user = useAsync(() => getProvider().getCurrentUser(), [])

  if (user.loading)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{S.list.loading}</div>
  if (user.error || !user.data)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-destructive">{user.error ?? S.errors.generic}</p>
        <Button variant="outline" onClick={user.reload}>
          {S.errors.retry}
        </Button>
      </div>
    )

  return (
    <UserContext.Provider value={user.data}>
      <Shell>
        <Routes />
      </Shell>
      <RoleSwitcher />
    </UserContext.Provider>
  )
}
