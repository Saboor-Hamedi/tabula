import { useEffect, useState } from 'react'
import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { ArrowRightIcon, CloseIcon, SearchIcon } from '../../common/Icons'
import { Feed } from '../../posts'

/**
 * The public Posts section on the front page.
 *
 * Brings the searchable, paginated list of published posts right onto the
 * landing page so visitors can search and read analyses immediately.
 */

export function Insights() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 220)
    return () => window.clearTimeout(timer)
  }, [search])

  return (
    <section id="posts" className="landing-section landing-insights">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-subhead">Posts</span>
          <h2 className="landing-section-title">Published Posts From The Workspace</h2>
          <p className="landing-section-desc">
            Search published analyses, summary tables, charts, and diagrams directly from Tabula.
          </p>

          <form
            className="insights-search"
            onSubmit={(event) => {
              event.preventDefault()
              setDebouncedSearch(search.trim())
            }}
          >
            <SearchIcon size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts by title, topic, or dataset…"
              aria-label="Search posts"
            />
            {search.trim().length > 0 ? (
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => {
                  setSearch('')
                  setDebouncedSearch('')
                }}
                aria-label="Clear post search"
              >
                <CloseIcon size={13} />
              </button>
            ) : null}
            <button type="submit" className="btn btn-small btn-primary">
              Search
            </button>
          </form>
        </div>

        <Feed
          limit={6}
          search={debouncedSearch || null}
          paginate
          onClearFilters={() => {
            setSearch('')
            setDebouncedSearch('')
          }}
        />

        <div className="landing-insights-cta">
          <Link className="landing-cta-btn landing-cta-secondary" to={ROUTES.posts}>
            <span>Browse all posts</span>
            <ArrowRightIcon size={13} />
          </Link>
        </div>
      </div>
    </section>
  )
}
