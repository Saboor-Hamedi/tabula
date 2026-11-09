import { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { MermaidFallback } from './MermaidFallback'
import {
  cssVar,
  enqueue,
  getNextRenderId,
  PIE_COLORS,
  XY_COLORS,
} from './utils/mermaidUtils'

let initializedKey = ''

function ensureInitialized(dark: boolean): void {
  const key = dark ? 'dark' : 'light'
  if (initializedKey === key) return

  const text = cssVar('--text', dark ? '#e8eaee' : '#14171c')
  const muted = cssVar('--text-muted', dark ? '#767e8c' : '#868d9b')
  const border = cssVar('--border', dark ? '#232830' : '#e6e8ec')
  const borderStrong = cssVar('--border-strong', dark ? '#333a45' : '#d3d7de')
  const surface = cssVar('--surface', dark ? '#12151a' : '#ffffff')
  const surface2 = cssVar('--surface-2', dark ? '#171b21' : '#f6f7f9')

  const themeVariables: Record<string, unknown> = {
    background: 'transparent',
    primaryColor: dark ? '#1e3a8a' : '#dbeafe',
    primaryBorderColor: dark ? '#60a5fa' : '#2563eb',
    primaryTextColor: dark ? '#eff6ff' : '#0f172a',
    secondaryColor: dark ? '#7c2d12' : '#ffedd5',
    secondaryBorderColor: dark ? '#fb923c' : '#ea580c',
    secondaryTextColor: dark ? '#ffedd5' : '#7c2d12',
    tertiaryColor: dark ? '#14532d' : '#dcfce7',
    tertiaryBorderColor: dark ? '#4ade80' : '#16a34a',
    tertiaryTextColor: dark ? '#dcfce7' : '#14532d',
    lineColor: dark ? '#64748b' : '#64748b',
    textColor: text,
    mainBkg: surface,
    nodeBorder: borderStrong,
    clusterBkg: surface2,
    clusterBorder: border,
    titleColor: text,
    edgeLabelBackground: surface,
    fontSize: '13px',
    pieTitleTextColor: text,
    pieLegendTextColor: text,
    pieSectionTextColor: '#ffffff',
    pieStrokeColor: surface,
    pieStrokeWidth: '2px',
    pieOuterStrokeColor: border,
    pieOpacity: '0.95',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: text,
      dataLabelColor: text,
      legendTextColor: text,
      xAxisLabelColor: text,
      xAxisTitleColor: text,
      xAxisTickColor: muted,
      xAxisLineColor: borderStrong,
      yAxisLabelColor: text,
      yAxisTitleColor: text,
      yAxisTickColor: muted,
      yAxisLineColor: borderStrong,
      plotColorPalette: XY_COLORS.join(', '),
    },
  }

  PIE_COLORS.forEach((color, index) => {
    themeVariables[`pie${index + 1}`] = color
  })

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    themeVariables,
    themeCSS: `
      .nodeLabel, .edgeLabel, .label { font-weight: 550; }
      .node rect, .node polygon, .node circle { rx: 8px; ry: 8px; }
      .chart-title text, .pieTitleText { font-weight: 700; }
      .chart-title text, .bottom-axis text, .left-axis text,
      .pieTitleText, .legend text, .plot text { fill: ${text}; }
    `,
    flowchart: { curve: 'basis', padding: 12, useMaxWidth: true, wrappingWidth: 240 },
    pie: { textPosition: 0.62, useMaxWidth: true },
    xyChart: { useMaxWidth: true },
  })

  initializedKey = key
}

function extractCustomTextColor(code: string): string | null {
  const match = /%%\s*tabula:textColor\s*=\s*(#[0-9a-fA-F]{3,8})\s*%%/i.exec(code)
  return match ? match[1] : null
}

const CHART_TEXT_SELECTOR =
  '.chart-title text,.bottom-axis text,.left-axis text,.pieTitleText,.legend text,.plot text'

function applyCustomTextColor(svgMarkup: string, color: string): string {
  try {
    const documentNode = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
    if (documentNode.querySelector('parsererror')) return svgMarkup

    documentNode.querySelectorAll(CHART_TEXT_SELECTOR).forEach((node) => {
      if (!(node instanceof SVGElement)) return
      node.setAttribute('fill', color)
      node.style.setProperty('fill', color, 'important')
    })

    return new XMLSerializer().serializeToString(documentNode.documentElement)
  } catch {
    return svgMarkup
  }
}

export interface MermaidDiagramProps {
  code: string
}

interface RenderState {
  code: string
  svg: string
  error: string | null
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [result, setResult] = useState<RenderState | null>(null)
  const customTextColor = extractCustomTextColor(code)
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => setDark(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    let active = true
    const source = code.trim()
    if (source.length === 0) return

    ensureInitialized(dark)

    const run = async () => {
      const id = getNextRenderId()
      try {
        await mermaid.parse(source)
        const rendered = await enqueue(() => mermaid.render(id, source))
        if (!active) return
        const svg = customTextColor
          ? applyCustomTextColor(rendered.svg, customTextColor)
          : rendered.svg
        setResult({ code, svg, error: null })
      } catch (renderError) {
        if (!active) return
        setResult({
          code,
          svg: '',
          error:
            renderError instanceof Error ? renderError.message : 'Invalid diagram syntax',
        })
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [code, customTextColor, dark])

  if (code.trim().length === 0) return <MermaidFallback code={code} />

  const current = result !== null && result.code === code ? result : null

  if (current?.error) {
    return <MermaidFallback code={code} tone="error" message={current.error} />
  }

  if (current === null || current.svg.length === 0) {
    return <MermaidFallback />
  }

  return (
    <div
      className="mermaid-diagram"
      role="img"
      aria-label="Generated chart"
      data-export-text-color={customTextColor ?? undefined}
      dangerouslySetInnerHTML={{ __html: current.svg }}
    />
  )
}

export default MermaidDiagram
