import { useCallback, useState } from 'react'
import { Link } from '../../../core/router'
import { postPath } from '../../../core/router/paths'
import type { ChatMessage } from '../../../core/types'
import type { Post } from '../../../core/supabase/types'
import { CheckIcon, GlobeIcon, SlidersIcon } from '../../common/Icons'
import { publishPost } from '../api'
import { buildDraftFromAnswer } from '../lib/compose'

/**
 * One click publishes an answer.
 *
 * The button only exists for administrators: the profile role decides what the
 * interface offers, and the database policy decides what is actually allowed.
 * The title, the standfirst, the cover image and the reading time are derived
 * from the answer itself, so a single click is enough.
 */

export interface PublishProps {
  message: ChatMessage
  /** The dataset the answer came from, shown on the published page. */
  datasetName?: string | null
  /** Fired once the post exists, so the workspace can refresh its list. */
  onPublished?: (post: Post) => void
  /** Opens the full composer instead of publishing straight away. */
  onCustomize?: (message: ChatMessage) => void
}

type PublishState = 'idle' | 'publishing' | 'published' | 'error'

export function Publish({
  message,
  datasetName = null,
  onPublished,
  onCustomize,
}: PublishProps) {
  const [state, setState] = useState<PublishState>('idle')
  const [slug, setSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePublish = useCallback(async () => {
    if (state === 'publishing') return
    setState('publishing')
    setError(null)

    try {
      const draft = buildDraftFromAnswer(message.content)
      const post = await publishPost({
        ...draft,
        sourceMessageId: message.id,
        model: message.model ?? null,
        datasetName,
      })
      setSlug(post.slug)
      setState('published')
      onPublished?.(post)
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'The insight could not be published.',
      )
      setState('error')
    }
  }, [datasetName, message.content, message.id, message.model, onPublished, state])

  if (state === 'published') {
    return (
      <Link
        className="tool-btn is-published"
        to={postPath(slug ?? '')}
        title="Open the published post"
      >
        <CheckIcon size={13} />
        <span>Published</span>
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        className="tool-btn"
        onClick={() => void handlePublish()}
        disabled={state === 'publishing'}
        title="Publish this answer to the public insights page"
      >
        <GlobeIcon size={13} />
        <span>{state === 'publishing' ? 'Publishing…' : 'Publish'}</span>
      </button>
      {onCustomize ? (
        <button
          type="button"
          className="tool-btn tool-btn-icon"
          onClick={() => onCustomize(message)}
          title="Publish with a cover, tags and your own title"
        >
          <SlidersIcon size={13} />
        </button>
      ) : null}
      {error ? (
        <span className="publish-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  )
}
