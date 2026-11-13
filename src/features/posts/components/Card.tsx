import { Suspense, lazy, memo, useMemo } from 'react'
import { extractMermaidBlocks } from '../../../core/parsing/extractMermaidBlocks'
import { Link } from '../../../core/router'
import { postPath } from '../../../core/router/paths'
import type { PostSummary } from '../../../core/supabase/types'
import { formatCount } from '../../../core/utils/format'
import { EyeIcon, ImageIcon } from '../../common/Icons'

const MermaidDiagram = lazy(() =>
  import('../../mermaid/MermaidDiagram').then((m) => ({
    default: m.MermaidDiagram,
  })),
)

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
  const thumbnail = useMemo(() => {
    if (post.cover_image_url) {
      return { kind: 'image' as const, url: post.cover_image_url, alt: '' }
    }

    const gallery = Array.isArray(post.post_images) ? post.post_images : []
    if (gallery.length > 0) {
      const first = [...gallery].sort((a, b) => a.position - b.position)[0]
      if (first?.url) {
        return { kind: 'image' as const, url: first.url, alt: first.alt_text ?? '' }
      }
    }

    const blocks = Array.isArray(post.blocks) ? post.blocks : []
    const mermaid = blocks.find(
      (b): b is { type: 'mermaid'; code: string } =>
        b?.type === 'mermaid' && typeof b.code === 'string' && b.code.trim().length > 0,
    )
    if (mermaid) {
      return { kind: 'mermaid' as const, code: mermaid.code }
    }

    if (typeof post.content === 'string') {
      const match = post.content.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)
      if (match && match[1]?.trim()) {
        const candidate = match[1].trim()
        if (/^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|quadrantChart|xychart-beta|mindmap|timeline)/im.test(candidate)) {
          return { kind: 'mermaid' as const, code: candidate }
        }
      }
      const extracted = extractMermaidBlocks(post.content)
      const found = extracted.find(
        (b): b is { type: 'mermaid'; code: string } =>
          b.type === 'mermaid' && b.code.trim().length > 0,
      )
      if (found) {
        return { kind: 'mermaid' as const, code: found.code }
      }
    }

    return null
  }, [post.cover_image_url, post.post_images, post.blocks, post.content])

  return (
    <Link
      className={`post-card ${featured ? 'is-featured' : ''}`}
      to={postPath(post.slug)}
    >
      {thumbnail?.kind === 'image' ? (
        <div className="post-card-cover">
          <img src={thumbnail.url} alt={thumbnail.alt} loading="lazy" />
        </div>
      ) : thumbnail?.kind === 'mermaid' ? (
        <div className="post-card-cover is-mermaid" aria-hidden="true">
          <Suspense fallback={<div className="post-card-cover-placeholder" />}>
            <MermaidDiagram code={thumbnail.code} />
          </Suspense>
        </div>
      ) : (
        <div className="post-card-cover is-placeholder" aria-hidden="true">
          <div className="post-card-placeholder-art">
            <ImageIcon size={32} />
          </div>
        </div>
      )}

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

        <h3 className="post-card-title" title={post.title}>
          {post.title}
        </h3>

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
            <span className="post-card-author">{post.author_name ?? 'Lumina Tabula'}</span>
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
          </div>
        </div>
      </div>
    </Link>
  )
})
