import { memo, useRef, useState } from 'react'
import type { ChatMessage } from '../../../core/types'
import { openPricingModal } from '../../../core/supabase/usage'
import { formatCompact, formatTime } from '../../../core/utils/format'
import { ArrowRightIcon, CheckIcon, CopyIcon, FileIcon } from '../../common/Icons'
import { useIsAdmin } from '../../auth/useProfile'
import { Composer, Publish } from '../../posts'
import { useSessionActions } from '../../SessionProvider'
import { copyRichAnswer } from '../lib/copyAnswer'
import { Renderer } from './Renderer'
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
  /** The dataset this answer came from, shown on the published page. */
  datasetName?: string | null
}

export const Bubble = memo(function Bubble({
  message,
  streaming,
  activity,
  busy,
  datasetName = null,
}: MessageBubbleProps) {
  const { editFigure, sendMessage, saveToNotes } = useSessionActions()
  const isAdmin = useIsAdmin()
  const [copied, setCopied] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [composing, setComposing] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const content = typeof message.content === 'string' ? message.content : ''

  const isUser = message.role === 'user'
  const isThinking = streaming && !isUser && content.trim().length === 0

  const handleCopy = async () => {
    try {
      await copyRichAnswer(bodyRef.current, content)
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
        <div ref={bodyRef}>
          <Renderer
            content={content}
            streaming={streaming}
            onEditFigure={(figureIndex, changes) =>
              editFigure(message.id, figureIndex, changes)
            }
          />
        </div>
      )}

      {streaming && !isThinking ? <span className="stream-caret" aria-hidden /> : null}

      {!streaming && message.upgradeReason ? (
        <div className="message-upgrade-cta">
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => openPricingModal(message.upgradeReason!)}
          >
            <span>Upgrade to Tabula Pro</span>
            <ArrowRightIcon size={13} />
          </button>
        </div>
      ) : null}

      {!streaming && content.trim().length > 0 ? (
        <div className={`message-tools ${isAdmin ? 'is-admin' : ''}`}>
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
          {isAdmin ? (
            <Publish
              message={message}
              datasetName={datasetName}
              onCustomize={() => setComposing(true)}
            />
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

      {composing ? (
        <Composer
          message={message}
          datasetName={datasetName}
          onClose={() => setComposing(false)}
        />
      ) : null}
    </article>
  )
})
