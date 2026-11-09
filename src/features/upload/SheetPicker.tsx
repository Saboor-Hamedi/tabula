import { useMemo, useState } from 'react'
import type { SheetInfo } from '../../core/types'
import { formatCount } from '../../core/utils/format'
import { CloseIcon, TableIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'

/** Default selection: the first sheet plus the largest sheets. */
function defaultSelection(sheets: SheetInfo[]): Set<string> {
  const ranked = [...sheets].sort(
    (left, right) =>
      right.rowCount - left.rowCount || right.columnCount - left.columnCount,
  )
  const selected = new Set<string>()
  if (sheets[0]) selected.add(sheets[0].name)
  for (const sheet of ranked) {
    if (selected.size >= 13) break
    selected.add(sheet.name)
  }
  return selected
}

export function SheetPicker() {
  const { sheetPicker } = useSessionState()
  const { confirmSheetSelection, cancelSheetSelection } = useSessionActions()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() =>
    sheetPicker ? defaultSelection(sheetPicker.sheets) : new Set(),
  )
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    if (!sheetPicker) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return sheetPicker.sheets
    return sheetPicker.sheets.filter((sheet) => sheet.name.toLowerCase().includes(needle))
  }, [query, sheetPicker])

  if (!sheetPicker) return null

  const toggle = (name: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await confirmSheetSelection([...selected])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={cancelSheetSelection}>
      <div
        className="modal sheet-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="sheet-picker-heading">
            <h2 id="sheet-picker-title">Choose sheets</h2>
            <p>
              {sheetPicker.fileName} has {formatCount(sheetPicker.sheets?.length ?? 0)} sheets. Pick the
              ones you want to analyse.
            </p>
          </div>
          <IconButton label="Close sheet picker" size="sm" onClick={cancelSheetSelection}>
            <CloseIcon size={16} />
          </IconButton>
        </div>

        <div className="sheet-picker-toolbar">
          <input
            className="sheet-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sheets…"
            aria-label="Search sheets"
          />
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setSelected(new Set(filtered.map((sheet) => sheet.name)))}
          >
            Select visible
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>

        <div className="sheet-list">
          {filtered.map((sheet) => (
            <label key={sheet.name} className="sheet-row">
              <input
                type="checkbox"
                checked={selected.has(sheet.name)}
                onChange={() => toggle(sheet.name)}
              />
              <span className="sheet-row-icon" aria-hidden>
                <TableIcon size={14} />
              </span>
              <span className="sheet-row-name" title={sheet.name}>
                {sheet.name}
              </span>
              <span className="sheet-row-meta">
                {formatCount(sheet.rowCount)} rows · {sheet.columnCount} columns
              </span>
            </label>
          ))}
          {filtered.length === 0 ? (
            <div className="sheet-empty">No sheets match “{query}”.</div>
          ) : null}
        </div>

        <div className="modal-foot">
          <span className="modal-foot-note">
            {formatCount(selected.size)} of {formatCount(sheetPicker.sheets?.length ?? 0)} selected
          </span>
          <div className="modal-foot-right">
            <button type="button" className="btn btn-ghost" onClick={cancelSheetSelection}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleConfirm()}
              disabled={busy || selected.size === 0}
            >
              {busy ? 'Loading…' : `Load ${formatCount(selected.size)} sheet${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
