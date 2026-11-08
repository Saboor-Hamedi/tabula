import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { SendIcon, StopIcon } from '../common/Icons'

export interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  disabled: boolean
  streaming: boolean
  placeholder: string
}

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
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!disabled && !streaming && value.trim().length > 0) {
      onSubmit()
    }
  }

  return (
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        value={value}
        rows={1}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || streaming}
        aria-label="Message the data agent"
      />
      <div className="chat-input-footer">
        <span className="input-hint">
          {streaming ? 'Agent is working…' : 'Enter to send · Shift+Enter for newline'}
        </span>
        {streaming ? (
          <button type="button" className="send-btn stop-btn" onClick={onStop} aria-label="Stop generating">
            <StopIcon size={16} />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={onSubmit}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send message"
          >
            <SendIcon size={16} />
            <span>Send</span>
          </button>
        )}
      </div>
    </div>
  )
}
