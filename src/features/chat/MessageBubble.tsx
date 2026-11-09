import { memo, useState } from 'react'
import { getModelOption } from '../../core/agent/modelOptions'
import type { ChatMessage } from '../../core/types'
import { formatCompact, formatTime } from '../../core/utils/format'
import { CheckIcon, CopyIcon, FileIcon } from '../common/Icons'
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
  const { editFigure, sendMessage, saveToNotes } = useSessionActions()
  const [copied, setCopied] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const content = typeof message.content === 'string' ? message.content : ''

  const isUser = message.role === 'user'
  const isThinking = streaming && !isUser && content.trim().length === 0

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const handleSaveToNotes = () => {
    saveToNotes(content)
    setSavedNote(true)
    window.setTimeout(() => setSavedNote(false), 2000)
  }

  if (isUser) {
    return (
      <article className="message message-user">
        <div className="user-bubble">{content}</div>
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
        <MessageRenderer
          content={content}
          streaming={streaming}
          onEditFigure={(figureIndex, changes) =>
            editFigure(message.id, figureIndex, changes)
          }
        />
      )}

      {streaming && !isThinking ? <span className="stream-caret" aria-hidden /> : null}

      {!streaming && content.trim().length > 0 ? (
        <div className="message-tools">
          <button type="button" className="tool-btn" onClick={handleCopy} title="Copy message text">
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={handleSaveToNotes}
            title="Save insight to Studio Notes"
          >
            {savedNote ? <CheckIcon size={13} /> : <FileIcon size={13} />}
            <span>{savedNote ? 'Saved to Notes' : 'Save to Notes'}</span>
          </button>
          {message.model ? (
            <span className="message-time" title={getModelOption(message.model).label}>
              {getModelOption(message.model).shortLabel}
            </span>
          ) : null}
          {message.usage ? (
            <span className="message-time">
              {formatCompact(message.usage.inputTokens + message.usage.outputTokens)} tokens
            </span>
          ) : null}
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
