import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { SendIcon, StopIcon } from '../common/Icons'

/**
 * Auto-growing composer textarea.
 *
 * Enter sends, Shift+Enter inserts a newline. Height is measured on every value
 * change so the box grows with the text and then scrolls at a cap.
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

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  streaming,
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!disabled && !streaming && value.trim().length > 0) onSubmit()
  }

  const canSend = !disabled && !streaming && value.trim().length > 0

  return (
    <div className={`composer-field ${streaming ? 'is-streaming' : ''}`}>
      <textarea
        ref={textareaRef}
        className="composer-textarea"
        value={value}
        rows={1}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || streaming}
        aria-label="Message the data agent"
      />

      <div className="composer-field-foot">
        <span className="composer-hint">
          {streaming ? 'Working…' : 'Enter to send · Shift+Enter for a new line'}
        </span>

        {streaming ? (
          <button type="button" className="composer-send is-stop" onClick={onStop} aria-label="Stop generating">
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
  )
}
