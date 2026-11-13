import { useEffect, useState } from 'react'
import { Link, useRouter } from '../../core/router'
import { ROUTES } from '../../core/router/paths'

/**
 * Top navigation for public pages (front page and posts).
 * Includes smooth-scroll section links and Posts.
 */

export interface NavProps {
  /** Kept for caller compatibility. */
  isAuthenticated?: boolean
}

const SECTION_LINKS = [
  { id: 'demo', label: 'Demo' },
  { id: 'features', label: 'Features' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
] as const

export function Nav(_props: NavProps) {
  const { path, navigate } = useRouter()
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

  const isPostsActive =
    path === ROUTES.posts ||
    path.startsWith('/posts/') ||
    path === ROUTES.insights ||
    path.startsWith('/insights/')

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
      <Link
        to={ROUTES.posts}
        className={`header-nav-link ${isPostsActive ? 'is-active' : ''}`}
      >
        Posts
      </Link>
    </nav>
  )
}
