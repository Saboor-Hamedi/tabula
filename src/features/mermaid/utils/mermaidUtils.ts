import type { SeriesChartData } from '../../../core/types'

/**
 * Mermaid utility functions and serialized render queue.
 */

let renderCounter = 0
let queue: Promise<unknown> = Promise.resolve()

/** Serializes renders so two charts never collide on Mermaid's scratch DOM. */
export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.catch(() => undefined)
  return next
}

/** Generates a unique, collision-free element ID for mermaid.render */
export function getNextRenderId(): string {
  return `tabula-mermaid-${++renderCounter}`
}

/** Helper to read CSS variables with fallback */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

/** Derives a stable, file-safe name from the diagram's own title. */
export function figureName(code: string): string {
  const titleMatch = /title\s+"?([^"\n]+)"?/i.exec(code)
  const base = titleMatch ? titleMatch[1] : 'chart'
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `tabula-${slug || 'chart'}`
}

/** Saturated data palette. Kept semantic: red/amber/green map to rank. */
export const PIE_COLORS = [
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#0d9488',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#db2777',
]

export const XY_COLORS = [
  '#2563eb',
  '#ea580c',
  '#16a34a',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#db2777',
]

/**
 * Cleans and repairs Mermaid diagram source before parsing/rendering:
 * - Removes `(n=12)` sample count noise from labels and titles
 * - Rounds long decimal numbers (`94.44443`) to 1 decimal place (`94.4`)
 * - Auto-quotes unquoted flowchart node labels containing special chars (`()`, `%`, `:`)
 */
export function sanitizeMermaidCode(raw: string): string {
  if (!raw) return ''
  let cleaned = raw
    .replace(/\s*[([][nN]\s*=\s*\d+\s*[)\]]/g, '')
    .replace(/(-?\d+)\.(\d{2,})(%?)/g, (_m, intP: string, decP: string, pct: string) => {
      const num = Number.parseFloat(`${intP}.${decP}`)
      if (!Number.isFinite(num)) return _m
      const rounded = Math.round(num * 10) / 10
      return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}${pct}`
    })

  // Auto-quote unquoted flowchart node labels that contain parentheses, colons, or %
  if (/^\s*(?:flowchart|graph)\b/im.test(cleaned)) {
    cleaned = cleaned.replace(
      /\b([A-Za-z0-9_]+)\[([^"\]\n]*[()%:][^"\]\n]*)\]/g,
      (_m, id: string, label: string) => `${id}["${label.replace(/"/g, "'").trim()}"]`,
    )
  }

  return cleaned
}

/**
 * Extracts structured series points from Mermaid `xychart-beta` or `pie` code
 * so the user can toggle between Bar, Line, Pie, and Table in 1 click.
 */
export function extractSeriesFromMermaid(code: string): SeriesChartData | null {
  const trimmed = sanitizeMermaidCode((code || '').trim())
  if (!trimmed) return null

  const titleMatch = /title\s+"?([^"\n]+)"?/i.exec(trimmed)
  const title = titleMatch ? titleMatch[1].trim() : 'Chart'

  if (/^\s*(?:%%\{[\s\S]*?\}%%\s*)?xychart(?:-beta)?\b/i.test(trimmed)) {
    const xAxisBracket = /x-axis\s+(?:"([^"]+)"\s+)?\[([^\]]+)\]/i.exec(trimmed)
    const yAxisMatch = /y-axis\s+"([^"]+)"/i.exec(trimmed)
    const allSeriesMatches = Array.from(trimmed.matchAll(/^\s*(bar|line)\s+\[([^\]]+)\]/gim))
    // Keep multi-series combo charts (e.g. bar + line together) in native Mermaid renderer
    if (!xAxisBracket || allSeriesMatches.length !== 1) return null
    const seriesMatch = allSeriesMatches[0]

    const labels = Array.from(xAxisBracket[2].matchAll(/"([^"]+)"|'([^']+)'|([^,\s]+)/g)).map(
      (m) => (m[1] ?? m[2] ?? m[3] ?? '').trim(),
    )
    const values = seriesMatch[2]
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n))

    const len = Math.min(labels.length, values.length)
    if (len === 0) return null

    return {
      type: 'series',
      kind: seriesMatch[1].toLowerCase() === 'line' ? 'line' : 'bar',
      title,
      xLabel: xAxisBracket[1]?.trim() || 'Category',
      yLabel: yAxisMatch?.[1]?.trim() || 'Value',
      points: Array.from({ length: len }, (_, i) => ({
        label: labels[i],
        value: values[i],
      })),
    }
  }

  if (/^\s*(?:%%\{[\s\S]*?\}%%\s*)?pie\b/i.test(trimmed)) {
    const sliceMatches = Array.from(trimmed.matchAll(/"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?)/g))
    if (sliceMatches.length === 0) return null
    return {
      type: 'series',
      kind: 'pie',
      title,
      xLabel: 'Category',
      yLabel: 'Value',
      points: sliceMatches.map((m) => ({
        label: m[1].trim(),
        value: Number(m[2]),
      })),
    }
  }

  return null
}
