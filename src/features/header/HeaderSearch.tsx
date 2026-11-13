import { useEffect, useRef, useState } from 'react'
import { useQuery, useRouter } from '../../core/router'
import { ROUTES, postPath } from '../../core/router/paths'
import { isSupabaseConfigured } from '../../core/supabase/client'
import type { PostSummary } from '../../core/supabase/types'
import { ArrowRightIcon, CloseIcon, SearchIcon } from '../common/Icons'
import { listPublishedPostsPage } from '../posts/api'

/**
 * Global header post search with Ctrl+K / Cmd+K focus and live trigram
 * auto-suggestions.
 */
export function HeaderSearch() {
  const { navigate } = useRouter()
  const query = useQuery()
  const urlQuery = query.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PostSummary[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(urlQuery)
  }, [urlQuery])

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Debounced live trigram suggestions
  useEffect(() => {
    const term = value.trim()
    if (!open || term.length === 0 || !isSupabaseConfigured) {
      setSuggestions([])
      setLoading(false)
      setActiveIndex(-1)
      return
    }

    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      void listPublishedPostsPage({ search: term, limit: 6, offset: 0 })
        .then((res) => {
          if (!active) return
          setSuggestions(res.posts)
          setActiveIndex(-1)
        })
        .catch(() => {
          if (active) setSuggestions([])
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 160)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [value, open])

  const submitSearch = (term: string) => {
    const cleaned = term.trim()
    setOpen(false)
    if (cleaned.length > 0) {
      navigate(`${ROUTES.posts}?q=${encodeURIComponent(cleaned)}`)
    } else {
      navigate(ROUTES.posts)
    }
  }

  const openPost = (slug: string) => {
    setOpen(false)
    navigate(postPath(slug))
  }

  const handleClear = () => {
    setValue('')
    setSuggestions([])
    setActiveIndex(-1)
    inputRef.current?.focus()
    if (urlQuery.length > 0) {
      navigate(ROUTES.posts)
    }
  }

  const showDropdown = open && value.trim().length > 0

  return (
    <div className="header-search-wrap" ref={wrapRef}>
      <form
        className={`header-search${open ? ' is-open' : ''}`}
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (activeIndex >= 0 && suggestions[activeIndex]) {
            openPost(suggestions[activeIndex].slug)
            return
          }
          submitSearch(value)
        }}
      >
        <SearchIcon size={14} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setValue(event.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              inputRef.current?.blur()
              return
            }
            if (!showDropdown || suggestions.length === 0) return
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((prev) => (prev + 1) % suggestions.length)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
            }
          }}
          placeholder="Search posts…"
          aria-label="Search posts"
          autoComplete="off"
          spellCheck={false}
        />
        {value.length > 0 ? (
          <button
            type="button"
            className="header-search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <CloseIcon size={12} />
          </button>
        ) : (
          <kbd className="header-search-kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        )}
      </form>

      {showDropdown ? (
        <div className="header-search-dropdown" role="listbox" aria-label="Search suggestions">
          {loading ? (
            <div className="header-search-empty">Searching…</div>
          ) : suggestions.length === 0 ? (
            <div className="header-search-empty">
              No matching posts for “{value.trim()}”
            </div>
          ) : (
            <ul className="header-search-list">
              {suggestions.map((post, idx) => (
                <li key={post.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    className={`header-search-item${idx === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => openPost(post.slug)}
                  >
                    <div className="header-search-item-top">
                      <span className="header-search-item-title">{post.title}</span>
                      {post.dataset_name ? (
                        <span className="header-search-item-badge">{post.dataset_name}</span>
                      ) : null}
                    </div>
                    {post.excerpt || post.subtitle ? (
                      <p className="header-search-item-desc">
                        {post.excerpt || post.subtitle}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="header-search-footer"
            onClick={() => submitSearch(value)}
          >
            <span>See all results for “{value.trim()}”</span>
            <ArrowRightIcon size={13} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
