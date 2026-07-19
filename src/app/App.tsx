import { getProvider } from '@/data'
import logoLight from '@/assets/logo-header.svg'
import logoDark from '@/assets/logo-header-dark.svg'
import { useAsync } from './hooks'
import { href, useRoute } from './router'
import { S } from './strings'
import { UserContext, useCurrentUser } from './user-context'
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
      className={`flex h-full items-center border-b-[2.5px] px-3 text-sm font-semibold transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </a>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser()
  const route = useRoute()
  const scope = route.query.get('scope')
  const isRequester = user.roles.includes('requester')
  const isMaintainer = user.roles.includes('maintainer')
  const isAdmin = user.roles.includes('admin')

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card">
        {/* site content is centered and capped at 1920px (user decision) */}
        <div className="mx-auto flex h-16 w-full max-w-[1920px] items-stretch gap-4 px-4">
          <a href={href('/')} className="flex items-center">
            {/* light/dark lockups swap on the `.dark` html class */}
            <img src={logoLight} alt={S.appName} className="h-[34px] w-auto dark:hidden" />
            <img src={logoDark} alt={S.appName} className="hidden h-[34px] w-auto dark:block" />
          </a>
          <nav className="flex items-stretch gap-1">
            <NavLink to="/" label={S.nav.home} active={route.path === '/'} />
            {isRequester && (
              <NavLink to="/requests?scope=mine" label={S.nav.myRequests} active={route.path === '/requests' && scope === 'mine'} />
            )}
            {isMaintainer && (
              <NavLink to="/requests?scope=queue" label={S.nav.myQueue} active={route.path === '/requests' && scope === 'queue'} />
            )}
            {(isMaintainer || isAdmin) && (
              <NavLink
                to="/requests?scope=unassigned"
                label={S.nav.unassigned}
                active={route.path === '/requests' && scope === 'unassigned'}
              />
            )}
            {isAdmin && (
              <NavLink
                to="/requests?scope=all"
                label={S.nav.allRequests}
                active={route.path === '/requests' && (scope === 'all' || !scope)}
              />
            )}
            {(isRequester || isAdmin) && <NavLink to="/new" label={S.nav.newRequest} active={route.path === '/new'} />}
            {isAdmin && (
              <NavLink to="/admin/dashboard" label={S.nav.dashboard} active={route.path === '/admin/dashboard'} />
            )}
            {isAdmin && (
              <NavLink to="/admin/provision" label={S.nav.setup} active={route.path === '/admin/provision'} />
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">{user.displayName}</span>
          </div>
        </div>
      </header>
      {/* home stays a bit tighter; data pages center under the 1920px site cap */}
      <main className={`mx-auto px-4 py-6 ${route.path === '/' ? 'max-w-7xl' : 'max-w-[1920px]'}`}>
        {children}
      </main>
      <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
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
  if (route.path === '/new') return <RequestEditorPage />
  if (first === 'requests' && !second) return <RequestListPage />
  if (first === 'requests' && second && third === 'edit') return <RequestEditorPage requestId={second} />
  if (first === 'requests' && second && !third) return <RequestDetailPage id={second} />
  if (first === 'admin' && second === 'dashboard') return <DashboardPage />
  if (first === 'admin' && second === 'provision') return <ProvisionPage />

  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">{S.notFound.title}</h1>
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
