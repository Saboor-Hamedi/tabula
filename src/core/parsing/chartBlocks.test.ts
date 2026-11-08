import { describe, expect, it } from 'vitest'
import { extractChartBlocks, parseChartCode } from './extractChartBlocks'

const elbowJson = JSON.stringify({
  type: 'elbow',
  title: 'Optimal rank',
  xLabel: 'Ranks',
  yLabel: 'Distance',
  points: [
    { x: 4, y: 90 },
    { x: 1, y: 100 },
    { x: 2, y: 60 },
    { x: 3, y: 35 },
  ],
  elbowX: 3,
  elbowLabel: 'Best rank · 3',
})

describe('structured chart parsing', () => {
  it('normalizes and sorts elbow points', () => {
    const chart = parseChartCode(elbowJson)
    expect(chart?.type).toBe('elbow')
    if (chart?.type !== 'elbow') return
    expect(chart.points.map((point) => point.x)).toEqual([1, 2, 3, 4])
    expect(chart.elbowX).toBe(3)
  })

  it('extracts a chart fenced block from prose', () => {
    const blocks = extractChartBlocks(`Here is the result.\n\n\`\`\`chart\n${elbowJson}\n\`\`\`\n\nDone.`)
    expect(blocks.some((block) => block.type === 'chart')).toBe(true)
    expect(blocks.filter((block) => block.type === 'markdown')).toHaveLength(2)
  })

  it('parses highlighted series charts', () => {
    const chart = parseChartCode(
      JSON.stringify({
        type: 'series',
        kind: 'bar',
        title: 'Revenue by region',
        xLabel: 'Region',
        yLabel: 'Revenue',
        points: [
          { label: 'EMEA', value: 2410 },
          { label: 'APAC', value: 1740 },
        ],
        highlightIndex: 0,
      }),
    )
    expect(chart?.type).toBe('series')
    if (chart?.type !== 'series') return
    expect(chart.kind).toBe('bar')
    expect(chart.highlightIndex).toBe(0)
  })

  it('falls back to text when the JSON is invalid', () => {
    const blocks = extractChartBlocks('```chart\n{ not json }\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('markdown')
  })
})
