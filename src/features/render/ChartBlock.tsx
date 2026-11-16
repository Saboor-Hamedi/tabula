import { useState } from 'react'
import type { FigureChanges } from '../../core/parsing/editFigure'
import type { ChartData } from '../../core/types'
import { DataTable } from './DataTable'
import { ElbowChart } from './ElbowChart'
import { Figure } from './Figure'
import { FigureEditor } from './FigureEditor'
import { SeriesChart } from './SeriesChart'

/** File-safe name derived from the chart's own title. */
function figureName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `tabula-${slug || 'chart'}`
}

export interface ChartBlockProps {
  chart: ChartData
  onEdit?: (changes: FigureChanges) => void
}

type ChartViewMode = 'bar' | 'line' | 'pie' | 'scatter' | 'table'

/** Renders structured chart blocks with a 1-click Bar / Line / Pie / Table switcher. */
export function ChartBlock({ chart, onEdit }: ChartBlockProps) {
  const defaultMode: ChartViewMode = chart.type === 'series' ? chart.kind : 'line'
  const [viewMode, setViewMode] = useState<ChartViewMode>(defaultMode)
  const [editing, setEditing] = useState(false)

  const modes: Array<{ id: ChartViewMode; label: string }> =
    chart.type === 'series'
      ? [
          { id: 'bar', label: 'Bar' },
          { id: 'line', label: 'Line' },
          { id: 'pie', label: 'Pie' },
          { id: 'table', label: 'Table' },
        ]
      : [
          { id: 'line', label: 'Curve' },
          { id: 'bar', label: 'Bar' },
          { id: 'table', label: 'Table' },
        ]

  const switcher = (
    <div className="mermaid-tabs" role="tablist" aria-label="Switch chart type">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={viewMode === m.id}
          className={`mermaid-tab ${viewMode === m.id ? 'is-active' : ''}`}
          onClick={() => setViewMode(m.id)}
        >
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  )

  let chartNode: React.ReactNode
  if (viewMode === 'table') {
    const headers = [chart.xLabel || 'Category', chart.yLabel || 'Value']
    const rows =
      chart.type === 'elbow'
        ? chart.points.map((p) => [String(p.x), String(p.y)])
        : chart.points.map((p) => [p.label, String(p.value)])
    chartNode = <DataTable headers={headers} rows={rows} />
  } else if (chart.type === 'elbow') {
    chartNode =
      viewMode === 'bar' ? (
        <SeriesChart
          data={{
            type: 'series',
            kind: 'bar',
            title: chart.title,
            xLabel: chart.xLabel,
            yLabel: chart.yLabel,
            points: chart.points.map((p) => ({ label: String(p.x), value: p.y })),
            note: chart.note,
            textColor: chart.textColor,
          }}
        />
      ) : (
        <ElbowChart data={chart} />
      )
  } else {
    chartNode = <SeriesChart data={{ ...chart, kind: viewMode }} />
  }

  return (
    <>
      <Figure
        name={figureName(chart.title)}
        onEdit={onEdit ? () => setEditing(true) : undefined}
        toolbarLeft={switcher}
      >
        {chartNode}
      </Figure>
      {editing && onEdit ? (
        <FigureEditor
          title={chart.title}
          textColor={chart.textColor}
          onSave={onEdit}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}
