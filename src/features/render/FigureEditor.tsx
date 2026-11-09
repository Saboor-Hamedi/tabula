import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FigureChanges } from '../../core/parsing/editFigure'
import { CheckIcon, CloseIcon, PencilIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'

interface FigureEditorProps {
  title: string
  textColor?: string
  onSave: (changes: FigureChanges) => void
  onClose: () => void
}

const PRESET_COLORS = [
  { name: 'Default Dark', value: '#111827' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Teal', value: '#0891b2' },
]

/**
 * Polished modal dialog for editing a figure's title and text/accent color.
 */
export function FigureEditor({ title, textColor, onSave, onClose }: FigureEditorProps) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftColor, setDraftColor] = useState(textColor ?? '#111827')
  const colorInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus and select title on open
    const timer = window.setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [onClose])

  const handleSave = () => {
    onSave({ title: draftTitle.trim() || title, textColor: draftColor })
    onClose()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSave()
    }
  }

  const handleHexChange = (value: string) => {
    const sanitized = value.trim()
    setDraftColor(sanitized)
  }

  return (
    <div className="modal-overlay figure-editor-overlay" onMouseDown={onClose}>
      <div
        className="modal figure-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="figure-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="figure-editor-title">
            <span className="figure-editor-head-icon" aria-hidden>
              <PencilIcon size={15} />
            </span>
            Edit figure
          </h2>
          <IconButton label="Close figure editor" size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </div>

        <div className="modal-body figure-editor-body">
          <div className="figure-field">
            <label htmlFor="figure-title-input" className="figure-field-label">
              Figure title
            </label>
            <input
              id="figure-title-input"
              ref={titleInputRef}
              className="figure-title-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Enter a descriptive figure title…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="figure-field">
            <label className="figure-field-label">
              Text & accent color
            </label>
            <div className="figure-color-section">
              <div className="figure-color-controls">
                {/* Custom color trigger button: round-full, small */}
                <div className="figure-custom-color-wrapper">
                  <button
                    type="button"
                    className="figure-color-circle-btn"
                    onClick={() => colorInputRef.current?.click()}
                    title="Choose custom color"
                    aria-label="Choose custom color"
                  >
                    <span
                      className="figure-color-circle-swatch"
                      style={{ backgroundColor: draftColor }}
                    />
                  </button>
                  <input
                    ref={colorInputRef}
                    type="color"
                    className="figure-hidden-color-input"
                    value={draftColor.startsWith('#') && draftColor.length === 7 ? draftColor : '#111827'}
                    onChange={(event) => setDraftColor(event.target.value)}
                    tabIndex={-1}
                    aria-hidden
                  />
                </div>

                <div className="figure-hex-wrapper">
                  <input
                    type="text"
                    className="figure-hex-input"
                    value={draftColor}
                    onChange={(event) => handleHexChange(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="#111827"
                    maxLength={9}
                    spellCheck={false}
                    aria-label="Hex color value"
                  />
                </div>
              </div>

              {/* Preset swatches: round full small buttons */}
              <div className="figure-presets-row" role="radiogroup" aria-label="Preset colors">
                {PRESET_COLORS.map((preset) => {
                  const isSelected = draftColor.toLowerCase() === preset.value.toLowerCase()
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      className={`figure-preset-btn ${isSelected ? 'is-selected' : ''}`}
                      style={{ backgroundColor: preset.value }}
                      onClick={() => setDraftColor(preset.value)}
                      title={preset.name}
                      aria-label={preset.name}
                      aria-checked={isSelected}
                      role="radio"
                    >
                      {isSelected ? <CheckIcon size={12} className="figure-preset-check" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="figure-preview-box">
            <span className="figure-preview-tag">Preview</span>
            <div className="figure-preview-title" style={{ color: draftColor }}>
              {draftTitle.trim() || 'Untitled figure'}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="modal-foot-note">Only this figure will be updated.</span>
          <div className="modal-foot-right">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary figure-save-btn"
              onClick={handleSave}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
