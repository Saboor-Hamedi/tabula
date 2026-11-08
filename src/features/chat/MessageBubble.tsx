import { memo, useState } from 'react'
import type { ChatMessage } from '../../core/types'
import { formatTime } from '../../core/utils/format'
import { CheckIcon, CopyIcon } from '../common/Icons'
import { useSessionActions } from '../SessionProvider'
import { MessageRenderer } from './MessageRenderer'
import { Suggestions } from './Suggestions'

/**
 * One message in the transcript.
 *
 * User messages are a compact bubble on the right. Assistant messages have no
 * background plate: they sit directly on the canvas at the composer's width, so
 * long answers, tables and charts all line up on one column.
 */

export interface MessageBubbleProps {
  message: ChatMessage
  streaming: boolean
  activity: string | null
  /** Disabled while another turn is running. */
  busy: boolean
}

export const MessageBubble = memo(function MessageBubble({
  message,
  streaming,
  activity,
  busy,
}: MessageBubbleProps) {
  const { sendMessage } = useSessionActions()
  const [copied, setCopied] = useState(false)

  const isUser = message.role === 'user'
  const isThinking = streaming && !isUser && message.content.trim().length === 0

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  if (isUser) {
    return (
      <article className="message message-user">
        <div className="user-bubble">{message.content}</div>
        <time className="message-time">{formatTime(message.createdAt)}</time>
      </article>
    )
  }

  return (
    <article className={`message message-assistant ${message.error ? 'is-error' : ''}`}>
      {isThinking ? (
        <div className="thinking">
          <span className="thinking-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span>{activity ?? 'Reading your data…'}</span>
        </div>
      ) : (
        <MessageRenderer content={message.content} streaming={streaming} />
      )}

      {streaming && !isThinking ? <span className="stream-caret" aria-hidden /> : null}

      {!streaming && message.content.trim().length > 0 ? (
        <div className="message-tools">
          <button type="button" className="tool-btn" onClick={handleCopy}>
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <time className="message-time">{formatTime(message.createdAt)}</time>
        </div>
      ) : null}

      {!streaming && !message.error ? (
        <Suggestions
          items={message.suggestions ?? []}
          pending={message.suggestionsPending}
          disabled={busy}
          onPick={(question) => void sendMessage(question)}
        />
      ) : null}
    </article>
  )
})
