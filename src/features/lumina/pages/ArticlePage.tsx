import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { PencilIcon } from '../../common/Icons'
import {
  deleteLuminaPost,
  fetchLuminaPostBySlug,
  incrementLuminaPostView,
  listLuminaPostChildren,
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
  const [ancestors, setAncestors] = useState<LuminaPost[]>([])
  const [childPosts, setChildPosts] = useState<LuminaPost[]>([])
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

  const parentSlug = post?.parent_slug ?? null

  useEffect(() => {
    if (!parentSlug) return
    let active = true
    void (async () => {
      const chain: LuminaPost[] = []
      const seen = new Set<string>()
      let cursor: string | null = parentSlug
      while (cursor && !seen.has(cursor) && chain.length < 6) {
        seen.add(cursor)
        const found = await fetchLuminaPostBySlug(cursor)
        if (!found) break
        chain.unshift(found)
        cursor = found.parent_slug
      }
      if (active) setAncestors(chain)
    })()
    return () => {
      active = false
    }
  }, [parentSlug])

  const resolvedAncestors = parentSlug ? ancestors : []
  const articleSlug = post?.slug ?? null

  useEffect(() => {
    if (!articleSlug) return
    let active = true
    listLuminaPostChildren(articleSlug).then((rows) => {
      if (active) setChildPosts(rows)
    })
    return () => {
      active = false
    }
  }, [articleSlug])

  const headings = useMemo(
    () => (post ? extractDocHeadings(post.content) : []),
    [post],
  )

  return (
    <Shell release={release} headings={headings}>
      <article className="lumina-doc-article">
        <div className="lumina-post-back-row">
          <div className="lumina-post-back-left">
            {post ? (
              <nav className="lumina-post-breadcrumb" aria-label="Breadcrumb">
                <Link to="/lumina">Overview</Link>
                <span className="lumina-post-breadcrumb-step">
                  <span className="lumina-post-breadcrumb-sep">/</span>
                  <Link to="/lumina/posts">{post.category}</Link>
                </span>
                {resolvedAncestors.map((ancestor) => (
                  <span key={ancestor.id} className="lumina-post-breadcrumb-step">
                    <span className="lumina-post-breadcrumb-sep">/</span>
                    <Link to={`/lumina/posts/${ancestor.slug}`}>{ancestor.title}</Link>
                  </span>
                ))}
                <span className="lumina-post-breadcrumb-step">
                  <span className="lumina-post-breadcrumb-sep">/</span>
                  <span className="is-current">{post.title}</span>
                </span>
              </nav>
            ) : (
              <Link to="/lumina/posts" className="lumina-back-pill">
                ← All Release Updates &amp; Posts
              </Link>
            )}
          </div>
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
                {post.parent_slug ? (
                  <span className="lumina-post-sub-badge">↳ Sub-topic</span>
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

            {childPosts.length > 0 ? (
              <section className="lumina-post-children-section" aria-label="Sub-topics">
                <h2 className="lumina-doc-h2">Sub-topics in this series</h2>
                <ol className="lumina-post-children-list">
                  {childPosts.map((child) => (
                    <li key={child.id}>
                      <Link to={`/lumina/posts/${child.slug}`}>
                        <span className="lumina-post-child-title">{child.title}</span>
                        <span className="lumina-post-child-meta">
                          {child.reading_time_minutes} min read ·{' '}
                          {formatLuminaDate(child.published_at || child.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
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
          onDelete={async (toDelete, options) => {
            await deleteLuminaPost(toDelete.id, { cascade: options?.cascade ?? false })
            navigate('/lumina/posts')
          }}
        />
      ) : null}
    </Shell>
  )
}
