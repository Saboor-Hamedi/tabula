import { useState } from 'react'
import type { ChatMessage } from '../../core/types'
import { formatTime } from '../../core/utils/format'
import { CheckIcon, CopyIcon, SparkIcon } from '../common/Icons'
import { MessageRenderer } from './MessageRenderer'

export interface MessageBubbleProps {
  message: ChatMessage
  streaming: boolean
  activity: string | null
}

export function MessageBubble({ message, streaming, activity }: MessageBubbleProps) {
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
        <div className="message-bubble user-bubble">
          <p className="user-text">{message.content}</p>
        </div>
        <div className="message-meta">
          <time>{formatTime(message.createdAt)}</time>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`message message-assistant ${message.error ? 'is-error' : ''} ${
        message.welcome ? 'is-welcome' : ''
      }`}
    >
      <div className="assistant-avatar" aria-hidden>
        <SparkIcon size={16} />
      </div>
      <div className="assistant-column">
        <div className="message-bubble assistant-bubble">
          {isThinking ? (
            <div className="thinking">
              <span className="thinking-dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="thinking-label">{activity ?? 'Thinking through your data…'}</span>
            </div>
          ) : (
            <MessageRenderer content={message.content} />
          )}
          {streaming && !isThinking ? <span className="stream-caret" aria-hidden /> : null}
        </div>
        <div className="message-meta">
          <time>{formatTime(message.createdAt)}</time>
          {message.content.trim().length > 0 && !streaming ? (
            <button type="button" className="copy-btn" onClick={handleCopy}>
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
