import { getModelOption } from '../../core/agent/modelOptions'
import { NEEDS_ACCESS_KEY } from '../../core/config'
import { CpuIcon, SheetIcon } from '../common/Icons'
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
  const { activeSession, apiKey, isStreaming, dbReady, model } = useSessionState()
  const { sendMessage, stopStreaming, openSettings, setModel } = useSessionActions()
  const [value, setValue] = useComposerDraft()

  const needsKey = NEEDS_ACCESS_KEY && !apiKey
  const disabled = !activeSession || needsKey || !dbReady

  const handleSubmit = () => {
    const text = value.trim()
    if (text.length === 0) return
    setValue('')
    void sendMessage(text)
  }

  const toggleModel = () => {
    setModel(model === 'deepseek-v4-pro' ? 'deepseek-v4-flash' : 'deepseek-v4-pro')
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        {activeSession ? (
          <div className="composer-chips">
            <span className="chip" title={activeSession.fileName}>
              <SheetIcon size={12} />
              <span className="chip-text">{activeSession.fileName}</span>
            </span>
            <button
              type="button"
              className="chip chip-model"
              onClick={toggleModel}
              title={`Active model: ${getModelOption(model).label}. Click to switch.`}
            >
              <CpuIcon size={12} />
              <span className="chip-text">
                {getModelOption(model).shortLabel}
              </span>
            </button>
          </div>
        ) : null}

        <ChatInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          onStop={stopStreaming}
          disabled={disabled}
          streaming={isStreaming}
          needsKey={needsKey}
          onDisabledClick={needsKey ? openSettings : undefined}
          disabledAction={
            needsKey
              ? {
                  label: 'Set DeepSeek API Key',
                  onClick: openSettings,
                }
              : undefined
          }
          placeholder={
            needsKey
              ? 'Add your DeepSeek API key to start asking questions…'
              : !activeSession
                ? 'Upload a file to begin…'
                : !dbReady
                  ? 'Initializing analysis engine…'
                  : `Ask about ${activeSession.fileName}…`
          }
        />
      </div>
    </div>
  )
}
