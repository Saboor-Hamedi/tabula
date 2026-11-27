import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import { useAuthUser, useIsAdmin, useUserSlug } from '../../auth/useProfile'
import {
  ArrowRightIcon,
  CloseIcon,
  SearchIcon,
  SettingsIcon,
  SidebarIcon,
  UserIcon,
} from '../../common/Icons'
import { searchLuminaDocsInDb, type LuminaDocRecord } from '../api/docs'
import { listLuminaPosts, type LuminaPost } from '../api/posts'
import {
  formatStarCount,
  LUMINA_REPO_URL,
  type LuminaReleaseInfo,
} from '../api/release'
import { docSlugToPath, LUMINA_DOC_PAGES } from '../content'
import { HeartIcon } from './DonationModal'

export interface HeaderProps {
  release: LuminaReleaseInfo
  dbDocsMap?: Record<string, LuminaDocRecord>
  onToggleMobileNav: () => void
  onOpenDonate: () => void
}

interface SearchSuggestionItem {
  id: string
  title: string
  desc: string
  badge: string
  path: string
}

export function Header({
  release,
  dbDocsMap = {},
  onToggleMobileNav,
  onOpenDonate,
}: HeaderProps) {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const isAdmin = useIsAdmin()
  const userSlug = useUserSlug()

  const isSignedIn = Boolean(user && !user.is_anonymous)

  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dbDocMatches, setDbDocMatches] = useState<LuminaDocRecord[]>([])
  const [dbPostMatches, setDbPostMatches] = useState<LuminaPost[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        window.setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 10)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    const q = value.trim()
    if (!open || q.length === 0) {
      setDbDocMatches([])
      setDbPostMatches([])
      setLoading(false)
      setActiveIndex(-1)
      return
    }

    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      Promise.all([
        searchLuminaDocsInDb(q),
        listLuminaPosts({ search: q, includeDrafts: isAdmin }),
      ])
        .then(([docs, posts]) => {
          if (!active) return
          setDbDocMatches(docs)
          setDbPostMatches(posts.slice(0, 5))
          setActiveIndex(-1)
        })
        .catch(() => {
          if (!active) return
          setDbDocMatches([])
          setDbPostMatches([])
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 140)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [value, open, isAdmin])

  const suggestions = useMemo<SearchSuggestionItem[]>(() => {
    const q = value.trim().toLowerCase()
    const items: SearchSuggestionItem[] = []
    const seenPaths = new Set<string>()

    const addItem = (item: SearchSuggestionItem) => {
      if (seenPaths.has(item.path)) return
      seenPaths.add(item.path)
      items.push(item)
    }

    if (!q) {
      for (const doc of Object.values(dbDocsMap)) {
        if (!doc?.slug) continue
        addItem({
          id: `doc-${doc.slug}`,
          title: doc.title,
          desc: doc.subtitle || doc.summary || 'Documentation page',
          badge: doc.section,
          path: docSlugToPath(doc.slug),
        })
      }
      for (const page of LUMINA_DOC_PAGES) {
        addItem({
          id: `base-${page.slug}`,
          title: page.title,
          desc: page.subtitle || page.summary || 'Documentation section',
          badge: page.section,
          path: page.path,
        })
      }
      return items.slice(0, 6)
    }

    for (const row of dbDocMatches) {
      addItem({
        id: `dbdoc-${row.slug}`,
        title: row.title,
        desc: row.subtitle || row.summary || 'Documentation page',
        badge: row.section,
        path: docSlugToPath(row.slug),
      })
    }

    for (const doc of Object.values(dbDocsMap)) {
      if (!doc?.slug) continue
      if (
        doc.title.toLowerCase().includes(q) ||
        (doc.subtitle && doc.subtitle.toLowerCase().includes(q)) ||
        doc.content.toLowerCase().includes(q)
      ) {
        addItem({
          id: `mapdoc-${doc.slug}`,
          title: doc.title,
          desc: doc.subtitle || doc.summary || 'Documentation page',
          badge: doc.section,
          path: docSlugToPath(doc.slug),
        })
      }
    }

    for (const page of LUMINA_DOC_PAGES) {
      if (
        page.title.toLowerCase().includes(q) ||
        page.subtitle.toLowerCase().includes(q) ||
        page.content.toLowerCase().includes(q) ||
        page.section.toLowerCase().includes(q)
      ) {
        addItem({
          id: `static-${page.slug}`,
          title: page.title,
          desc: page.subtitle || page.summary || 'Documentation page',
          badge: page.section,
          path: page.path,
        })
      }
    }

    for (const post of dbPostMatches) {
      addItem({
        id: `post-${post.id}`,
        title: post.title,
        desc: post.summary || `${post.category} post`,
        badge: post.category,
        path: `/lumina/posts/${post.slug}`,
      })
    }

    return items.slice(0, 7)
  }, [value, dbDocsMap, dbDocMatches, dbPostMatches])

  const selectResult = (path: string) => {
    setOpen(false)
    setValue('')
    setActiveIndex(-1)
    navigate(path)
  }

  const handleClear = () => {
    setValue('')
    setActiveIndex(-1)
    searchInputRef.current?.focus()
  }

  const starBadge = formatStarCount(release.stars ?? (release.loading ? null : 0))
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
          <SidebarIcon size={15} />
        </button>

        <Link to="/lumina" className="lumina-brand">
          <span className="lumina-brand-text">Lumina</span>
        </Link>
      </div>

      {/* Transparent Search Input & Glass Dropdown matching Lumina Tabula */}
      <div className="lumina-topbar-center" ref={searchWrapRef}>
        <form
          className={`hero-search-box lumina-hero-search-box ${open ? 'is-open' : ''}`}
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            if (activeIndex >= 0 && suggestions[activeIndex]) {
              selectResult(suggestions[activeIndex].path)
              return
            }
            if (suggestions.length > 0) {
              selectResult(suggestions[0].path)
            }
          }}
        >
          <span className="hero-search-icon" aria-hidden="true">
            <SearchIcon size={14} />
          </span>

          <input
            ref={searchInputRef}
            type="search"
            className="hero-search-input"
            value={value}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setValue(event.target.value)
              if (!open) setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false)
                return
              }
              if (suggestions.length === 0) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((prev) => (prev + 1) % suggestions.length)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
              }
            }}
            placeholder="Search Lumina docs, shortcuts & posts…"
            aria-label="Search Lumina documentation and posts"
            autoComplete="off"
            spellCheck={false}
          />

          {value.length > 0 ? (
            <button
              type="button"
              className="hero-search-clear"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <CloseIcon size={12} />
            </button>
          ) : (
            <kbd className="hero-search-kbd" aria-hidden="true">
              Ctrl K
            </kbd>
          )}
        </form>

        {open ? (
          <div className="hero-search-dropdown lumina-hero-search-dropdown" role="listbox" aria-label="Lumina search suggestions">
            {loading && value.trim().length > 0 ? (
              <div className="hero-search-empty">Searching Lumina…</div>
            ) : suggestions.length === 0 ? (
              <div className="hero-search-empty">
                No documentation or posts match “{value.trim()}”
              </div>
            ) : (
              <ul className="hero-search-list">
                {suggestions.map((item, idx) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={`hero-search-item ${idx === activeIndex ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectResult(item.path)}
                    >
                      <div className="hero-search-item-main">
                        <div className="lumina-search-item-head">
                          <span className="hero-search-item-title">{item.title}</span>
                          <span className="lumina-search-result-section">{item.badge}</span>
                        </div>
                        {item.desc ? (
                          <p className="hero-search-item-desc">{item.desc}</p>
                        ) : null}
                      </div>
                      <span className="hero-search-item-arrow" aria-hidden="true">
                        <ArrowRightIcon size={12} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="hero-search-footer"
              onClick={() => selectResult('/lumina/posts')}
            >
              <span>Browse all Lumina release updates &amp; posts</span>
              <ArrowRightIcon size={13} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="lumina-topbar-right">
        {/* Compact Donate Button */}
        <button
          type="button"
          className="lumina-donate-header-btn"
          onClick={onOpenDonate}
          title="Support Lumina via PayPal"
        >
          <HeartIcon size={11} />
          <span>Donate</span>
        </button>

        {/* Compact GitHub Icon-Only Button with Star Notification Badge */}
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
          </svg>
          {starBadge !== null ? (
            <span className="lumina-gh-star-badge" aria-hidden="true">
              {starBadge}
            </span>
          ) : null}
        </a>

        {/* Compact Admin Dashboard / Login Button (hidden for regular non-admin users) */}
        {isAdmin ? (
          <button
            type="button"
            className="lumina-admin-header-btn"
            onClick={() => navigate(dashboardUrl)}
            title="Open Lumina Dashboard"
          >
            <SettingsIcon size={11} />
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
            <UserIcon size={12} />
          </button>
        ) : null}
      </div>
    </header>
  )
}
