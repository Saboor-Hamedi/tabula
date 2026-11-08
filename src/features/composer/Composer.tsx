import { useState } from 'react'
import { getModelOption } from '../../core/agent/modelOptions'
import { formatCount } from '../../core/utils/format'
import { BoltIcon, FileIcon, KeyIcon, TableIcon } from '../common/Icons'
import { ChatInput } from '../chat/ChatInput'
import { useSession } from '../SessionProvider'

export function Composer() {
  const {
    activeSession,
    apiKey,
    model,
    isStreaming,
    sendMessage,
    stopStreaming,
    openSettings,
  } = useSession()
  const [value, setValue] = useState('')

  const modelOption = getModelOption(model)
  const totalRows = activeSession?.tables.reduce((total, table) => total + table.rowCount, 0) ?? 0
  const disabled = !activeSession || !apiKey

  const handleSubmit = () => {
    const text = value.trim()
    if (text.length === 0) return
    setValue('')
    void sendMessage(text)
  }

  return (
    <div className="composer">
      {!apiKey ? (
        <div className="composer-notice">
          <KeyIcon size={16} />
          <span>Add your DeepSeek API key to start chatting.</span>
          <button type="button" className="btn btn-small btn-primary" onClick={openSettings}>
            Open settings
          </button>
        </div>
      ) : null}

      <div className="composer-chips">
        {activeSession ? (
          <>
            <span className="chip" title={activeSession.fileName}>
              <FileIcon size={13} />
              <span className="chip-text">{activeSession.fileName}</span>
            </span>
            <span className="chip">
              <TableIcon size={13} />
              <span>
                {activeSession.tables.length} table{activeSession.tables.length === 1 ? '' : 's'}
              </span>
              <span className="chip-divider" />
              <span>{formatCount(totalRows)} rows</span>
            </span>
          </>
        ) : null}
        <span className="chip chip-model" title={modelOption.description}>
          <BoltIcon size={13} />
          <span>{modelOption.shortLabel}</span>
        </span>
        {!apiKey ? (
          <button type="button" className="chip chip-warning" onClick={openSettings}>
            <KeyIcon size={13} />
            <span>Key missing</span>
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
            ? 'Add an API key in settings to chat with your data…'
            : activeSession
              ? `Ask about ${activeSession.fileName}…`
              : 'Upload a file to begin…'
        }
      />
    </div>
  )
}
