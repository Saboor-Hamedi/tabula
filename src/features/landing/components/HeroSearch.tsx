import { useEffect, useRef, useState } from 'react'
import { useRouter } from '../../../core/router'
import { ROUTES, postPath } from '../../../core/router/paths'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import type { PostSummary } from '../../../core/supabase/types'
import { ArrowRightIcon, CloseIcon, SearchIcon } from '../../common/Icons'
import { listPublishedPostsPage } from '../../posts/api'

export function HeroSearch() {
  const { navigate } = useRouter()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PostSummary[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
        window.setTimeout(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }, 10)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Outside click to close
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

  // Debounced search query
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
      void listPublishedPostsPage({ search: term, limit: 5, offset: 0 })
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
    }, 150)

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
  }

  return (
    <div className="hero-search-wrapper hero-anim hero-anim-1" ref={wrapRef}>
      <form
        className={`hero-search-box ${open ? 'is-open' : ''}`}
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
        <span className="hero-search-icon" aria-hidden="true">
          <SearchIcon size={16} />
        </span>

        <input
          ref={inputRef}
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
          placeholder="Search published analyses, stories, or topics…"
          aria-label="Search published stories and topics"
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
            <CloseIcon size={13} />
          </button>
        ) : (
          <kbd className="hero-search-kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        )}
      </form>

      {/* Live Suggestions Dropdown */}
      {open && value.trim().length > 0 ? (
        <div className="hero-search-dropdown" role="listbox" aria-label="Search suggestions">
          {loading ? (
            <div className="hero-search-empty">Searching insights…</div>
          ) : suggestions.length === 0 ? (
            <div className="hero-search-empty">
              No published stories match “{value.trim()}”
            </div>
          ) : (
            <ul className="hero-search-list">
              {suggestions.map((post, idx) => (
                <li key={post.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    className={`hero-search-item ${idx === activeIndex ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => openPost(post.slug)}
                  >
                    <div className="hero-search-item-main">
                      <span className="hero-search-item-title">{post.title}</span>
                      {post.excerpt || post.subtitle ? (
                        <p className="hero-search-item-desc">
                          {post.excerpt || post.subtitle}
                        </p>
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
            onClick={() => submitSearch(value)}
          >
            <span>Explore all results for “{value.trim()}”</span>
            <ArrowRightIcon size={13} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
