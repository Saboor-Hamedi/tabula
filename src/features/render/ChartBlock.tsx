import { useState } from 'react'
import type { FigureChanges } from '../../core/parsing/editFigure'
import type { ChartData } from '../../core/types'
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

/** Renders structured chart blocks that need more than Mermaid can express. */
export function ChartBlock({ chart, onEdit }: ChartBlockProps) {
  const [editing, setEditing] = useState(false)

  const chartNode =
    chart.type === 'elbow' ? <ElbowChart data={chart} /> : <SeriesChart data={chart} />

  return (
    <>
      <Figure
        name={figureName(chart.title)}
        onEdit={onEdit ? () => setEditing(true) : undefined}
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
