import { memo } from 'react'
import { Link } from '../../../core/router'
import { postPath } from '../../../core/router/paths'
import type { PostSummary } from '../../../core/supabase/types'
import { formatCount } from '../../../core/utils/format'
import { ArrowRightIcon, EyeIcon } from '../../common/Icons'

/**
 * One insight in the feed.
 *
 * The card is a link: the whole surface opens the post, and the hover lifts it
 * by a hair so the grid reads as a list of stories rather than a table.
 */

export interface CardProps {
  post: PostSummary
  /** Large cards are used for the first, featured entry. */
  featured?: boolean
}

function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const Card = memo(function Card({ post, featured = false }: CardProps) {
  return (
    <Link
      className={`post-card ${featured ? 'is-featured' : ''}`}
      to={postPath(post.slug)}
    >
      {post.cover_image_url ? (
        <div className="post-card-cover">
          <img src={post.cover_image_url} alt="" loading="lazy" />
        </div>
      ) : null}

      <div className="post-card-body">
        {post.tags.length > 0 ? (
          <div className="post-card-tags">
            {post.tags.slice(0, 3).map((tag) => (
              <span className="post-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <h3 className="post-card-title">{post.title}</h3>

        {post.subtitle ? <p className="post-card-subtitle">{post.subtitle}</p> : null}
        {post.excerpt ? <p className="post-card-excerpt">{post.excerpt}</p> : null}

        <div className="post-card-foot">
          <div className="post-card-byline">
            {post.author_avatar_url ? (
              <img
                className="post-avatar"
                src={post.author_avatar_url}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="post-avatar is-fallback" aria-hidden>
                {(post.author_name ?? 'T').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="post-card-author">{post.author_name ?? 'Tabula'}</span>
            <span className="post-dot" aria-hidden>
              ·
            </span>
            <span className="post-card-date">{formatDate(post.published_at)}</span>
          </div>

          <div className="post-card-meta">
            <span className="post-chip">
              <EyeIcon size={12} />
              {formatCount(post.view_count)}
            </span>
            <span className="post-chip">{post.reading_time_minutes} min</span>
            <span className="post-card-go" aria-hidden>
              <ArrowRightIcon size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
})
