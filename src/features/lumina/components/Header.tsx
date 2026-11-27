import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import { useAuthUser, useIsAdmin, useUserSlug } from '../../auth/useProfile'
import {
  CloseIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SidebarIcon,
  SunIcon,
  UserIcon,
} from '../../common/Icons'
import { useTheme } from '../../common/useTheme'
import { searchLuminaDocsInDb, type LuminaDocRecord } from '../api/docs'
import {
  formatStarCount,
  LUMINA_REPO_URL,
  type LuminaReleaseInfo,
} from '../api/release'
import { LUMINA_DOC_PAGES } from '../content'

export interface HeaderProps {
  release: LuminaReleaseInfo
  onToggleMobileNav: () => void
}

export function Header({ release, onToggleMobileNav }: HeaderProps) {
  const { navigate } = useRouter()
  const { theme, toggleTheme } = useTheme()
  const user = useAuthUser()
  const isAdmin = useIsAdmin()
  const userSlug = useUserSlug()

  const isSignedIn = Boolean(user && !user.is_anonymous)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [dbMatches, setDbMatches] = useState<LuminaDocRecord[]>([])
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    const onMouseDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  // Query Supabase `pg_trgm` RPC (`lumina_search_docs`) when user types a search term
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setDbMatches([])
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      searchLuminaDocsInDb(q).then((rows) => {
        if (active) setDbMatches(rows)
      })
    }, 140)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return LUMINA_DOC_PAGES.slice(0, 6)

    const bySlug = new Map<
      string,
      { slug: string; title: string; subtitle: string; section: string; path: string }
    >()

    for (const row of dbMatches) {
      const def = LUMINA_DOC_PAGES.find((p) => p.slug === row.slug)
      bySlug.set(row.slug, {
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle ?? def?.subtitle ?? '',
        section: row.section,
        path: def?.path ?? `/lumina/${row.slug}`,
      })
    }

    for (const page of LUMINA_DOC_PAGES) {
      if (bySlug.has(page.slug)) continue
      if (
        page.title.toLowerCase().includes(q) ||
        page.subtitle.toLowerCase().includes(q) ||
        page.content.toLowerCase().includes(q) ||
        page.section.toLowerCase().includes(q)
      ) {
        bySlug.set(page.slug, {
          slug: page.slug,
          title: page.title,
          subtitle: page.subtitle,
          section: page.section,
          path: page.path,
        })
      }
    }

    return Array.from(bySlug.values()).slice(0, 8)
  }, [searchQuery, dbMatches])

  const starBadge = formatStarCount(release.stars)
  const dashboardUrl = `${userPath('/app', userSlug)}?section=lumina`

  return (
    <header className="lumina-topbar">
      <div className="lumina-topbar-left">
        <button
          type="button"
          className="lumina-mobile-menu-btn"
          onClick={onToggleMobileNav}
          aria-label="Toggle documentation navigation"
        >
          <SidebarIcon size={16} />
        </button>

        <Link to="/lumina" className="lumina-brand">
          <span className="lumina-brand-mark" aria-hidden="true">
            L
          </span>
          <span className="lumina-brand-text">Lumina</span>
        </Link>

        {release.version ? (
          <a
            href={release.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lumina-version-badge"
            title="Latest release fetched dynamically from GitHub"
          >
            {release.version}
          </a>
        ) : null}
      </div>

      <div className="lumina-topbar-center" ref={searchWrapRef}>
        <div className={`lumina-search-box ${searchOpen ? 'is-open' : ''}`}>
          <SearchIcon size={14} />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchOpen(true)
            }}
            placeholder="Search documentation…"
            aria-label="Search Lumina documentation"
          />
          {searchQuery ? (
            <button
              type="button"
              className="lumina-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <CloseIcon size={12} />
            </button>
          ) : (
            <kbd className="lumina-search-kbd">Ctrl K</kbd>
          )}
        </div>

        {searchOpen ? (
          <div className="lumina-search-dropdown" role="listbox">
            {searchResults.length === 0 ? (
              <div className="lumina-search-empty">
                No documentation matches “{searchQuery}”.
              </div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className="lumina-search-result"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchQuery('')
                    navigate(item.path)
                  }}
                >
                  <div className="lumina-search-result-top">
                    <span className="lumina-search-result-title">{item.title}</span>
                    <span className="lumina-search-result-section">{item.section}</span>
                  </div>
                  <p className="lumina-search-result-sub">{item.subtitle}</p>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="lumina-topbar-right">
        {/* GitHub Icon-Only Button with Notification-Style Star Count Badge */}
        <a
          href={LUMINA_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lumina-gh-icon-btn"
          aria-label={
            starBadge
              ? `Lumina on GitHub (${starBadge} stars)`
              : 'Lumina on GitHub'
          }
          title={
            starBadge
              ? `GitHub Repository · ${starBadge} stars`
              : 'GitHub Repository'
          }
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
          </svg>
          {starBadge ? (
            <span className="lumina-gh-star-badge" aria-hidden="true">
              {starBadge}
            </span>
          ) : null}
        </a>

        {/* Theme Switcher */}
        <button
          type="button"
          className="lumina-theme-btn"
          onClick={(e) => toggleTheme(e)}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>

        {/* Admin Dashboard / Login Button (hidden for regular non-admin users) */}
        {isAdmin ? (
          <button
            type="button"
            className="lumina-admin-header-btn"
            onClick={() => navigate(dashboardUrl)}
            title="Open Lumina Dashboard"
          >
            <SettingsIcon size={13} />
            <span>Dashboard</span>
          </button>
        ) : !isSignedIn ? (
          <button
            type="button"
            className="lumina-admin-header-btn is-icon-only"
            onClick={() => navigate(ROUTES.signIn)}
            aria-label="Admin sign in"
            title="Sign in"
          >
            <UserIcon size={14} />
          </button>
        ) : null}
      </div>
    </header>
  )
}
