import { useEffect, useState } from 'react'
import type { PostSummary } from '../../../core/supabase/types'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import { Pagination } from '../../common/Pagination'
import { Card } from './Card'
import { listPublishedPostsPage } from '../api'

/**
 * The public feed of published posts.
 *
 * Reads through PostgREST with the anon key, so it works for signed-out
 * visitors. Supports server-range pagination via `listPublishedPostsPage`.
 */

export interface FeedProps {
  /** Number of entries per page. */
  limit?: number
  /** Optional tag to narrow the feed. */
  tag?: string | null
  /** Optional search term. */
  search?: string | null
  /**
   * `grid` is the full magazine layout. `row` is a compact card strip.
   */
  variant?: 'grid' | 'row'
  /** Enable page controls when total exceeds `limit`. */
  paginate?: boolean
  /** Optional callback to clear active search/tag filters from empty state. */
  onClearFilters?: () => void
}

export function Feed({
  limit = 12,
  tag = null,
  search = null,
  variant = 'grid',
  paginate = false,
  onClearFilters,
}: FeedProps) {
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [tag, search, limit])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!isSupabaseConfigured) return
      setLoading(true)
      try {
        const offset = paginate ? (page - 1) * limit : 0
        const result = await listPublishedPostsPage({ limit, offset, tag, search })
        if (!active) return
        setPosts(result.posts)
        setTotal(result.total)
        setError(null)
      } catch (loadError) {
        if (!active) return
        setError(
          loadError instanceof Error ? loadError.message : 'Posts could not be loaded.',
        )
        setPosts([])
        setTotal(0)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [limit, offsetPage(paginate, page), tag, search, paginate])

  if (loading) {
    return (
      <div className={variant === 'grid' ? 'post-grid' : 'post-row'} aria-busy="true">
        {Array.from({ length: variant === 'grid' ? 6 : 3 }, (_, index) => (
          <div className="post-card-skeleton" key={index} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="post-empty">
        <p className="post-empty-title">Posts are unavailable</p>
        <p className="post-empty-text">{error}</p>
      </div>
    )
  }

  if (posts.length === 0) {
    const hasFilters = Boolean((search && search.trim()) || tag)
    return (
      <div className="post-empty">
        <p className="post-empty-title">
          {hasFilters ? 'No matching posts found' : 'No posts published yet'}
        </p>
        <p className="post-empty-text">
          {hasFilters
            ? 'Try a different keyword or clear your active search filters.'
            : 'When an administrator publishes an answer from the workspace, it appears here with its charts and diagrams intact.'}
        </p>
        {hasFilters && onClearFilters ? (
          <button type="button" className="btn btn-small" onClick={onClearFilters}>
            Reset search
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="feed-stack">
      {variant === 'row' ? (
        <div className="post-row">
          {posts.map((post) => (
            <Card key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="post-grid">
          {posts.map((post) => (
            <Card key={post.id} post={post} />
          ))}
        </div>
      )}

      {paginate && total > limit ? (
        <Pagination
          page={page}
          pageSize={limit}
          totalItems={total}
          onPageChange={setPage}
          itemLabel="posts"
        />
      ) : null}
    </div>
  )
}

function offsetPage(paginate: boolean, page: number) {
  return paginate ? page : 1
}
