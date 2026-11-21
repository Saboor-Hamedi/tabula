import { CodeIcon } from '../common/Icons'

/**
 * Results panel tab.
 *
 * Kept intentionally empty per workspace configuration: all code blocks,
 * figures, and tables render inline directly under their code wrappers in chat.
 */
export function PythonPanel() {
  return (
    <div className="panel-empty">
      <div className="panel-empty-icon" aria-hidden>
        <CodeIcon size={22} />
      </div>
      <div className="panel-empty-title">No results here</div>
      <div className="panel-empty-desc">
        Figures and tables are displayed directly under each code block in the chat response.
      </div>
    </div>
  )
}
