import { useId, useMemo } from 'react'
import type { ElbowChartData, ElbowPoint } from '../../core/types'
import { formatCompact } from '../../core/utils/format'

/**
 * Annotated elbow chart.
 *
 * Mermaid cannot draw a circle around one datum or attach an "optimal rank"
 * callout. This SVG renderer draws the curve, a subtle area fill, every rank,
 * and a clearly circled elbow with a dashed guide and label.
 */

const WIDTH = 760
const HEIGHT = 420
const MARGIN = { top: 64, right: 32, bottom: 64, left: 76 }

const COLORS = {
  ink: '#111827',
  secondary: '#4b5563',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  line: '#2563eb',
  point: '#1d4ed8',
  elbow: '#dc2626',
  elbowSoft: '#fee2e2',
} as const

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const target = value * 1.06
  const exponent = Math.floor(Math.log10(target))
  const magnitude = 10 ** exponent
  const fraction = target / magnitude
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return niceFraction * magnitude
}

function closestPoint(points: ElbowPoint[], elbowX: number): ElbowPoint {
  return points.reduce((best, point) =>
    Math.abs(point.x - elbowX) < Math.abs(best.x - elbowX) ? point : best,
  )
}

/** Parses #rgb / #rrggbb / #rrggbbaa into an approximate relative luminance. */
function colorLuminance(color: string): number | null {
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

function annotationBackground(color: string): string {
  const luminance = colorLuminance(color)
  return luminance !== null && luminance > 0.55 ? '#111827' : '#ffffff'
}

export function ElbowChart({ data }: { data: ElbowChartData }) {
  const gradientId = `elbow-fill-${useId().replace(/:/g, '')}`
  const points = data.points
  const elbow = closestPoint(points, data.elbowX)
  // In the app the title follows the active theme; exports override this to ink
  // (or the agent-requested color) so it stays readable on a white document.
  const textColor = data.textColor ?? 'var(--text)'
  const annotationColor = data.textColor ?? COLORS.elbow
  const annotationFill = annotationBackground(annotationColor)

  const geometry = useMemo(() => {
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    const rawMax = Math.max(...points.map((point) => point.y), 0)
    const rawMin = Math.min(...points.map((point) => point.y), 0)
    const yMax = niceMax(rawMax)
    const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0
    const xMin = Math.min(...points.map((point) => point.x))
    const xMax = Math.max(...points.map((point) => point.x))
    const xSpan = xMax - xMin || 1
    const ySpan = yMax - yMin || 1

    const x = (value: number) =>
      MARGIN.left + ((value - xMin) / xSpan) * plotWidth
    const y = (value: number) =>
      MARGIN.top + plotHeight - ((value - yMin) / ySpan) * plotHeight

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.x)},${y(point.y)}`)
      .join(' ')

    const area = `${line} L${x(points[points.length - 1].x)},${MARGIN.top + plotHeight} L${x(points[0].x)},${MARGIN.top + plotHeight} Z`
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = yMin + (ySpan * index) / 4
      return { value, y: y(value) }
    })

    return { plotWidth, plotHeight, xMax, xMin, x, y, line, area, yTicks }
  }, [points])

  const elbowX = geometry.x(elbow.x)
  const elbowY = geometry.y(elbow.y)
  const calloutLabel = data.elbowLabel || `Elbow at ${elbow.x}`
  const calloutWidth = Math.max(112, calloutLabel.length * 7.4 + 26)
  const calloutX = Math.min(
    WIDTH - MARGIN.right - calloutWidth / 2,
    Math.max(MARGIN.left + calloutWidth / 2, elbowX),
  )
  const calloutY = Math.max(MARGIN.top + 18, elbowY - 30)
  const xLabelStep = Math.ceil(points.length / 12)

  return (
    <div className="elbow-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${data.title}. ${calloutLabel}.`}
        data-export-text-color={data.textColor ?? undefined}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.line} stopOpacity="0.22" />
            <stop offset="100%" stopColor={COLORS.line} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <text
          className="elbow-chart-text"
          x={WIDTH / 2}
          y={30}
          textAnchor="middle"
          style={{ fill: textColor }}
          fontSize="18"
          fontWeight="700"
        >
          {data.title}
        </text>
        {data.note ? (
          <text
            className="elbow-chart-text"
            x={WIDTH / 2}
            y={50}
            textAnchor="middle"
            style={{ fill: textColor }}
            fontSize="12"
          >
            {data.note}
          </text>
        ) : null}

        {geometry.yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={MARGIN.left}
              y1={tick.y}
              x2={WIDTH - MARGIN.right}
              y2={tick.y}
              stroke={COLORS.grid}
              strokeWidth="1"
            />
            <text
              className="elbow-chart-text"
              x={MARGIN.left - 12}
              y={tick.y + 4}
              textAnchor="end"
              style={{ fill: textColor }}
              fontSize="11"
            >
              {formatCompact(tick.value)}
            </text>
          </g>
        ))}

        <line
          x1={MARGIN.left}
          y1={MARGIN.top}
          x2={MARGIN.left}
          y2={HEIGHT - MARGIN.bottom}
          stroke={COLORS.axis}
          strokeWidth="1.5"
        />
        <line
          x1={MARGIN.left}
          y1={HEIGHT - MARGIN.bottom}
          x2={WIDTH - MARGIN.right}
          y2={HEIGHT - MARGIN.bottom}
          stroke={COLORS.axis}
          strokeWidth="1.5"
        />

        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path
          d={geometry.line}
          fill="none"
          stroke={COLORS.line}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point) => (
          <circle
            key={point.x}
            cx={geometry.x(point.x)}
            cy={geometry.y(point.y)}
            r="4"
            fill="#ffffff"
            stroke={COLORS.point}
            strokeWidth="2"
          />
        ))}

        <line
          x1={elbowX}
          y1={elbowY}
          x2={elbowX}
          y2={HEIGHT - MARGIN.bottom}
          stroke={COLORS.elbow}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.65"
        />
        <circle
          cx={elbowX}
          cy={elbowY}
          r="16"
          fill={COLORS.elbowSoft}
          fillOpacity="0.35"
          stroke={COLORS.elbow}
          strokeWidth="2.5"
        />
        <circle cx={elbowX} cy={elbowY} r="5.5" fill={COLORS.elbow} />

        <rect
          x={calloutX - calloutWidth / 2}
          y={calloutY - 22}
          width={calloutWidth}
          height="26"
          rx="13"
          fill={annotationFill}
          stroke={annotationColor}
          strokeWidth="1.5"
        />
        <text
          className="elbow-chart-annotation"
          x={calloutX}
          y={calloutY - 4}
          textAnchor="middle"
          style={{ fill: annotationColor }}
          fontSize="12"
          fontWeight="700"
        >
          {calloutLabel}
        </text>

        {points.map((point, index) =>
          index % xLabelStep === 0 || index === points.length - 1 ? (
            <text
              key={`label-${point.x}`}
              className="elbow-chart-text"
              x={geometry.x(point.x)}
              y={HEIGHT - MARGIN.bottom + 20}
              textAnchor="middle"
              style={{ fill: textColor }}
              fontSize="11"
            >
              {String(point.x)}
            </text>
          ) : null,
        )}

        <text
          className="elbow-chart-text"
          x={(MARGIN.left + WIDTH - MARGIN.right) / 2}
          y={HEIGHT - 18}
          textAnchor="middle"
          style={{ fill: textColor }}
          fontSize="12"
          fontWeight="600"
        >
          {data.xLabel}
        </text>
        <text
          className="elbow-chart-text"
          x={18}
          y={(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}
          textAnchor="middle"
          style={{ fill: textColor }}
          fontSize="12"
          fontWeight="600"
          transform={`rotate(-90 18 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2})`}
        >
          {data.yLabel}
        </text>
      </svg>
    </div>
  )
}
