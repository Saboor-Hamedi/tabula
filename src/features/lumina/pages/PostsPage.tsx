import { useEffect, useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { SearchIcon } from '../../common/Icons'
import {
  listLuminaPosts,
  type LuminaPost,
  type LuminaPostCategory,
} from '../api/posts'
import { useLuminaRelease } from '../api/release'
import { PostModal } from '../components/PostModal'
import { Shell } from '../components/Shell'

const CATEGORIES: Array<LuminaPostCategory | 'All'> = [
  'All',
  'Release',
  'Guide',
  'Feature',
  'Announcement',
]

export function formatLuminaDate(iso: string | null | undefined): string {
  if (!iso) return 'Recently'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recently'
  }
}

export function PostsPage({ openCreateInitially = false }: { openCreateInitially?: boolean }) {
  const { navigate } = useRouter()
  const isAdmin = useIsAdmin()
  const release = useLuminaRelease()
  const [posts, setPosts] = useState<LuminaPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<LuminaPostCategory | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingPost, setCreatingPost] = useState(openCreateInitially)

  useEffect(() => {
    setCreatingPost(openCreateInitially)
  }, [openCreateInitially])

  useEffect(() => {
    let active = true
    setLoading(true)
    listLuminaPosts({
      category: activeCategory,
      includeDrafts: isAdmin,
      search: searchQuery,
    })
      .then((rows) => {
        if (active) setPosts(rows)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeCategory, isAdmin, searchQuery])

  return (
    <Shell
      release={release}
      onPostCreated={(created) => {
        setPosts((prev) => [created, ...prev])
      }}
    >
      <div className="lumina-doc-article">
        <header className="lumina-doc-header">
          <div className="lumina-doc-header-top">
            <span className="lumina-doc-kicker">Prologue · Changelogs &amp; Guides</span>
          </div>
          <h1 className="lumina-doc-title">Release Updates &amp; Posts</h1>
          <p className="lumina-doc-subtitle">
            Official release notes, engineering guides, feature spotlights, and announcements for the Lumina desktop workspace.
          </p>
        </header>

        <div className="lumina-posts-controls">
          <div className="lumina-posts-categories" role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`lumina-cat-pill ${activeCategory === cat ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="lumina-posts-search-wrap">
            <SearchIcon size={13} />
            <input
              type="search"
              className="lumina-posts-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Lumina posts…"
              aria-label="Search Lumina posts"
            />
          </div>
        </div>

        {loading ? (
          <div className="lumina-empty-card">Loading Lumina posts…</div>
        ) : posts.length === 0 ? (
          <div className="lumina-empty-card">
            <h3>No posts published yet</h3>
            <p>
              {isAdmin
                ? 'Use the floating + button at the bottom right (or the Lumina tab in your Dashboard) to publish your first release update or guide.'
                : 'Release updates, guides, and announcements will appear here once published.'}
            </p>
          </div>
        ) : (
          <div className="lumina-posts-list">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/lumina/posts/${post.slug}`}
                className="lumina-post-card"
              >
                <div className="lumina-post-card-top">
                  <div className="lumina-post-meta-bar">
                    <span className={`lumina-post-cat-badge is-${post.category.toLowerCase()}`}>
                      {post.category}
                    </span>
                    {post.version ? (
                      <span className="lumina-post-ver-badge">
                        {post.version.startsWith('v') ? post.version : `v${post.version}`}
                      </span>
                    ) : null}
                    {post.status !== 'published' ? (
                      <span className="lumina-post-draft-badge">{post.status}</span>
                    ) : null}
                  </div>
                  <span className="lumina-post-date">
                    {formatLuminaDate(post.published_at || post.created_at)}
                  </span>
                </div>

                <h2 className="lumina-post-card-title">{post.title}</h2>
                {post.summary ? (
                  <p className="lumina-post-card-summary">{post.summary}</p>
                ) : null}

                <div className="lumina-post-card-foot">
                  <span className="lumina-post-author">By {post.author_name}</span>
                  <span className="lumina-post-readmore">
                    Read article ({post.reading_time_minutes} min) →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {creatingPost ? (
        <PostModal
          mode="create"
          defaultVersion={release.version}
          onClose={() => {
            setCreatingPost(false)
            if (openCreateInitially) navigate('/lumina/posts')
          }}
          onSaved={(created) => {
            setPosts((prev) => [created, ...prev])
            navigate(`/lumina/posts/${created.slug}`)
          }}
        />
      ) : null}
    </Shell>
  )
}
