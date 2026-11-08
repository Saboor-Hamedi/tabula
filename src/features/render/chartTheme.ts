/** Shared colors and small numeric helpers for custom SVG figures. */
export const CHART_COLORS = {
  ink: '#111827',
  secondary: '#4b5563',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  line: '#2563eb',
  point: '#1d4ed8',
  highlight: '#dc2626',
  highlightSoft: '#fee2e2',
  palette: ['#2563eb', '#ea580c', '#16a34a', '#7c3aed', '#0891b2', '#ca8a04', '#db2777'],
} as const

export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const target = value * 1.06
  const exponent = Math.floor(Math.log10(target))
  const magnitude = 10 ** exponent
  const fraction = target / magnitude
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return niceFraction * magnitude
}

/** Parses #rgb / #rrggbb / #rrggbbaa into an approximate relative luminance. */
export function colorLuminance(color: string): number | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(color.trim())
  if (!match) return null
  const hex = match[1]
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => part + part)
          .join('')
      : hex.slice(0, 6)
  if (full.length < 6) return null
  const channels = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function annotationBackground(color: string): string {
  const luminance = colorLuminance(color)
  return luminance !== null && luminance > 0.55 ? CHART_COLORS.ink : '#ffffff'
}
