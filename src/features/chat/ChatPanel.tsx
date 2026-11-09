import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSessionState } from '../SessionProvider'
import { Composer } from '../composer/Composer'
import { MessageBubble } from './MessageBubble'

/**
 * Chat panel.
 *
 * Layout contract: `.chat-column` is the single width reference. The transcript
 * and the composer both live inside it, so every assistant response is exactly
 * as wide as the composer. Nothing in here sets its own max-width.
 *
 * Scrolling: the transcript follows the stream only while the user is already at
 * the bottom. Scroll up during a response and it stays put, so reading earlier
 * output is never interrupted.
 */

const STICK_THRESHOLD = 120

export function ChatPanel() {
  const { messages, isStreaming, streamingSessionId, activeSession, traces } = useSessionState()
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const lastSessionIdRef = useRef<string | null>(null)
  const prevMessageCountRef = useRef(0)

  const streamingHere = isStreaming && streamingSessionId === activeSession?.id

  const activity = useMemo(() => {
    if (!streamingHere) return null
    const running = traces.find((trace) => trace.status === 'running')
    if (!running) return 'Thinking…'
    if (running.toolName === 'inspect_schema') return 'Reading the columns…'
    return 'Analysing the data…'
  }, [streamingHere, traces])

  const handleScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    stickRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD
  }, [])

  useEffect(() => {
    if (!stickRef.current) return
    const element = scrollRef.current
    if (!element) return

    const isNewSession = activeSession?.id !== lastSessionIdRef.current
    const isInitialMount = lastSessionIdRef.current === null
    const isNewMessage = messages.length > prevMessageCountRef.current

    lastSessionIdRef.current = activeSession?.id ?? null
    prevMessageCountRef.current = messages.length

    // Instant snap on refresh, initial load, or session switch; smooth scroll only for newly added messages
    const behavior: ScrollBehavior =
      isInitialMount || isNewSession || streamingHere || !isNewMessage ? 'auto' : 'smooth'

    const frame = window.requestAnimationFrame(() => {
      element.scrollTo({
        top: element.scrollHeight,
        behavior,
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, streamingHere, activeSession?.id])

  return (
    <div className="chat-panel">
      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="chat-column">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              streaming={
                streamingHere && index === messages.length - 1 && message.role === 'assistant'
              }
              activity={activity}
              busy={isStreaming}
            />
          ))}
        </div>
      </div>

      <div className="chat-dock">
        <div className="chat-column">
          <Composer />
        </div>
      </div>
    </div>
  )
}
