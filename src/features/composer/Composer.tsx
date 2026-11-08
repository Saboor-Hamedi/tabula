import { useSessionActions, useSessionState } from '../SessionProvider'
import { ChatInput } from '../chat/ChatInput'
import { useComposerDraft } from './useComposerDraft'

/**
 * Composer.
 *
 * The composer is the width reference for the whole conversation: the chat
 * column and every assistant response share its exact width, so the transcript
 * reads as one column instead of a stack of differently-sized boxes.
 *
 * The draft is kept in a module-level store, so switching datasets or opening
 * settings never loses what the user was typing.
 */

export function Composer() {
  const { activeSession, apiKey, isStreaming, dbReady } = useSessionState()
  const { sendMessage, stopStreaming } = useSessionActions()
  const [value, setValue] = useComposerDraft()

  const disabled = !activeSession || !apiKey || !dbReady

  const handleSubmit = () => {
    const text = value.trim()
    if (text.length === 0) return
    setValue('')
    void sendMessage(text)
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        <ChatInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          onStop={stopStreaming}
          disabled={disabled}
          streaming={isStreaming}
          placeholder={
            !apiKey
              ? 'Add your API key to start asking questions…'
              : activeSession
                ? `Ask about ${activeSession.fileName}…`
                : 'Upload a file to begin…'
          }
        />
      </div>
    </div>
  )
}
