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
