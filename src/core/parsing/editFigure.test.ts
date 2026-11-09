import { describe, expect, it } from 'vitest'
import { editFigure, readMermaidTextColor, readMermaidTitle } from './editFigure'

describe('figure editing', () => {
  it('renames the selected Mermaid figure only', () => {
    const content = [
      'First',
      '```mermaid',
      'xychart-beta',
      '    title "Old title"',
      '    x-axis "A" ["a", "b"]',
      '    y-axis "B" 0 --> 10',
      '    bar [1, 2]',
      '```',
      'Second',
      '```mermaid',
      'xychart-beta',
      '    title "Keep me"',
      '    x-axis "A" ["a", "b"]',
      '    y-axis "B" 0 --> 10',
      '    bar [3, 4]',
      '```',
    ].join('\n')

    const edited = editFigure(content, 0, { title: 'New title', textColor: '#dc2626' })
    expect(readMermaidTitle(edited)).toBe('New title')
    expect(readMermaidTextColor(edited)).toBe('#dc2626')
    expect(edited).toContain('title "Keep me"')
  })

  it('updates structured chart title and color', () => {
    const chart = JSON.stringify({
      type: 'series',
      kind: 'bar',
      title: 'Old',
      xLabel: 'X',
      yLabel: 'Y',
      points: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
      ],
    })
    const content = `Before\n\`\`\`chart\n${chart}\n\`\`\`\nAfter`
    const edited = editFigure(content, 0, { title: 'New', textColor: '#16a34a' })
    expect(edited).toContain('"title": "New"')
    expect(edited).toContain('"textColor": "#16a34a"')
  })
})
