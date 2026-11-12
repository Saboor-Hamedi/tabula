import { memo } from 'react'
import { ArrowUpIcon } from '../../common/Icons'

/**
 * Follow-up suggestions rendered after an assistant response.
 *
 * Uses the exact same 2-column card UI as the welcome page.
 * 'Ask next' header has been removed.
 */

export interface SuggestionsProps {
  items: string[]
  pending?: boolean
  onPick: (question: string) => void
  disabled?: boolean
}

export const Suggestions = memo(function Suggestions({
  items,
  pending = false,
  onPick,
  disabled = false,
}: SuggestionsProps) {
  if (items.length === 0 && !pending) return null

  return (
    <div className="suggestions-container">
      {pending && items.length === 0 ? (
        <div className="suggestions-pending-bar">
          <span className="suggestions-pending-dot" />
          <span>Generating suggestions…</span>
        </div>
      ) : null}

      <div className="welcome-suggestions-grid">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className="welcome-suggestion-card"
            onClick={() => onPick(item)}
            disabled={disabled}
            title={item}
          >
            <div className="welcome-suggestion-body">
              <span className="welcome-suggestion-title">{item}</span>
            </div>
            <div className="welcome-suggestion-arrow">
              <ArrowUpIcon size={13} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
})
