import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '../../../core/router'
import { ROUTES, postPath } from '../../../core/router/paths'
import { formatCount } from '../../../core/utils/format'
import type { Post, PostStatus } from '../../../core/supabase/types'
import { CheckIcon, ExternalIcon, SearchIcon, TrashIcon } from '../../common/Icons'
import { IconButton } from '../../common/IconButton'
import { Pagination } from '../../common/Pagination'
import { deletePost, listAllPosts, setPostStatus } from '../../posts'

type StatusFilter = 'all' | PostStatus

function formatShortDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Organized Posts panel in the Dashboard with status tabs, search,
 * and pagination.
 */
export function Insights() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const load = useCallback(async () => {
    try {
      const rows = await listAllPosts()
      setPosts(rows)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Posts could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    const initial = async () => {
      try {
        const rows = await listAllPosts()
        if (!active) return
        setPosts(rows)
      } catch (loadError) {
        if (!active) return
        setError(
          loadError instanceof Error ? loadError.message : 'Posts could not be loaded.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void initial()
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(() => {
    let published = 0
    let draft = 0
    let archived = 0
    for (const post of posts) {
      if (post.status === 'published') published += 1
      else if (post.status === 'draft') draft += 1
      else archived += 1
    }
    return { all: posts.length, published, draft, archived }
  }, [posts])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return posts.filter((post) => {
      if (statusFilter !== 'all' && post.status !== statusFilter) return false
      if (!term) return true
      return [post.title, post.subtitle, post.excerpt, post.dataset_name, ...post.tags]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    })
  }, [posts, statusFilter, query])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, query, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedPosts = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const change = async (post: Post, publish: boolean) => {
    setBusyId(post.id)
    try {
      await setPostStatus(post.id, publish ? 'published' : 'archived')
      await load()
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'The change failed.')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (post: Post) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return
    setBusyId(post.id)
    try {
      await deletePost(post.id)
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The delete failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="dash-panel">
      <header className="dash-panel-head">
        <div>
          <h2 className="dash-section-title">Posts</h2>
          <span className="dash-panel-note">
            Organize, publish, archive, and review all workspace posts.
          </span>
        </div>
        <Link className="dash-panel-link" to={ROUTES.posts}>
          View public posts
          <ExternalIcon size={12} />
        </Link>
      </header>

      <div className="dash-table-tools dash-posts-tools">
        <div className="dash-filter-tabs" role="tablist" aria-label="Filter posts by status">
          {(
            [
              { id: 'all', label: 'All', count: counts.all },
              { id: 'published', label: 'Live', count: counts.published },
              { id: 'draft', label: 'Drafts', count: counts.draft },
              { id: 'archived', label: 'Archived', count: counts.archived },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === item.id}
              className={`dash-filter-tab ${statusFilter === item.id ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(item.id)}
            >
              <span>{item.label}</span>
              <span className="dash-filter-count">{formatCount(item.count)}</span>
            </button>
          ))}
        </div>

        <div className="dash-table-search">
          <SearchIcon size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search posts…"
            aria-label="Search dashboard posts"
          />
        </div>
      </div>

      {error ? <p className="publish-error">{error}</p> : null}

      {loading ? (
        <p className="dash-table-empty">Loading posts…</p>
      ) : filtered.length === 0 ? (
        <p className="dash-table-empty">
          {posts.length === 0
            ? 'Nothing published yet. Publish an answer from the workspace and it appears here.'
            : 'No posts match your filter or search.'}
        </p>
      ) : (
        <>
          <ul className="dash-insight-list">
            {pagedPosts.map((post) => (
              <li className="dash-insight" key={post.id}>
                <div className="dash-insight-main">
                  <div className="dash-insight-top">
                    <span className={`dash-status is-${post.status}`}>
                      {post.status === 'published' ? 'Live' : post.status}
                    </span>
                    <Link className="dash-insight-title" to={postPath(post.slug)}>
                      {post.title}
                    </Link>
                  </div>

                  <div className="dash-insight-meta">
                    <span>{formatCount(post.view_count)} views</span>
                    <span>·</span>
                    <span>{post.reading_time_minutes} min read</span>
                    <span>·</span>
                    <span>{formatShortDate(post.published_at ?? post.created_at)}</span>
                    {post.dataset_name ? (
                      <>
                        <span>·</span>
                        <span>{post.dataset_name}</span>
                      </>
                    ) : null}
                  </div>

                  {post.tags.length > 0 ? (
                    <div className="dash-insight-tags">
                      {post.tags.slice(0, 4).map((tag) => (
                        <span className="dash-insight-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="dash-insight-actions">
                  {post.status === 'published' ? (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={busyId === post.id}
                      onClick={() => void change(post, false)}
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small btn-primary"
                      disabled={busyId === post.id}
                      onClick={() => void change(post, true)}
                    >
                      <CheckIcon size={12} />
                      Publish
                    </button>
                  )}
                  <Link className="btn btn-small" to={postPath(post.slug)}>
                    View
                  </Link>
                  <IconButton
                    label="Delete post"
                    size="sm"
                    onClick={() => void remove(post)}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={safePage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[8, 15, 30]}
            itemLabel="posts"
          />
        </>
      )}
    </section>
  )
}
