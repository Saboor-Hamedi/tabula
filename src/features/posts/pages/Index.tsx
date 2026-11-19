import { useEffect, useState } from 'react'
import { useQuery, useRouter } from '../../../core/router'
import { postPath, ROUTES } from '../../../core/router/paths'
import { useIsAdmin } from '../../auth/useProfile'
import { HeroPixelField } from '../../common/HeroPixelField'
import { PlusIcon } from '../../common/Icons'
import { Header } from '../../header/Header'
import { Footer } from '../../landing/components/Footer'
import { Feed } from '../components/Feed'
import { PostEditModal } from '../components/PostEditModal'

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
  const isAdmin = useIsAdmin()
  const query = useQuery()
  const urlTag = query.get('tag')
  const urlSearch = query.get('q')?.trim() ?? ''
  const [tag, setTag] = useState<string | null>(initialTag ?? urlTag)
  const [creatingPost, setCreatingPost] = useState(false)

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
          {isAdmin || tag ? (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {isAdmin ? (
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  onClick={() => setCreatingPost(true)}
                >
                  <PlusIcon size={12} />
                  <span>Create Post</span>
                </button>
              ) : null}
              {tag ? (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => setTag(null)}
                >
                  Tag: “{tag}” ×
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <main className="insights-body" style={{ flex: 1 }}>
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

      {creatingPost && isAdmin ? (
        <PostEditModal
          mode="create"
          onClose={() => setCreatingPost(false)}
          onCreated={(created) => {
            navigate(postPath(created.slug))
          }}
        />
      ) : null}

      <Footer />
    </div>
  )
}
