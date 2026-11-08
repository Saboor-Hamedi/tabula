import { MODEL_OPTIONS } from '../../core/agent/modelOptions'
import { useSession } from '../SessionProvider'

export interface ModelToggleProps {
  compact?: boolean
}

export function ModelToggle({ compact = false }: ModelToggleProps) {
  const { model, setModel } = useSession()

  return (
    <div
      className={`segmented ${compact ? 'is-compact' : ''}`}
      role="group"
      aria-label="Model selection"
    >
      {MODEL_OPTIONS.map((option) => {
        const active = option.id === model
        return (
          <button
            key={option.id}
            type="button"
            className={`segmented-item ${active ? 'is-active' : ''}`}
            onClick={() => setModel(option.id)}
            aria-pressed={active}
            title={option.description}
          >
            <span>{option.shortLabel}</span>
            {!compact ? <span className="segmented-badge">{option.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
