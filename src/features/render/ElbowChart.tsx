import { useId, useMemo } from 'react'
import type { ElbowChartData, ElbowPoint } from '../../core/types'
import { formatCompact } from '../../core/utils/format'
import { annotationBackground, CHART_COLORS, niceMax } from './chartTheme'

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
  ...CHART_COLORS,
  elbow: CHART_COLORS.highlight,
  elbowSoft: CHART_COLORS.highlightSoft,
} as const

function closestPoint(points: ElbowPoint[], elbowX: number): ElbowPoint {
  if (!points || points.length === 0) return { x: 0, y: 0 }
  return points.reduce((best, point) =>
    Math.abs(point.x - elbowX) < Math.abs(best.x - elbowX) ? point : best,
  )
}

export function ElbowChart({ data }: { data: ElbowChartData }) {
  const gradientId = `elbow-fill-${useId().replace(/:/g, '')}`
  const points = Array.isArray(data?.points) ? data.points : []
  const elbow = closestPoint(points, data?.elbowX ?? 0)
  // In the app the title follows the active theme; exports override this to ink
  // (or the agent-requested color) so it stays readable on a white document.
  const textColor = data?.textColor ?? 'var(--text)'
  const annotationColor = data?.textColor ?? COLORS.elbow
  const annotationFill = annotationBackground(annotationColor)

  const geometry = useMemo(() => {
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    const rawMax = Math.max(...points.map((point) => point?.y ?? 0), 0)
    const rawMin = Math.min(...points.map((point) => point?.y ?? 0), 0)
    const yMax = niceMax(rawMax)
    const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0
    const xMin = points.length > 0 ? Math.min(...points.map((point) => point?.x ?? 0)) : 0
    const xMax = points.length > 0 ? Math.max(...points.map((point) => point?.x ?? 0)) : 1
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
