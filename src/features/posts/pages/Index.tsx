import { useEffect, useState } from 'react'
import { Link, useQuery, useRouter } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { HeroPixelField } from '../../common/HeroPixelField'
import { Header } from '../../header/Header'
import { Feed } from '../components/Feed'

/**
 * The public Posts index (`/posts`).
 *
 * A searchable, paginated list of everything administrators have published.
 * Search is driven from the global header search (`?q=...`).
 */

export interface InsightsProps {
  /** Tag carried over from a card, e.g. `/posts?tag=revenue`. */
  initialTag?: string | null
  onSignIn?: () => void
  onSignUp?: () => void
}

export function Insights({ initialTag = null, onSignIn, onSignUp }: InsightsProps) {
  const { navigate } = useRouter()
  const query = useQuery()
  const urlTag = query.get('tag')
  const urlSearch = query.get('q')?.trim() ?? ''
  const [tag, setTag] = useState<string | null>(initialTag ?? urlTag)

  useEffect(() => {
    setTag(initialTag ?? urlTag)
  }, [initialTag, urlTag])

  return (
    <div className="shell-frame">
      <Header onSignIn={onSignIn} onSignUp={onSignUp} />

      <section className="insights-hero">
        <HeroPixelField />
        <div className="shell-container insights-hero-inner">
          <span className="landing-subhead">Posts</span>
          <h1 className="insights-title">Published Posts</h1>
          <p className="insights-subtitle">
            Published analyses from the Lumina Tabula workspace — every table, chart, and diagram
            preserved as it was produced.
          </p>
          {tag ? (
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => setTag(null)}
              >
                Tag: “{tag}” ×
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <main className="insights-body">
        <div className="shell-container">
          <Feed
            limit={12}
            tag={tag}
            search={urlSearch || null}
            paginate
            onClearFilters={() => {
              setTag(null)
              if (urlSearch) navigate(ROUTES.posts)
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
