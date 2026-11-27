import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { PencilIcon } from '../../common/Icons'
import {
  deleteLuminaPost,
  fetchLuminaPostBySlug,
  incrementLuminaPostView,
  type LuminaPost,
} from '../api/posts'
import { useLuminaRelease } from '../api/release'
import { extractDocHeadings, Markdown } from '../components/Markdown'
import { PostModal } from '../components/PostModal'
import { Shell } from '../components/Shell'
import { formatLuminaDate } from './PostsPage'

export function ArticlePage() {
  const { navigate } = useRouter()
  const params = useParams()
  const slugParam = params.slug
  const isAdmin = useIsAdmin()
  const release = useLuminaRelease()
  const [post, setPost] = useState<LuminaPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!slugParam) return
    let active = true
    setLoading(true)
    fetchLuminaPostBySlug(slugParam)
      .then((found) => {
        if (active) {
          setPost(found)
          if (found) void incrementLuminaPostView(found.slug)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slugParam])

  const headings = useMemo(
    () => (post ? extractDocHeadings(post.content) : []),
    [post],
  )

  return (
    <Shell release={release} headings={headings}>
      <article className="lumina-doc-article">
        <div className="lumina-post-back-row">
          <Link to="/lumina/posts" className="lumina-back-pill">
            ← All Release Updates &amp; Posts
          </Link>
          {isAdmin && post ? (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setEditing(true)}
            >
              <PencilIcon size={12} />
              <span>Update Post</span>
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="lumina-empty-card">Loading article…</div>
        ) : !post ? (
          <div className="lumina-empty-card">
            <h3>Post not found</h3>
            <p>No Lumina post matches the slug “{slugParam}”.</p>
            <Link to="/lumina/posts" className="btn btn-small btn-primary" style={{ marginTop: 12 }}>
              Return to Lumina Posts
            </Link>
          </div>
        ) : (
          <>
            <header className="lumina-doc-header">
              <div className="lumina-post-meta-bar" style={{ marginBottom: 10 }}>
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
                <span className="lumina-post-date">
                  {formatLuminaDate(post.published_at || post.created_at)}
                </span>
                <span className="lumina-post-readtime">
                  · {post.reading_time_minutes} min read
                </span>
              </div>
              <h1 className="lumina-doc-title">{post.title}</h1>
              {post.summary ? <p className="lumina-doc-subtitle">{post.summary}</p> : null}
            </header>

            <Markdown content={post.content} />
          </>
        )}
      </article>

      {editing && post ? (
        <PostModal
          mode="update"
          post={post}
          defaultVersion={release.version}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setPost(updated)
            if (updated.slug !== post.slug) {
              navigate(`/lumina/posts/${updated.slug}`)
            }
          }}
          onDelete={async (toDelete) => {
            await deleteLuminaPost(toDelete.id)
            navigate('/lumina/posts')
          }}
        />
      ) : null}
    </Shell>
  )
}
