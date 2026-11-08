import { useState } from 'react'
import type { ToolTraceEntry } from '../../core/types'
import { formatDuration, formatTime } from '../../core/utils/format'
import { AlertIcon, CheckIcon, ChevronDownIcon, DatabaseIcon, TableIcon } from '../common/Icons'

/**
 * One tool call in the trace.
 *
 * Collapsed by default: the summary line is what matters while the agent is
 * working. Expanding shows the arguments and the raw result.
 */

export function TraceEntry({ entry }: { entry: ToolTraceEntry }) {
  const [expanded, setExpanded] = useState(false)
  const duration = entry.finishedAt ? entry.finishedAt - entry.startedAt : null
  const detail = typeof entry.detail === 'string' ? entry.detail : ''
  const summary = typeof entry.summary === 'string' ? entry.summary : ''
  const argsText = JSON.stringify(entry.args ?? {}, null, 2)

  return (
    <div className={`trace-entry is-${entry.status}`}>
      <button
        type="button"
        className="trace-entry-head"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="trace-status" aria-hidden>
          {entry.status === 'running' ? (
            <span className="spinner spinner-small" />
          ) : entry.status === 'error' ? (
            <AlertIcon size={13} />
          ) : (
            <CheckIcon size={13} />
          )}
        </span>

        <span className="trace-tool">
          {entry.toolName === 'inspect_schema' ? (
            <DatabaseIcon size={12} />
          ) : (
            <TableIcon size={12} />
          )}
          <span>{entry.toolName}</span>
        </span>

        <span className="trace-time">{formatTime(entry.startedAt)}</span>
        <ChevronDownIcon size={13} className={`trace-chevron ${expanded ? 'is-open' : ''}`} />
      </button>

      <div className="trace-summary">{summary}</div>

      {expanded ? (
        <div className="trace-detail">
          {duration !== null ? (
            <div className="trace-detail-row">
              <span className="trace-detail-label">Duration</span>
              <span className="trace-detail-value">{formatDuration(duration)}</span>
            </div>
          ) : null}

          <div className="trace-detail-row is-column">
            <span className="trace-detail-label">Arguments</span>
            <pre className="trace-code">{argsText}</pre>
          </div>

          <div className="trace-detail-row is-column">
            <span className="trace-detail-label">Result</span>
            <pre className="trace-code">{detail.length > 0 ? detail : '—'}</pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}
