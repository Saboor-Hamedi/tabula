import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { KeyIcon, SendIcon, StopIcon } from '../common/Icons'

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
  needsKey?: boolean
  onDisabledClick?: () => void
  disabledAction?: {
    label: string
    onClick: () => void
  }
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
  needsKey = false,
  onDisabledClick,
  disabledAction,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) {
      if (event.key === 'Enter' && onDisabledClick) {
        event.preventDefault()
        onDisabledClick()
      }
      return
    }
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!streaming && value.trim().length > 0) onSubmit()
  }

  const handleContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled && onDisabledClick) {
      event.preventDefault()
      onDisabledClick()
    }
  }

  const canSend = !disabled && !streaming && value.trim().length > 0

  return (
    <div
      className={`composer-field ${streaming ? 'is-streaming' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${needsKey ? 'needs-key' : ''}`}
      onClick={handleContainerClick}
    >
      <textarea
        ref={textareaRef}
        className="composer-textarea"
        value={value}
        rows={1}
        placeholder={placeholder}
        onChange={(event) => {
          if (!disabled) onChange(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        readOnly={disabled}
        aria-disabled={disabled}
        aria-label="Message the data agent"
      />

      <div className="composer-field-foot">
        <div className="composer-field-foot-left">
          {disabledAction ? (
            <button
              type="button"
              className="composer-action-pill"
              onClick={(event) => {
                event.stopPropagation()
                disabledAction.onClick()
              }}
            >
              <KeyIcon size={12} />
              <span>{disabledAction.label}</span>
            </button>
          ) : (
            <span className="composer-hint">
              {streaming
                ? 'Working…'
                : disabled
                  ? placeholder
                  : 'Enter to send · Shift+Enter for a new line'}
            </span>
          )}
        </div>

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
  )
}
