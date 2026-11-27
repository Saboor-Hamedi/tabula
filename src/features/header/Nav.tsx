import { Link, useRouter } from '../../core/router'
import { ROUTES } from '../../core/router/paths'

/**
 * Top navigation for public pages.
 *
 * Uses real multi-page routes (`/`, `/features`, `/sources`, `/pricing`, `/posts`)
 * so clicking any item opens its dedicated page cleanly via the router.
 */

export interface NavProps {
  /** Kept for caller compatibility. */
  isAuthenticated?: boolean
}

export const NAV_PAGES = [
  { to: ROUTES.home, label: 'Home', match: (p: string) => p === '/' || p === '/landing' },
  { to: ROUTES.features, label: 'Features', match: (p: string) => p === '/features' },
  {
    to: ROUTES.sources,
    label: 'Sources',
    match: (p: string) => p === '/sources' || p.startsWith('/sources/'),
  },
  { to: ROUTES.pricing, label: 'Pricing', match: (p: string) => p === '/pricing' },
  {
    to: ROUTES.posts,
    label: 'Posts',
    match: (p: string) =>
      p === '/posts' ||
      p.startsWith('/posts/') ||
      p === '/insights' ||
      p.startsWith('/insights/'),
  },
  {
    to: ROUTES.lumina,
    label: 'Lumina',
    match: (p: string) => p === '/lumina' || p.startsWith('/lumina/'),
  },
] as const

export function Nav(_props: NavProps) {
  const { path } = useRouter()

  return (
    <nav className="header-nav" aria-label="Main navigation">
      {NAV_PAGES.map((item) => {
        const active = item.match(path)
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`header-nav-link ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="header-nav-link-text">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
