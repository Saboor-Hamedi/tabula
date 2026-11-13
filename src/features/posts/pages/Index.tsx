import { useEffect, useState } from 'react'
import { Link, useQuery } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { CloseIcon, SearchIcon } from '../../common/Icons'
import { Header } from '../../header/Header'
import { Feed } from '../components/Feed'

/**
 * The public Posts index (`/posts`).
 *
 * A searchable, paginated list of everything administrators have published.
 */

export interface InsightsProps {
  /** Tag carried over from a card, e.g. `/posts?tag=revenue`. */
  initialTag?: string | null
  onSignIn?: () => void
  onSignUp?: () => void
}

export function Insights({ initialTag = null, onSignIn, onSignUp }: InsightsProps) {
  const query = useQuery()
  const urlTag = query.get('tag')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tag, setTag] = useState<string | null>(initialTag ?? urlTag)

  useEffect(() => {
    setTag(initialTag ?? urlTag)
  }, [initialTag, urlTag])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 220)
    return () => window.clearTimeout(timer)
  }, [search])

  return (
    <div className="shell-frame">
      <Header onSignIn={onSignIn} onSignUp={onSignUp} />

      <section className="insights-hero">
        <div className="shell-container">
          <span className="landing-subhead">Posts</span>
          <h1 className="insights-title">Published Posts</h1>
          <p className="insights-subtitle">
            Published analyses from the Lumina Tabula workspace — every table, chart, and diagram
            preserved as it was produced.
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
                aria-label="Clear search"
              >
                <CloseIcon size={13} />
              </button>
            ) : null}
            <button type="submit" className="btn btn-small btn-primary">
              Search
            </button>
            {tag ? (
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => setTag(null)}
              >
                Tag: “{tag}” ×
              </button>
            ) : null}
          </form>
        </div>
      </section>

      <main className="insights-body">
        <div className="shell-container">
          <Feed
            limit={12}
            tag={tag}
            search={debouncedSearch || null}
            paginate
            onClearFilters={() => {
              setSearch('')
              setDebouncedSearch('')
              setTag(null)
            }}
          />
        </div>
      </main>

      <footer className="insights-footer">
        <div className="shell-container">
          <Link to={ROUTES.landing}>Back to home</Link>
        </div>
      </footer>
    </div>
  )
}
