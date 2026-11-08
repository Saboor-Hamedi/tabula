import { formatCount } from '../../core/utils/format'
import { ActivityIcon, CloseIcon, DownloadIcon } from '../common/Icons'
import { useSession } from '../SessionProvider'
import { TraceEntry } from './TraceEntry'

export function TracePanel() {
  const {
    traceOpen,
    setTraceOpen,
    traces,
    activeSession,
    exportTrace,
    isStreaming,
    streamingSessionId,
  } = useSession()

  const streamingHere = isStreaming && streamingSessionId === activeSession?.id

  return (
    <aside
      className={`trace-drawer ${traceOpen ? 'is-open' : ''}`}
      aria-label="Tool trace"
      aria-hidden={!traceOpen}
    >
      <div className="trace-inner">
        <header className="trace-header">
          <div className="trace-heading">
            <span className="trace-heading-icon" aria-hidden>
              <ActivityIcon size={16} />
            </span>
            <div>
              <h2>Tool trace</h2>
              <p>
                {formatCount(traces.length)} call{traces.length === 1 ? '' : 's'}
                {streamingHere ? ' · live' : ''}
              </p>
            </div>
          </div>
          <div className="trace-header-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={exportTrace}
              disabled={!activeSession || traces.length === 0}
              title="Export trace as JSON"
              aria-label="Export trace as JSON"
            >
              <DownloadIcon size={16} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setTraceOpen(false)}
              aria-label="Close trace panel"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </header>

        <div className="trace-scroll">
          {!activeSession ? (
            <div className="trace-empty">
              <ActivityIcon size={22} />
              <p>Load a dataset to see the agent's tool calls.</p>
            </div>
          ) : traces.length === 0 ? (
            <div className="trace-empty">
              <ActivityIcon size={22} />
              <p>No tool calls yet. Ask a question and the schema inspection and SQL queries will appear here.</p>
            </div>
          ) : (
            <div className="trace-list">
              {traces.map((entry) => (
                <TraceEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        <footer className="trace-footer">
          <span>In-memory only · cleared on delete</span>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={exportTrace}
            disabled={!activeSession || traces.length === 0}
          >
            <DownloadIcon size={14} />
            <span>Export JSON</span>
          </button>
        </footer>
      </div>
    </aside>
  )
}
