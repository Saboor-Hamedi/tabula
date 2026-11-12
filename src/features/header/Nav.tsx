import { Link, useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { useUserSlug } from '../auth/useProfile'

/**
 * Top navigation for public pages (front page and posts).
 * Kept clean and minimal: Posts and Workspace (when signed in).
 */

export interface NavProps {
  /** Visitors who have not signed in only get the public sections. */
  isAuthenticated?: boolean
}

export function Nav({ isAuthenticated = false }: NavProps) {
  const { path } = useRouter()
  const userSlug = useUserSlug()

  const items = [
    {
      to: ROUTES.posts,
      matches: (p: string) =>
        p === ROUTES.posts ||
        p.startsWith('/posts/') ||
        p === ROUTES.insights ||
        p.startsWith('/insights/'),
      label: 'Posts',
      visible: true,
    },
    {
      to: userPath('/workspace', userSlug),
      matches: (p: string) => p === ROUTES.workspace || p.endsWith('/workspace'),
      label: 'Workspace',
      visible: isAuthenticated,
    },
  ].filter((item) => item.visible)

  return (
    <nav className="header-nav" aria-label="Product">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className={`header-nav-link ${item.matches(path) ? 'is-active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
