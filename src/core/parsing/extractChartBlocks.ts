import type { ChartData, ElbowChartData, ElbowPoint, RawBlock } from '../types'

/**
 * Structured figure fences.
 *
 * Mermaid xycharts cannot circle a specific point or add an "optimal rank"
 * callout. The agent can emit a ```chart JSON block instead; this module turns
 * it into a typed chart that the renderer can draw precisely.
 */

interface FenceState {
  char: string
  length: number
}

function isFenceLine(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})\s*$/)
  if (!match) return null
  return { char: match[1][0], length: match[1].length }
}

function isChartOpen(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})\s*(chart|elbow)\s*$/i)
  if (!match) return null
  return { char: match[1][0], length: match[1].length }
}

function isClosingFence(line: string, fence: FenceState): boolean {
  const state = isFenceLine(line)
  return state !== null && state.char === fence.char && state.length >= fence.length
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readPoints(record: Record<string, unknown>): ElbowPoint[] {
  const source = Array.isArray(record.points)
    ? record.points
    : Array.isArray(record.data)
      ? record.data
      : []

  const points: ElbowPoint[] = []
  for (const entry of source) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const x = Number(entry[0])
      const y = Number(entry[1])
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y })
      continue
    }

    const point = asRecord(entry)
    if (!point) continue
    const x = readNumber(point, 'x')
    const y = readNumber(point, 'y')
    if (x !== null && y !== null) points.push({ x, y })
  }

  return points.sort((left, right) => left.x - right.x)
}

/** Finds the point farthest from the chord between the first and last points. */
function detectElbow(points: ElbowPoint[]): number {
  if (points.length < 3) return points[0]?.x ?? 1
  const first = points[0]
  const last = points[points.length - 1]
  const dx = last.x - first.x
  const dy = last.y - first.y
  const length = Math.hypot(dx, dy) || 1

  let best = first.x
  let bestDistance = -1
  for (const point of points.slice(1, -1)) {
    const distance = Math.abs(
      dy * point.x - dx * point.y + last.x * first.y - last.y * first.x,
    ) / length
    if (distance > bestDistance) {
      bestDistance = distance
      best = point.x
    }
  }
  return best
}

function parseElbow(record: Record<string, unknown>): ElbowChartData | null {
  const points = readPoints(record)
  if (points.length < 2) return null

  const requested = readNumber(record, 'elbowX') ?? readNumber(record, 'elbow')
  const elbowX = requested ?? detectElbow(points)
  const closest = points.reduce((best, point) =>
    Math.abs(point.x - elbowX) < Math.abs(best.x - elbowX) ? point : best,
  )

  const note = record.note
  const textColor = record.textColor
  return {
    type: 'elbow',
    title: readString(record, 'title', 'Elbow analysis'),
    xLabel: readString(record, 'xLabel', 'Rank'),
    yLabel: readString(record, 'yLabel', 'Score'),
    points,
    elbowX: closest.x,
    elbowLabel: readString(record, 'elbowLabel', `Elbow at ${closest.x}`),
    note: typeof note === 'string' && note.trim().length > 0 ? note.trim() : undefined,
    textColor:
      typeof textColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(textColor.trim())
        ? textColor.trim()
        : undefined,
  }
}

/** Converts the fence body into a chart, or null when the JSON is invalid. */
export function parseChartCode(code: string): ChartData | null {
  try {
    const parsed: unknown = JSON.parse(code)
    const record = asRecord(parsed)
    if (!record) return null
    if (record.type === 'elbow') return parseElbow(record)
    return null
  } catch {
    return null
  }
}

export function extractChartBlocks(text: string): RawBlock[] {
  const lines = text.split('\n')
  const blocks: RawBlock[] = []
  let buffer: string[] = []
  let openFence: FenceState | null = null
  let chartLines: string[] = []

  const flushMarkdown = () => {
    if (buffer.length === 0) return
    const content = buffer.join('\n')
    if (content.trim().length > 0) blocks.push({ type: 'markdown', content })
    buffer = []
  }

  for (const line of lines) {
    if (openFence) {
      if (isClosingFence(line, openFence)) {
        const code = chartLines.join('\n').trim()
        const chart = parseChartCode(code)
        if (chart) {
          blocks.push({ type: 'chart', chart })
        } else {
          buffer.push('```chart', ...chartLines, '```')
        }
        chartLines = []
        openFence = null
      } else {
        chartLines.push(line)
      }
      continue
    }

    const fence = isChartOpen(line)
    if (fence) {
      flushMarkdown()
      openFence = fence
      continue
    }

    buffer.push(line)
  }

  if (openFence) {
    buffer.push('```chart', ...chartLines, '```')
  }

  flushMarkdown()
  return blocks
}
