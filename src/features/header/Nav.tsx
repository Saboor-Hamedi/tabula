import { useEffect, useState } from 'react'
import { Link, useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { useUserSlug } from '../auth/useProfile'

/**
 * Top navigation for public pages (front page and posts).
 * Includes smooth-scroll section links, Posts, and Workspace (when signed in).
 */

export interface NavProps {
  /** Visitors who have not signed in only get the public sections. */
  isAuthenticated?: boolean
}

const SECTION_LINKS = [
  { id: 'demo', label: 'Demo' },
  { id: 'features', label: 'Features' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const

export function Nav({ isAuthenticated = false }: NavProps) {
  const { path, navigate } = useRouter()
  const userSlug = useUserSlug()
  const isLanding = path === ROUTES.landing || path === '/'
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    if (!isLanding) {
      setActiveSection(null)
      return
    }
    const updateActive = () => {
      const triggerY = Math.min(220, window.innerHeight * 0.32)
      let current: string | null = null
      for (const sec of SECTION_LINKS) {
        const el = document.getElementById(sec.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= triggerY && rect.bottom > 80) {
          current = sec.id
        }
      }
      setActiveSection(current)
    }
    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    return () => window.removeEventListener('scroll', updateActive)
  }, [isLanding])

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    if (isLanding) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate(ROUTES.landing)
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

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
      {SECTION_LINKS.map((sec) => (
        <button
          key={sec.id}
          type="button"
          className={`header-nav-link ${isLanding && activeSection === sec.id ? 'is-active' : ''}`}
          onClick={() => scrollToSection(sec.id)}
        >
          {sec.label}
        </button>
      ))}
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
