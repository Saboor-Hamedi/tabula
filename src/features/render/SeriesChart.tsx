import { useMemo } from 'react'
import type { SeriesChartData } from '../../core/types'
import { formatCompact } from '../../core/utils/format'
import { annotationBackground, CHART_COLORS, niceMax } from './chartTheme'

/** Bar, line and scatter figures with an optional highlighted point/category. */
const WIDTH = 760
const HEIGHT = 420
const MARGIN = { top: 64, right: 32, bottom: 64, left: 76 }

function shortenLabel(label: string): string {
  return label.length > 15 ? `${label.slice(0, 14)}…` : label
}

export function SeriesChart({ data }: { data: SeriesChartData }) {
  const textColor = data.textColor ?? 'var(--text)'
  const highlightColor = data.textColor ?? CHART_COLORS.highlight

  const geometry = useMemo(() => {
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    const rawMax = Math.max(...data.points.map((point) => point.value), 0)
    const rawMin = Math.min(...data.points.map((point) => point.value), 0)
    const yMax = niceMax(rawMax)
    const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0
    const ySpan = yMax - yMin || 1
    const slot = plotWidth / data.points.length
    const barWidth = Math.max(4, Math.min(54, slot * 0.62))

    const y = (value: number) =>
      MARGIN.top + plotHeight - ((value - yMin) / ySpan) * plotHeight
    const centerX = (index: number) => MARGIN.left + slot * (index + 0.5)

    const points = data.points.map((point, index) => ({
      ...point,
      index,
      x: centerX(index),
      y: y(point.value),
    }))
    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ')
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = yMin + (ySpan * index) / 4
      return { value, y: y(value) }
    })

    return { plotWidth, plotHeight, points, line, yTicks, barWidth, slot }
  }, [data.points])

  const highlighted =
    data.highlightIndex !== undefined ? geometry.points[data.highlightIndex] : undefined
  const calloutLabel =
    data.highlightLabel ??
    (highlighted ? `${highlighted.label}: ${formatCompact(highlighted.value)}` : '')
  const calloutWidth = Math.max(112, calloutLabel.length * 7.4 + 26)
  const calloutX = highlighted
    ? Math.min(
        WIDTH - MARGIN.right - calloutWidth / 2,
        Math.max(MARGIN.left + calloutWidth / 2, highlighted.x),
      )
    : 0
  const calloutY = highlighted
    ? Math.max(MARGIN.top + 18, highlighted.y - 30)
    : 0
  const labelStep = Math.ceil(data.points.length / 12)

  return (
    <div className="series-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${data.title}. ${data.kind} chart.`}
        data-export-text-color={data.textColor ?? undefined}
      >
        <text
          className="series-chart-text"
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
            className="series-chart-text"
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
              stroke={CHART_COLORS.grid}
              strokeWidth="1"
            />
            <text
              className="series-chart-text"
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
          stroke={CHART_COLORS.axis}
          strokeWidth="1.5"
        />
        <line
          x1={MARGIN.left}
          y1={HEIGHT - MARGIN.bottom}
          x2={WIDTH - MARGIN.right}
          y2={HEIGHT - MARGIN.bottom}
          stroke={CHART_COLORS.axis}
          strokeWidth="1.5"
        />

        {data.kind === 'bar'
          ? geometry.points.map((point) => {
              const top = Math.min(point.y, HEIGHT - MARGIN.bottom)
              const height = Math.max(1, HEIGHT - MARGIN.bottom - point.y)
              const active = point.index === data.highlightIndex
              return (
                <rect
                  key={`${point.label}-${point.index}`}
                  x={point.x - geometry.barWidth / 2}
                  y={top}
                  width={geometry.barWidth}
                  height={height}
                  rx="4"
                  fill={active ? highlightColor : CHART_COLORS.palette[point.index % CHART_COLORS.palette.length]}
                />
              )
            })
          : null}

        {data.kind === 'line' ? (
          <path
            d={geometry.line}
            fill="none"
            stroke={CHART_COLORS.line}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {data.kind !== 'bar'
          ? geometry.points.map((point) => (
              <circle
                key={`${point.label}-${point.index}`}
                cx={point.x}
                cy={point.y}
                r={data.kind === 'scatter' ? 5 : 4}
                fill="#ffffff"
                stroke={CHART_COLORS.point}
                strokeWidth="2"
              />
            ))
          : null}

        {highlighted ? (
          <>
            <line
              x1={highlighted.x}
              y1={highlighted.y}
              x2={highlighted.x}
              y2={HEIGHT - MARGIN.bottom}
              stroke={CHART_COLORS.highlight}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            <circle
              cx={highlighted.x}
              cy={highlighted.y}
              r="15"
              fill={CHART_COLORS.highlightSoft}
              fillOpacity="0.3"
              stroke={CHART_COLORS.highlight}
              strokeWidth="2.5"
            />
            <rect
              x={calloutX - calloutWidth / 2}
              y={calloutY - 22}
              width={calloutWidth}
              height="26"
              rx="13"
              fill={annotationBackground(highlightColor)}
              stroke={highlightColor}
              strokeWidth="1.5"
            />
            <text
              className="series-chart-annotation"
              x={calloutX}
              y={calloutY - 4}
              textAnchor="middle"
              style={{ fill: highlightColor }}
              fontSize="12"
              fontWeight="700"
            >
              {calloutLabel}
            </text>
          </>
        ) : null}

        {geometry.points.map((point, index) =>
          index % labelStep === 0 || index === geometry.points.length - 1 ? (
            <text
              key={`label-${point.index}`}
              className="series-chart-text"
              x={point.x}
              y={HEIGHT - MARGIN.bottom + 20}
              textAnchor="middle"
              style={{ fill: textColor }}
              fontSize="11"
            >
              {shortenLabel(point.label)}
            </text>
          ) : null,
        )}

        <text
          className="series-chart-text"
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
          className="series-chart-text"
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
