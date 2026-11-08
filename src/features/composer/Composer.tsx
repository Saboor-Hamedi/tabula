import { getModelOption } from '../../core/agent/modelOptions'
import { formatCount } from '../../core/utils/format'
import { CpuIcon, KeyIcon, SheetIcon } from '../common/Icons'
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
  const { activeSession, apiKey, model, isStreaming, dbReady } = useSessionState()
  const { sendMessage, stopStreaming, openSettings } = useSessionActions()
  const [value, setValue] = useComposerDraft()

  const modelOption = getModelOption(model)
  const totalRows = activeSession?.tables.reduce((total, table) => total + table.rowCount, 0) ?? 0
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
        <div className="composer-chips">
          {activeSession ? (
            <>
              <span className="chip" title={activeSession.fileName}>
                <SheetIcon size={13} />
                <span className="chip-text">{activeSession.fileName}</span>
              </span>
              <span className="chip">
                {formatCount(totalRows)} rows
              </span>
            </>
          ) : null}

          <span className="chip chip-quiet" title={modelOption.description}>
            <CpuIcon size={13} />
            <span>{modelOption.shortLabel}</span>
          </span>

          {!apiKey ? (
            <button type="button" className="chip chip-warn" onClick={openSettings}>
              <KeyIcon size={13} />
              <span>Add API key</span>
            </button>
          ) : null}
        </div>

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
