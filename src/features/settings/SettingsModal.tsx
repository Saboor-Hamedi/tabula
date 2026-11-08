import { useEffect, useRef, useState } from 'react'
import { maskApiKey, validateApiKey } from '../../core/storage/settings'
import { AlertIcon, CloseIcon, EyeIcon, EyeOffIcon, KeyIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'

/**
 * Settings dialog.
 *
 * Scope: the API key. The model is switched from the header, so this dialog does
 * not repeat that control — one concern, one place.
 */

export function SettingsModal() {
  const { settingsOpen } = useSessionState()
  if (!settingsOpen) return null
  return <SettingsDialog />
}

function SettingsDialog() {
  const { apiKey } = useSessionState()
  const { closeSettings, saveApiKey, clearApiKey } = useSessionActions()
  const [draftKey, setDraftKey] = useState(apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSettings])

  const handleSave = () => {
    const validation = validateApiKey(draftKey)
    if (!validation.valid) {
      setError(validation.message)
      return
    }
    saveApiKey(draftKey)
    setError(null)
    closeSettings()
  }

  const handleClear = () => {
    clearApiKey()
    setDraftKey('')
    setError(null)
  }

  return (
    <div className="modal-overlay" onMouseDown={closeSettings}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="settings-title">Settings</h2>
          <IconButton label="Close settings" size="sm" onClick={closeSettings}>
            <CloseIcon size={16} />
          </IconButton>
        </div>

        <div className="modal-body">
          <div className="field">
            <div className="field-head">
              <label htmlFor="api-key" className="field-label">
                <KeyIcon size={14} />
                DeepSeek API key
              </label>
              {apiKey ? (
                <span className="field-status is-ok">Saved · {maskApiKey(apiKey)}</span>
              ) : (
                <span className="field-status is-warn">Required</span>
              )}
            </div>

            <div className={`field-input ${error ? 'has-error' : ''}`}>
              <input
                id="api-key"
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onChange={(event) => {
                  setDraftKey(event.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSave()
                }}
                placeholder="sk-…"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={error !== null}
              />
              <IconButton
                label={showKey ? 'Hide key' : 'Show key'}
                size="sm"
                onClick={() => setShowKey((visible) => !visible)}
              >
                {showKey ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </IconButton>
            </div>

            {error ? (
              <div className="field-error" role="alert">
                <AlertIcon size={13} />
                <span>{error}</span>
              </div>
            ) : null}

            <p className="field-help">
              Stored in this browser only, under <code>data-agent:deepseek-key</code>. Only your
              questions, the column digest, and the query results the agent requests are sent to
              DeepSeek. The uploaded file itself stays local.
            </p>
          </div>
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleClear}
            disabled={!apiKey && draftKey.trim().length === 0}
          >
            Clear key
          </button>
          <div className="modal-foot-right">
            <button type="button" className="btn btn-ghost" onClick={closeSettings}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
