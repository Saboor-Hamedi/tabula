import type { ChatMessage } from '../../../core/types'
import type { Post } from '../../../core/supabase/types'
import { PostEditModal } from './PostEditModal'

/**
 * The Create Post modal launched from a workspace answer.
 *
 * Uses the unified Post Studio (`PostEditModal` in `create` mode) with
 * real-time field validation and Responsive Review (Desktop / Tablet / Mobile).
 */

export interface ComposerProps {
  message: ChatMessage
  datasetName?: string | null
  onClose: () => void
  onPublished?: (post: Post) => void
}

export function Composer({
  message,
  datasetName = null,
  onClose,
  onPublished,
}: ComposerProps) {
  return (
    <PostEditModal
      mode="create"
      initialContent={message.content}
      initialDatasetName={datasetName}
      sourceMessageId={message.id}
      sourceModel={message.model ?? null}
      onClose={onClose}
      onCreated={onPublished}
    />
  )
}
