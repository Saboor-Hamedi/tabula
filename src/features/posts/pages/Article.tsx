import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useRouter } from '../../../core/router'
import { ROUTES, postsPath } from '../../../core/router/paths'
import type { Post, PostImage } from '../../../core/supabase/types'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import { formatCount } from '../../../core/utils/format'
import { useIsAdmin } from '../../auth/useProfile'
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  PencilIcon,
  ShareIcon,
  TrashIcon,
} from '../../common/Icons'
import { Header } from '../../header/Header'
import { Footer } from '../../landing/components/Footer'
import {
  deletePost,
  fetchPostBySlug,
  incrementPostView,
  setPostStatus,
} from '../api'
import { Content } from '../components/Content'
import { PostEditModal } from '../components/PostEditModal'
import { resolveFullPostTitle } from '../lib'

/**
 * A published insight, read the way an article should read.
 *
 * The page works without a session: PostgREST serves published posts to
 * anonymous visitors, and the view counter is bumped through a SECURITY
 * DEFINER function so no write access is ever handed to a visitor.
 */

function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function Article() {
  const { slug = '' } = useParams()
  const { navigate } = useRouter()
  const isAdmin = useIsAdmin()
  const [post, setPost] = useState<Post | null>(null)
  const [images, setImages] = useState<PostImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [adminBusy, setAdminBusy] = useState<'status' | 'delete' | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!slug) {
        setLoading(false)
        setError('That post does not exist, or the link is incomplete.')
        return
      }

      if (!isSupabaseConfigured) {
        setLoading(false)
        setError('Posts are not available in this build.')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const detail = await fetchPostBySlug(slug)
        if (!active) return
        if (!detail) {
          setError('That post does not exist, or it is no longer published.')
          setPost(null)
          setImages([])
          return
        }
        setPost(detail.post)
        setImages(detail.images)
        void incrementPostView(detail.post.slug)
      } catch (loadError) {
        if (!active) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'The post could not be loaded.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [slug])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }, [])

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href
    const shareTitle = post?.title || 'Lumina Tabula'
    const shareText =
      post?.excerpt || post?.subtitle || post?.title || 'Private, in-browser data analysis.'
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await handleCopyLink()
  }, [post, handleCopyLink])

  useEffect(() => {
    if (!post) return
    const prevTitle = document.title
    const siteLogo = 'https://www.luminatabula.com/logo.png'
    const image = post.cover_image_url || images[0]?.url || siteLogo
    const desc =
      post.excerpt?.trim() ||
      post.subtitle?.trim() ||
      'Private, in-browser data analysis on Lumina Tabula.'
    const pageUrl = window.location.href

    document.title = `${post.title} — Lumina Tabula`

    const updates: Array<[string, string, string]> = [
      ['property', 'og:title', post.title],
      ['property', 'og:description', desc],
      ['property', 'og:image', image],
      ['property', 'og:url', pageUrl],
      ['name', 'twitter:title', post.title],
      ['name', 'twitter:description', desc],
      ['name', 'twitter:image', image],
    ]
    const previous = new Map<Element, string | null>()
    for (const [attr, key, value] of updates) {
      const el = document.querySelector(`meta[${attr}="${key}"]`)
      if (el) {
        previous.set(el, el.getAttribute('content'))
        el.setAttribute('content', value)
      }
    }

    return () => {
      document.title = prevTitle
      for (const [el, prev] of previous) {
        if (prev === null) el.removeAttribute('content')
        else el.setAttribute('content', prev)
      }
    }
  }, [post, images])

  const handleToggleStatus = useCallback(async () => {
    if (!post || !isAdmin || adminBusy) return
    const nextStatus = post.status === 'published' ? 'archived' : 'published'
    setAdminBusy('status')
    try {
      await setPostStatus(post.id, nextStatus)
      setPost((prev) => (prev ? { ...prev, status: nextStatus } : prev))
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Could not update the post status.',
      )
    } finally {
      setAdminBusy(null)
    }
  }, [post, isAdmin, adminBusy])

  const handlePerformDelete = useCallback(async () => {
    if (!post || !isAdmin || adminBusy) return
    setAdminBusy('delete')
    try {
      await deletePost(post.id)
      navigate(ROUTES.posts)
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Could not delete the post.',
      )
      setAdminBusy(null)
      setConfirmingDelete(false)
    }
  }, [post, isAdmin, adminBusy, navigate])

  return (
    <div className="shell-frame">
      <Header />

      <article className="post-page">
        <div className="post-article">
          {loading ? (
            <div className="post-article-skeleton">
              <div className="post-skeleton-line is-title" />
              <div className="post-skeleton-line" />
              <div className="post-skeleton-line is-short" />
              <div className="post-skeleton-block" />
            </div>
          ) : error || !post ? (
            <div className="post-empty">
              <p className="post-empty-title">Nothing to read here</p>
              <p className="post-empty-text">{error ?? 'This post is unavailable.'}</p>
              <Link className="btn" to={ROUTES.posts}>
                Back to posts
              </Link>
            </div>
          ) : (
            <>
              <header
                className={`post-article-header ${post.cover_image_url ? 'has-cover-img' : ''}`}
                style={
                  post.cover_image_url
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(10, 14, 18, 0.62) 0%, rgba(10, 14, 18, 0.86) 100%), url(${post.cover_image_url})`,
                      }
                    : undefined
                }
              >
                <div className="post-article-topbar">
                  <Link className="post-back" to={ROUTES.posts}>
                    <ArrowLeftIcon size={14} />
                    <span>All posts</span>
                  </Link>

                  <div className="post-article-actions">
                    {isAdmin ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-small post-banner-action-btn"
                          disabled={adminBusy !== null}
                          onClick={() => setEditing(true)}
                          title="Update post content"
                        >
                          <PencilIcon size={13} />
                          <span>Update</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-small post-banner-action-btn"
                          disabled={adminBusy !== null}
                          onClick={() => void handleToggleStatus()}
                        >
                          <span>
                            {adminBusy === 'status'
                              ? 'Saving…'
                              : post.status === 'published'
                                ? 'Unpublish'
                                : 'Publish'}
                          </span>
                        </button>
                        {confirmingDelete ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-small btn-danger"
                              disabled={adminBusy !== null}
                              onClick={() => void handlePerformDelete()}
                            >
                              <span>{adminBusy === 'delete' ? 'Removing…' : 'Confirm'}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-small post-banner-action-btn"
                              disabled={adminBusy !== null}
                              onClick={() => setConfirmingDelete(false)}
                            >
                              <span>Cancel</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-small btn-danger post-banner-icon-btn"
                            disabled={adminBusy !== null}
                            onClick={() => setConfirmingDelete(true)}
                            aria-label="Delete post"
                            title="Delete post"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-small post-banner-action-btn post-banner-icon-btn"
                      onClick={() => void handleShare()}
                      aria-label="Share post"
                      title="Share post"
                    >
                      <ShareIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-small post-banner-action-btn post-banner-icon-btn"
                      onClick={() => void handleCopyLink()}
                      aria-label={copied ? 'Link copied' : 'Copy link'}
                      title={copied ? 'Link copied' : 'Copy link'}
                    >
                      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    </button>
                  </div>
                </div>

                {post.tags.length > 0 ? (
                  <div className="post-card-tags">
                    {post.tags.map((tag) => (
                      <Link
                        className="post-tag"
                        to={postsPath(tag)}
                        key={tag}
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                ) : null}

                <h1 className="post-article-title">{resolveFullPostTitle(post)}</h1>
                {post.subtitle ? (
                  <p className="post-article-subtitle">{post.subtitle}</p>
                ) : null}

                <div className="post-fb-header-row">
                  <div className="post-fb-author-group">
                    {post.author_avatar_url ? (
                      <img className="post-avatar post-avatar-lg" src={post.author_avatar_url} alt="" />
                    ) : (
                      <span className="post-avatar post-avatar-lg is-fallback" aria-hidden>
                        {(post.author_name ?? 'T').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="post-fb-author-stack">
                      <span className="post-fb-author-name">
                        {post.author_name ?? 'Lumina Tabula'}
                      </span>
                      <div className="post-fb-date-row">
                        <span className="post-card-date">{formatDate(post.published_at)}</span>
                        <span className="post-dot" aria-hidden>
                          ·
                        </span>
                        <span>{post.reading_time_minutes} min read</span>
                        <span className="post-dot" aria-hidden>
                          ·
                        </span>
                        <span className="post-fb-views">
                          <EyeIcon size={12} />
                          <span>{formatCount(post.view_count)} views</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              <Content blocks={post.blocks} images={images} />

              <footer className="post-article-footer">
                <span>Made with Lumina Tabula — private data workbench.</span>
                <Link to={ROUTES.posts}>Browse all posts</Link>
              </footer>

              {editing && isAdmin ? (
                <PostEditModal
                  post={post}
                  onClose={() => setEditing(false)}
                  onUpdated={(updated) => setPost(updated)}
                  onDelete={async () => {
                    await handlePerformDelete()
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </article>
      <Footer />
    </div>
  )
}
