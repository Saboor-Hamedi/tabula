import { useEffect, useMemo, useRef } from 'react'
import { useSession } from '../SessionProvider'
import { Composer } from '../composer/Composer'
import { MessageBubble } from './MessageBubble'

const SUGGESTIONS = [
  'Give me a full overview of this dataset',
  'What are the most important trends and outliers?',
  'Which categories drive the most activity?',
  'Profile every column and flag data-quality issues',
]

export function ChatPanel() {
  const { messages, isStreaming, streamingSessionId, activeSession, traces, sendMessage } =
    useSession()
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  const streamingHere = isStreaming && streamingSessionId === activeSession?.id
  const hasUserMessage = messages.some((message) => message.role === 'user')

  const activity = useMemo(() => {
    if (!streamingHere) return null
    const running = traces.find((trace) => trace.status === 'running')
    if (!running) return 'Thinking through your data…'
    if (running.toolName === 'inspect_schema') return 'Inspecting the schema…'
    return 'Running SQL over your data…'
  }, [streamingHere, traces])

  const handleScroll = () => {
    const element = scrollRef.current
    if (!element) return
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140
  }

  useEffect(() => {
    if (!stickRef.current) return
    const element = scrollRef.current
    if (!element) return
    const frame = window.requestAnimationFrame(() => {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: streamingHere ? 'auto' : 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, streamingHere])

  return (
    <div className="chat-panel">
      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="chat-inner">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              streaming={streamingHere && index === messages.length - 1 && message.role === 'assistant'}
              activity={activity}
            />
          ))}

          {!hasUserMessage && !streamingHere ? (
            <div className="suggestions">
              <div className="suggestions-label">Try a prompt</div>
              <div className="suggestions-grid">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="suggestion-card"
                    onClick={() => {
                      stickRef.current = true
                      void sendMessage(suggestion)
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Composer />
    </div>
  )
}
