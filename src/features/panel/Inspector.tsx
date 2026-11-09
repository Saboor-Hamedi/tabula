import { formatCount } from '../../core/utils/format'
import { ActivityIcon, CloseIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { StickyBoard } from '../theme'
import { TraceEntry } from '../trace/TraceEntry'
import { PythonPanel } from './PythonPanel'

/**
 * Right-hand inspector.
 *
 * Workspace panel featuring:
 * - Notes (interactive studio notes)
 * - Results (Python runtime results & plots)
 * - Activity (transparent agent trace)
 */

export function Inspector() {
  const {
    panelTab,
    traces,
    activeSession,
    isStreaming,
    streamingSessionId,
    pythonResult,
    pythonStatus,
  } = useSessionState()
  const { setPanelTab, closePanel } = useSessionActions()

  const streamingHere = isStreaming && streamingSessionId === activeSession?.id

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-head">
        <div className="inspector-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'notes'}
            className={`inspector-tab ${panelTab === 'notes' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('notes')}
          >
            Notes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'python'}
            className={`inspector-tab ${panelTab === 'python' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('python')}
          >
            Results
            {pythonStatus === 'running' ? (
              <span className="inspector-tab-count is-pulse">●</span>
            ) : pythonResult?.images.length ? (
              <span className="inspector-tab-count">{pythonResult.images.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'trace'}
            className={`inspector-tab ${panelTab === 'trace' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('trace')}
          >
            Activity
            {traces.length > 0 ? (
              <span className="inspector-tab-count">{formatCount(traces.length)}</span>
            ) : null}
          </button>
        </div>

        <div className="inspector-head-actions">
          <IconButton label="Close inspector" size="sm" onClick={() => closePanel()}>
            <CloseIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div
        className={`inspector-body ${
          panelTab === 'python'
            ? 'is-python-tab'
            : panelTab === 'notes'
            ? 'is-notes-tab'
            : ''
        }`}
      >
        {panelTab === 'notes' ? (
          <StickyBoard />
        ) : panelTab === 'python' ? (
          <PythonPanel />
        ) : traces.length === 0 ? (
          <div className="panel-empty">
            <div className="panel-empty-icon" aria-hidden>
              <ActivityIcon size={24} />
            </div>
            <div className="panel-empty-title">No activity yet</div>
            <div className="panel-empty-desc">
              When the assistant queries DuckDB or executes Python, tool calls and schema inspections will appear here.
            </div>
          </div>
        ) : (
          <div className="trace-list">
            <div className="trace-list-meta">
              <span>{formatCount(traces.length)} operations</span>
              {streamingHere && <span className="trace-pulse">Active</span>}
            </div>
            {traces.map((trace) => (
              <TraceEntry key={trace.id} entry={trace} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
