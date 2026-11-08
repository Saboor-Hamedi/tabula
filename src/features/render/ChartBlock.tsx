import type { ChartData } from '../../core/types'
import { Figure } from './Figure'
import { ElbowChart } from './ElbowChart'

/** File-safe name derived from the chart's own title. */
function figureName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `tabula-${slug || 'chart'}`
}

/** Renders structured chart blocks that need more than Mermaid can express. */
export function ChartBlock({ chart }: { chart: ChartData }) {
  if (chart.type === 'elbow') {
    return (
      <Figure name={figureName(chart.title)}>
        <ElbowChart data={chart} />
      </Figure>
    )
  }
  return null
}
