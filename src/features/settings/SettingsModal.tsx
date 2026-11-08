import { useEffect, useRef, useState } from 'react'
import { getModelOption, MODEL_OPTIONS } from '../../core/agent/modelOptions'
import { maskApiKey, validateApiKey } from '../../core/storage/settings'
import { AlertIcon, CloseIcon, EyeIcon, EyeOffIcon, KeyIcon, SparkIcon } from '../common/Icons'
import { useSession } from '../SessionProvider'
import { ModelToggle } from './ModelToggle'

export function SettingsModal() {
  const { settingsOpen } = useSession()
  if (!settingsOpen) return null
  return <SettingsDialog />
}

function SettingsDialog() {
  const { closeSettings, apiKey, saveApiKey, clearApiKey, model } = useSession()
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

  const selected = getModelOption(model)

  return (
    <div className="modal-overlay" onMouseDown={closeSettings}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon" aria-hidden>
              <SparkIcon size={18} />
            </span>
            <div>
              <h2 id="settings-title">Settings</h2>
              <p>Connect Tabula to DeepSeek and choose a model.</p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={closeSettings} aria-label="Close settings">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title">
                <KeyIcon size={16} />
                <span>DeepSeek API key</span>
              </div>
              {apiKey ? (
                <span className="settings-saved">Saved · {maskApiKey(apiKey)}</span>
              ) : (
                <span className="settings-required">Required</span>
              )}
            </div>
            <p className="settings-help">
              Your key is stored only in this browser under{' '}
              <code>data-agent:deepseek-key</code>. It is never written to a server or committed to
              the repository.
            </p>
            <div className={`key-input-row ${error ? 'has-error' : ''}`}>
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                className="text-input"
                value={draftKey}
                onChange={(event) => {
                  setDraftKey(event.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSave()
                }}
                placeholder="sk-..."
                spellCheck={false}
                autoComplete="off"
                aria-label="DeepSeek API key"
                aria-invalid={error !== null}
              />
              <button
                type="button"
                className="btn-icon input-icon-btn"
                onClick={() => setShowKey((visible) => !visible)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
            {error ? (
              <div className="field-error" role="alert">
                <AlertIcon size={14} />
                <span>{error}</span>
              </div>
            ) : null}
            <div className="settings-key-actions">
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Save key
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleClear}
                disabled={!apiKey && draftKey.trim().length === 0}
              >
                Clear key
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title">
                <SparkIcon size={16} />
                <span>Model</span>
              </div>
              <span className="settings-saved">{selected.label}</span>
            </div>
            <p className="settings-help">
              Stored under <code>data-agent:model</code>. Changes apply on the next agent turn,
              without resetting the session.
            </p>
            <ModelToggle />
            <div className="model-options">
              {MODEL_OPTIONS.map((option) => (
                <div
                  key={option.id}
                  className={`model-option ${option.id === model ? 'is-active' : ''}`}
                >
                  <div className="model-option-top">
                    <span className="model-option-name">{option.label}</span>
                    <span className="model-option-badge">{option.badge}</span>
                  </div>
                  <p>{option.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-section settings-section-quiet">
            <div className="settings-section-title">
              <KeyIcon size={16} />
              <span>Privacy</span>
            </div>
            <p className="settings-help">
              Uploaded data stays in memory in this tab. Only your questions, the inferred schema,
              and the query results you or the agent request are sent to DeepSeek for analysis.
              Closing the tab clears everything.
            </p>
          </section>
        </div>

        <div className="modal-footer">
          <span className="modal-footer-note">Changes take effect immediately.</span>
          <button type="button" className="btn btn-ghost" onClick={closeSettings}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
