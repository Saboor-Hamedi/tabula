import { formatCount } from '../../core/utils/format'
import { ActivityIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { StickyBoard } from '../theme'
import { TraceEntry } from '../trace/TraceEntry'
import { FilePanel } from './FilePanel'
import { PythonPanel } from './PythonPanel'

/**
 * Right-hand inspector.
 *
 * Workspace panel featuring 4 full-width, full-height tabs:
 * - Data (tables & schema columns inspection)
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
    notesVersion,
  } = useSessionState()
  const { setPanelTab } = useSessionActions()

  const streamingHere = isStreaming && streamingSessionId === activeSession?.id

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-head">
        <div className="inspector-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'file'}
            className={`inspector-tab ${panelTab === 'file' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('file')}
          >
            Data
          </button>
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
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'trace'}
            className={`inspector-tab ${panelTab === 'trace' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('trace')}
          >
            Activity
          </button>
        </div>
      </div>

      <div
        className={`inspector-body ${
          panelTab === 'file'
            ? 'is-file-tab'
            : panelTab === 'python'
            ? 'is-python-tab'
            : panelTab === 'notes'
            ? 'is-notes-tab'
            : ''
        }`}
      >
        {panelTab === 'file' ? (
          <FilePanel />
        ) : panelTab === 'notes' ? (
          <StickyBoard key={notesVersion} />
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
