import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useRouter } from '../../../core/router'
import { postPath, ROUTES } from '../../../core/router/paths'
import { useIsAdmin } from '../../auth/useProfile'
import { HeroPixelField } from '../../common/HeroPixelField'
import { FileIcon, PlusIcon, SearchIcon, CloseIcon } from '../../common/Icons'
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
  const [searchInput, setSearchInput] = useState(urlSearch)
  const [creatingPost, setCreatingPost] = useState(false)

  useEffect(() => {
    setTag(initialTag ?? urlTag)
  }, [initialTag, urlTag])

  useEffect(() => {
    setSearchInput(urlSearch)
  }, [urlSearch])

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()
    const clean = searchInput.trim()
    const params = new URLSearchParams()
    if (clean) params.set('q', clean)
    if (tag) params.set('tag', tag)
    const qs = params.toString()
    navigate(qs ? `${ROUTES.posts}?${qs}` : ROUTES.posts)
  }

  return (
    <div className="shell-frame">
      <Header onSignIn={onSignIn} onSignUp={onSignUp} />

      <section className="subpage-hero">
        <div className="hero-ledger-grid" aria-hidden="true" />
        <HeroPixelField />
        <div className="subpage-hero-inner">
          <span className="subpage-hero-kicker">
            <FileIcon size={12} />
            <span>Published Posts</span>
          </span>
          <h1 className="subpage-hero-title">
            Data stories &amp;{' '}
            <span className="landing-hero-serif">research reports.</span>
          </h1>
          <p className="subpage-hero-subtitle">
            Published analyses from the Lumina Tabula workspace — every SQL table, chart, and
            diagram preserved as it was produced.
          </p>

          <form className="subpage-hero-search" onSubmit={handleSearchSubmit} role="search">
            <SearchIcon size={15} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search published posts, datasets, or topics…"
              aria-label="Search published posts"
            />
            {searchInput ? (
              <button
                type="button"
                className="subpage-hero-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchInput('')
                  if (urlSearch) navigate(ROUTES.posts)
                }}
              >
                <CloseIcon size={12} />
              </button>
            ) : null}
            <button type="submit" className="subpage-hero-search-btn">
              Search
            </button>
          </form>

          {isAdmin || tag || urlSearch ? (
            <div className="subpage-hero-actions">
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
              {urlSearch ? (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    setSearchInput('')
                    navigate(ROUTES.posts)
                  }}
                >
                  Clear “{urlSearch}” ×
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
