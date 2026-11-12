import { memo } from 'react'
import type { PostBlock, PostImage } from '../../../core/supabase/types'
import { ContentBlocks } from '../../render/ContentBlocks'

/**
 * The body of a published insight.
 *
 * The stored blocks are the very same ones the workspace produced, so a Mermaid
 * diagram, a chart or a table looks identical on the public page. The gallery
 * sits below the answer, in the order the administrator arranged it.
 */

export interface ContentProps {
  blocks: PostBlock[]
  images?: PostImage[]
}

export const Content = memo(function Content({
  blocks,
  images = [],
}: ContentProps) {
  const safeBlocks = Array.isArray(blocks) ? blocks : []

  return (
    <div className="post-body">
      <ContentBlocks blocks={safeBlocks} />

      {images.length > 0 ? (
        <figure className="post-gallery">
          {images.map((image) => (
            <figure className="post-gallery-item" key={image.id}>
              <img src={image.url} alt={image.alt_text ?? ''} loading="lazy" />
              {image.caption ? <figcaption>{image.caption}</figcaption> : null}
            </figure>
          ))}
        </figure>
      ) : null}
    </div>
  )
})
