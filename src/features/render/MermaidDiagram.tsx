import { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { MermaidFallback } from './MermaidFallback'

/**
 * Mermaid renderer.
 *
 * Mermaid is a singleton with global config, so initialization is keyed to the
 * active color scheme and only re-runs when that changes. Renders are serialized
 * through a promise queue: concurrent `mermaid.render` calls collide on the
 * internal DOM node Mermaid uses, which is what made frequent chats flaky.
 */

let renderCounter = 0
let initializedKey = ''
let queue: Promise<unknown> = Promise.resolve()

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

function ensureInitialized(dark: boolean): void {
  const key = dark ? 'dark' : 'light'
  if (initializedKey === key) return

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    themeVariables: {
      primaryColor: cssVar('--accent-soft', '#e6f2f0'),
      primaryBorderColor: cssVar('--accent', '#0f766e'),
      primaryTextColor: cssVar('--text', '#101828'),
      secondaryColor: cssVar('--surface-2', '#f4f6f8'),
      tertiaryColor: cssVar('--surface', '#ffffff'),
      lineColor: cssVar('--border-strong', '#cbd5e1'),
      textColor: cssVar('--text', '#101828'),
      mainBkg: cssVar('--surface', '#ffffff'),
      nodeBorder: cssVar('--border-strong', '#cbd5e1'),
      clusterBkg: cssVar('--surface-2', '#f4f6f8'),
      clusterBorder: cssVar('--border', '#e2e8f0'),
      titleColor: cssVar('--text', '#101828'),
      edgeLabelBackground: cssVar('--surface', '#ffffff'),
      fontSize: '13px',
    },
    flowchart: { curve: 'basis', padding: 12, useMaxWidth: true },
    pie: { textPosition: 0.6, useMaxWidth: true },
    xyChart: { useMaxWidth: true },
  })

  initializedKey = key
}

/** Serializes renders so two charts never fight over Mermaid's scratch DOM. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  // Keep the chain alive even when a render rejects.
  queue = run.catch(() => undefined)
  return run
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

    const run = async () => {
      const id = `tabula-mermaid-${renderCounter++}`
      try {
        await mermaid.parse(source)
        const rendered = await enqueue(() => mermaid.render(id, source))
        if (!active) return
        setResult({ code, svg: rendered.svg, error: null })
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
  }, [code, dark])

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
      dangerouslySetInnerHTML={{ __html: current.svg }}
    />
  )
}
