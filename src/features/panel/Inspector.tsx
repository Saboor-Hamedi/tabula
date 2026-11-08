import { formatCount } from '../../core/utils/format'
import { ActivityIcon, CloseIcon, DownloadIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { TraceEntry } from '../trace/TraceEntry'
import { FilePanel } from './FilePanel'

/**
 * Right-hand inspector.
 *
 * One panel, two tabs: the uploaded file and the agent's tool trace. Tabs beat
 * two competing drawers because the user only ever needs one of them at a time.
 */

export function Inspector() {
  const { panelTab, traces, activeSession, isStreaming, streamingSessionId } = useSessionState()
  const { setPanelTab, closePanel, exportTrace } = useSessionActions()

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
            File
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'trace'}
            className={`inspector-tab ${panelTab === 'trace' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('trace')}
          >
            Trace
            {traces.length > 0 ? (
              <span className="inspector-tab-count">{formatCount(traces.length)}</span>
            ) : null}
          </button>
        </div>

        <div className="inspector-head-actions">
          {panelTab === 'trace' ? (
            <IconButton
              label="Export trace as JSON"
              size="sm"
              onClick={exportTrace}
              disabled={!activeSession || traces.length === 0}
            >
              <DownloadIcon size={15} />
            </IconButton>
          ) : null}
          <IconButton label="Close inspector" size="sm" onClick={() => closePanel()}>
            <CloseIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div className="inspector-body">
        {panelTab === 'file' ? (
          <FilePanel />
        ) : traces.length === 0 ? (
          <div className="panel-empty">
            <ActivityIcon size={22} />
            <p>No tool calls yet</p>
            <span>Ask a question and every schema read and SQL query shows up here.</span>
          </div>
        ) : (
          <div className="trace-list">
            {streamingHere ? <div className="trace-live">Live</div> : null}
            {traces.map((entry) => (
              <TraceEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
