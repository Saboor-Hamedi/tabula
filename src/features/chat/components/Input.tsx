import { useLayoutEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import {
  MAX_PROMPT_WORDS,
  clampPromptInput,
  countWords,
  validateUserPrompt,
} from '../../../core/utils/promptGuard'
import { AlertIcon, SendIcon, StopIcon } from '../../common/Icons'

/**
 * Auto-growing composer textarea with a strict 300-word cap, live `0/300`
 * counter, and real-time security validation against pasted links/scripts.
 */

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  disabled: boolean
  streaming: boolean
  placeholder: string
}

const MAX_HEIGHT = 200

export function Input({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  streaming,
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wordCount = useMemo(() => countWords(value), [value])
  const validation = useMemo(() => validateUserPrompt(value), [value])
  const hasBlockingError = value.trim().length > 0 && Boolean(validation.error)

  useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  const handleChange = (nextRaw: string) => {
    if (disabled) return
    const next = clampPromptInput(nextRaw, MAX_PROMPT_WORDS)
    onChange(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!streaming && validation.ok) onSubmit()
  }

  const canSend = !disabled && !streaming && validation.ok
  const counterTone =
    wordCount >= MAX_PROMPT_WORDS
      ? 'is-limit'
      : wordCount >= MAX_PROMPT_WORDS - 40
        ? 'is-warn'
        : ''

  return (
    <div
      className={`composer-field ${streaming ? 'is-streaming' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${hasBlockingError ? 'is-invalid' : ''}`}
    >
      <textarea
        ref={textareaRef}
        className="composer-textarea"
        value={value}
        rows={1}
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={disabled}
        aria-disabled={disabled}
        aria-invalid={hasBlockingError}
        aria-label="Message the data agent"
      />

      {hasBlockingError ? (
        <div className="composer-security-alert" role="alert">
          <AlertIcon size={13} />
          <span>{validation.error}</span>
        </div>
      ) : null}

      <div className="composer-field-foot">
        <div className="composer-field-foot-left">
          <span className="composer-hint">
            {streaming
              ? 'Working…'
              : disabled
                ? placeholder
                : 'Enter ↵ to send · Shift+Enter for new line'}
          </span>
        </div>

        <div className="composer-field-foot-right">
          {wordCount > 0 ? (
            <span
              className={`composer-word-counter ${counterTone}`}
              aria-live="polite"
              title={`${wordCount} of ${MAX_PROMPT_WORDS} words`}
            >
              {wordCount}/{MAX_PROMPT_WORDS}
            </span>
          ) : null}

          {streaming ? (
            <button
              type="button"
              className="composer-send is-stop"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <StopIcon size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="composer-send"
              onClick={onSubmit}
              disabled={!canSend}
              aria-label="Send message"
            >
              <SendIcon size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
