import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getModelOption, MODEL_OPTIONS } from '../../core/agent/modelOptions'
import { getTelemetryEnabled, saveTelemetryEnabled } from '../../core/storage/settings'
import {
  deletePlatformApiKey,
  fetchPlatformKeyStatus,
  savePlatformApiKey,
  type PlatformKeyStatus,
} from '../../core/supabase/platformKey'
import { formatBytes } from '../../core/utils/format'
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  CpuIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  KeyIcon,
  SettingsIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useAuthUser, useIsAdmin } from '../auth/useProfile'
import { useSessionActions, useSessionState } from '../SessionProvider'

type SettingsTab = 'access' | 'models' | 'media' | 'storage'

/**
 * Admin Settings.
 *
 * Strictly restricted to administrators (`isAdmin`). Regular users never see
 * Settings or any API key controls.
 */
export function SettingsModal() {
  const { settingsOpen } = useSessionState()
  const isAdmin = useIsAdmin()

  if (!settingsOpen || !isAdmin) return null
  return <SettingsDialog />
}

function SettingsDialog() {
  const { closeSettings } = useSessionActions()
  const [tab, setTab] = useState<SettingsTab>('access')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSettings])

  const content = (
    <div className="modal-overlay" onMouseDown={closeSettings}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="settings-title">
            <SettingsIcon size={17} />
            <span>Settings</span>
          </h2>
          <IconButton label="Close settings" size="sm" onClick={closeSettings}>
            <CloseIcon size={16} />
          </IconButton>
        </div>

        <div className="settings-tabs-wrap">
          <div className="settings-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'access'}
              className={`settings-tab ${tab === 'access' ? 'is-active' : ''}`}
              onClick={() => setTab('access')}
            >
              Access
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'models'}
              className={`settings-tab ${tab === 'models' ? 'is-active' : ''}`}
              onClick={() => setTab('models')}
            >
              Models
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'media'}
              className={`settings-tab ${tab === 'media' ? 'is-active' : ''}`}
              onClick={() => setTab('media')}
            >
              Media
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'storage'}
              className={`settings-tab ${tab === 'storage' ? 'is-active' : ''}`}
              onClick={() => setTab('storage')}
            >
              Storage
            </button>
          </div>
        </div>

        <div className="modal-body">
          {tab === 'access' ? <AccessPanel /> : null}
          {tab === 'models' ? <ModelsPanel /> : null}
          {tab === 'media' ? <MediaPanel /> : null}
          {tab === 'storage' ? <StoragePanel /> : null}
        </div>

        <div className="modal-foot">
          <div className="modal-foot-right">
            <button type="button" className="btn btn-primary btn-small" onClick={closeSettings}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}

/** Single shared platform API key in Supabase (`user_api_keys`), managed by Admin via `/api/admin/key`. */
function AccessPanel() {
  const user = useAuthUser()
  const [status, setStatus] = useState<PlatformKeyStatus | null>(null)
  const [draftKey, setDraftKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const serverStatus = await fetchPlatformKeyStatus()
        if (active) setStatus(serverStatus)
      } catch (loadError) {
        if (active) {
          setStatus({ configured: false, masked: null })
          if (loadError instanceof Error) setError(loadError.message)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [user?.id])

  const handleSave = async () => {
    const trimmed = draftKey.trim()
    if (!trimmed) {
      setError('Enter a DeepSeek API key to save.')
      return
    }
    if (!trimmed.startsWith('sk-') || trimmed.length < 20 || /\s/.test(trimmed)) {
      setError('Enter a valid DeepSeek API key starting with "sk-".')
      return
    }
    if (!user?.id) {
      setError('Sign in as administrator to save the key.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const nextStatus = await savePlatformApiKey(trimmed)
      setStatus(nextStatus)
      setDraftKey('')
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save the API key.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!user?.id) return
    setSaving(true)
    setError(null)
    try {
      const nextStatus = await deletePlatformApiKey()
      setStatus(nextStatus)
      setDraftKey('')
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : 'Could not remove the API key.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-card">
        <div className="field">
          <div className="field-head">
            <label htmlFor="admin-api-key" className="field-label">
              <KeyIcon size={14} />
              Platform DeepSeek API key
            </label>
            {status === null ? (
              <span className="field-status">Checking…</span>
            ) : status.configured ? (
              <span className="field-status is-ok">Active · {status.masked}</span>
            ) : (
              <span className="field-status is-warn">Not set</span>
            )}
          </div>

          <p className="field-help">
            Stored once in Supabase <code>user_api_keys</code> and used through the backend proxy
            for all signed-in members.
          </p>

          <div className={`field-input ${error ? 'has-error' : ''}`}>
            <input
              id="admin-api-key"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(event) => {
                setDraftKey(event.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSave()
              }}
              placeholder={status?.configured ? 'Paste a new key to replace…' : 'sk-…'}
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

          <div className="settings-inline-actions">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => void handleClear()}
              disabled={saving || !status?.configured}
            >
              Remove key
            </button>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Language model card selector. */
function ModelsPanel() {
  const { model } = useSessionState()
  const { setModel } = useSessionActions()

  return (
    <div className="settings-panel">
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
          DeepSeek V4 Pro enables deeper multi-step reasoning for complex investigations. Changes
          take effect immediately on the next prompt.
        </p>
      </div>
    </div>
  )
}

/** Published media library summary. */
function MediaPanel() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void import('../../core/supabase/client')
      .then(({ supabase }) => {
        if (!supabase) return null
        return supabase.storage.from('post-media').list('', { limit: 100 })
      })
      .then((result) => {
        if (!active || !result) return
        if ('data' in result && result.data) setCount(result.data.length)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="settings-panel">
      <div className="settings-card">
        <div className="field-head">
          <span className="field-label">
            <GlobeIcon size={14} />
            Published media
          </span>
          <span className="field-status is-ok">
            {count === null ? 'Checking…' : `${count} files`}
          </span>
        </div>
        <p className="field-help">
          Charts and diagrams published with insights live in the <code>post-media</code> storage
          bucket.
        </p>
      </div>
    </div>
  )
}

/** Privacy, telemetry, and local browser cache controls. */
function StoragePanel() {
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
    <div className="settings-panel">
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
          <small>Only used when a telemetry reporting endpoint is configured.</small>
        </span>
      </label>

      <div className="settings-storage-row">
        <span>
          <strong>
            <DatabaseIcon size={13} /> Browser storage
          </strong>
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
