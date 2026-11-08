import { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { MermaidFallback } from './MermaidFallback'

let renderCounter = 0
let initializedKey = ''

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

function ensureInitialized(dark: boolean): void {
  const key = dark ? 'dark' : 'light'
  if (initializedKey === key) return

  const accent = cssVar('--accent', '#0d9488')
  const surface = cssVar('--surface', '#ffffff')
  const surface2 = cssVar('--surface-2', '#f1f3f6')
  const border = cssVar('--border', '#e2e6ec')
  const text = cssVar('--text', '#17202b')
  const muted = cssVar('--text-muted', '#8491a8')
  const contrast = cssVar('--accent-contrast', '#ffffff')

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    themeVariables: {
      primaryColor: accent,
      primaryBorderColor: accent,
      primaryTextColor: contrast,
      secondaryColor: surface2,
      tertiaryColor: surface,
      lineColor: muted,
      textColor: text,
      mainBkg: surface,
      nodeBorder: border,
      clusterBkg: surface2,
      clusterBorder: border,
      titleColor: text,
      edgeLabelBackground: surface,
      fontSize: '14px',
    },
    flowchart: { curve: 'basis', padding: 12 },
    pie: { textPosition: 0.62 },
  })

  initializedKey = key
}

export interface MermaidDiagramProps {
  code: string
}

interface RenderState {
  code: string
  svg: string
  error: string | null
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [result, setResult] = useState<RenderState | null>(null)
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
    const id = `tabula-mermaid-${renderCounter++}`

    const run = async () => {
      try {
        await mermaid.parse(source)
        const rendered = await mermaid.render(id, source)
        if (!active) return
        setResult({ code, svg: rendered.svg, error: null })
      } catch (renderError) {
        if (!active) return
        setResult({
          code,
          svg: '',
          error: renderError instanceof Error ? renderError.message : 'Invalid diagram syntax',
        })
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [code, dark])

  if (code.trim().length === 0) {
    return <MermaidFallback code={code} />
  }

  const current = result !== null && result.code === code ? result : null

  if (current?.error) {
    return <MermaidFallback code={code} tone="error" message={current.error} />
  }

  if (current === null || current.svg.length === 0) {
    return <MermaidFallback code={code} />
  }

  return (
    <div
      className="mermaid-diagram"
      role="img"
      aria-label="Generated chart"
      dangerouslySetInnerHTML={{ __html: current.svg }}
    />
  )
}
