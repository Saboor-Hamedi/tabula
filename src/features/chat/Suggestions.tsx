import { ArrowUpIcon } from '../common/Icons'

/**
 * Data-derived follow-up questions.
 *
 * These are never a static list: they are produced from the dataset digest (and
 * refined by the model after each answer), so every chip names a real column or
 * value from the uploaded file. Clicking one sends it as the next question.
 */

export interface SuggestionsProps {
  items: string[]
  pending?: boolean
  onPick: (question: string) => void
  disabled?: boolean
}

export function Suggestions({ items, pending = false, onPick, disabled = false }: SuggestionsProps) {
  if (items.length === 0 && !pending) return null

  return (
    <div className="suggestions">
      <div className="suggestions-head">
        <span>Ask next</span>
        {pending ? <span className="suggestions-pending">refining…</span> : null}
      </div>

      <div className="suggestions-list">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className="suggestion"
            onClick={() => onPick(item)}
            disabled={disabled}
          >
            <span className="suggestion-text">{item}</span>
            <ArrowUpIcon size={13} />
          </button>
        ))}
      </div>
    </div>
  )
}
