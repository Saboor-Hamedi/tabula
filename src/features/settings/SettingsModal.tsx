import { useEffect, useRef, useState } from 'react'
import { getModelOption, MODEL_OPTIONS } from '../../core/agent/modelOptions'
import { USES_SERVER_PROXY } from '../../core/config'
import { getTelemetryEnabled, maskApiKey, saveTelemetryEnabled, validateApiKey } from '../../core/storage/settings'
import { formatBytes } from '../../core/utils/format'
import { AlertIcon, CheckIcon, CloseIcon, CpuIcon, EyeIcon, EyeOffIcon, KeyIcon } from '../common/Icons'
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
  const { apiKey, model } = useSessionState()
  const { closeSettings, saveApiKey, clearApiKey, setModel } = useSessionActions()
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
          {USES_SERVER_PROXY ? (
            <div className="field">
              <div className="field-head">
                <span className="field-label">
                  <KeyIcon size={14} />
                  Tabula cloud connection
                </span>
                <span className="field-status is-ok">Connected</span>
              </div>
              <p className="field-help">
                This workspace is connected through the Tabula server. No access key is stored in
                your browser, and only the questions and results needed to answer are sent for
                processing.
              </p>
            </div>
          ) : (
          <div className="field">
            <div className="field-head">
              <label htmlFor="api-key" className="field-label">
                <KeyIcon size={14} />
                DeepSeek access key
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
              Stored only in this browser. Only your questions, a summary of the selected columns,
              and the results needed to answer are sent to DeepSeek. The uploaded file itself stays
              local.
            </p>
          </div>
          )}
          {/* Model selection */}
          <div className="field">
            <div className="field-head">
              <span className="field-label">
                <CpuIcon size={14} />
                Language model
              </span>
              <span className="field-status is-ok">{getModelOption(model).label}</span>
            </div>
            <div className="model-settings-options">
              {MODEL_OPTIONS.map((option) => {
                const isSelected = option.id === model
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`model-setting-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setModel(option.id)}
                  >
                    <div className="model-setting-main">
                      <strong className="model-setting-title">{option.label}</strong>
                      <p className="model-setting-desc">{option.description}</p>
                    </div>
                    <div className="model-setting-check" aria-hidden>
                      {isSelected ? <CheckIcon size={16} /> : null}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="field-help">
              DeepSeek V4 Pro uses deeper reasoning for complex analytics. You can switch models anytime.
            </p>
          </div>

          <StorageSettings />
        </div>

        <div className="modal-foot">
          {USES_SERVER_PROXY ? (
            <button type="button" className="btn btn-primary" onClick={closeSettings}>
              Done
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Privacy, storage and local cache controls. */
function StorageSettings() {
  const [telemetry, setTelemetry] = useState(getTelemetryEnabled)
  const [usage, setUsage] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    let active = true
    navigator.storage
      ?.estimate()
      .then((estimate) => {
        if (active) setUsage(estimate.usage ?? null)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const clearCaches = async () => {
    setClearing(true)
    try {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key.startsWith('tabula')).map((key) => caches.delete(key)),
      )
      const estimate = await navigator.storage?.estimate()
      setUsage(estimate?.usage ?? null)
    } catch {
      // Cache access is optional.
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="settings-extra">
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={telemetry}
          onChange={(event) => {
            setTelemetry(event.target.checked)
            saveTelemetryEnabled(event.target.checked)
          }}
        />
        <span>
          <strong>Send anonymous error details</strong>
          <small>Only if a reporting endpoint is configured by the site owner.</small>
        </span>
      </label>

      <div className="settings-storage-row">
        <span>
          <strong>Browser storage</strong>
          <small>{usage === null ? 'Checking…' : `${formatBytes(usage)} used`}</small>
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => void clearCaches()}
          disabled={clearing}
        >
          {clearing ? 'Clearing…' : 'Clear cached files'}
        </button>
      </div>
    </div>
  )
}
