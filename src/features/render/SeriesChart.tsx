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

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArcSlice(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const clampedEnd = Math.min(endAngle, startAngle + 359.95)
  const startOuter = polarToCartesian(cx, cy, rOuter, clampedEnd)
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle)
  const startInner = polarToCartesian(cx, cy, rInner, startAngle)
  const endInner = polarToCartesian(cx, cy, rInner, clampedEnd)
  const largeArc = clampedEnd - startAngle <= 180 ? '0' : '1'
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

export function SeriesChart({ data }: { data: SeriesChartData }) {
  const textColor = data.textColor ?? 'var(--text)'
  const highlightColor = data.textColor ?? CHART_COLORS.highlight

  const pieSlices = useMemo(() => {
    const rawPoints = Array.isArray(data?.points) ? data.points : []
    const positive = rawPoints
      .map((p, idx) => ({
        label: p?.label ?? `Item ${idx + 1}`,
        value: Math.max(0, Number(p?.value) || 0),
        index: idx,
      }))
      .filter((p) => p.value > 0)
    const total = positive.reduce((sum, p) => sum + p.value, 0) || 1
    let angle = 0
    return positive.slice(0, 10).map((item, sliceIdx) => {
      const span = (item.value / total) * 360
      const startAngle = angle
      const endAngle = angle + span
      angle = endAngle
      const pct = Math.round((item.value / total) * 1000) / 10
      const color =
        item.index === data.highlightIndex
          ? highlightColor
          : CHART_COLORS.palette[sliceIdx % CHART_COLORS.palette.length]
      return {
        ...item,
        startAngle,
        endAngle,
        pct,
        color,
      }
    })
  }, [data?.points, data.highlightIndex, highlightColor])

  const geometry = useMemo(() => {
    const pointsList = Array.isArray(data?.points) ? data.points : []
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    const rawMax = Math.max(...pointsList.map((point) => point?.value ?? 0), 0)
    const rawMin = Math.min(...pointsList.map((point) => point?.value ?? 0), 0)
    const yMax = niceMax(rawMax)
    const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0
    const ySpan = yMax - yMin || 1
    const count = Math.max(pointsList.length, 1)
    const slot = plotWidth / count
    const barWidth = Math.max(4, Math.min(54, slot * 0.62))

    const y = (value: number) =>
      MARGIN.top + plotHeight - ((value - yMin) / ySpan) * plotHeight
    const centerX = (index: number) => MARGIN.left + slot * (index + 0.5)

    const points = pointsList.map((point, index) => ({
      ...point,
      index,
      x: centerX(index),
      y: y(point?.value ?? 0),
    }))
    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ')
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = yMin + (ySpan * index) / 4
      return { value, y: y(value) }
    })

    return { plotWidth, plotHeight, points, line, yTicks, barWidth, slot }
  }, [data?.points])

  const highlighted =
    data?.highlightIndex !== undefined && geometry.points[data.highlightIndex]
      ? geometry.points[data.highlightIndex]
      : undefined
  const calloutLabel =
    data?.highlightLabel ??
    (highlighted ? `${highlighted.label ?? ''}: ${formatCompact(highlighted.value ?? 0)}` : '')
  const calloutWidth = Math.max(112, (calloutLabel?.length ?? 0) * 7.4 + 26)
  const calloutX = highlighted
    ? Math.min(
        WIDTH - MARGIN.right - calloutWidth / 2,
        Math.max(MARGIN.left + calloutWidth / 2, highlighted.x),
      )
    : 0
  const calloutY = highlighted
    ? Math.max(MARGIN.top + 18, highlighted.y - 30)
    : 0
  const labelStep = Math.ceil(Math.max(geometry.points.length, 1) / 12)

  if (data.kind === 'pie') {
    const cx = 240
    const cy = 236
    const rOuter = 132
    const rInner = 56
    return (
      <div className="series-chart">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${data.title}. pie chart.`}
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

          {pieSlices.map((slice) => (
            <path
              key={`${slice.label}-${slice.index}`}
              d={describeArcSlice(cx, cy, rOuter, rInner, slice.startAngle, slice.endAngle)}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          {pieSlices.map((slice, idx) => {
            const legendY = 92 + idx * 28
            return (
              <g key={`legend-${slice.index}`} transform={`translate(430, ${legendY})`}>
                <rect x={0} y={-10} width={12} height={12} rx={3} fill={slice.color} />
                <text
                  className="series-chart-text"
                  x={20}
                  y={0}
                  style={{ fill: textColor }}
                  fontSize="12"
                  fontWeight="600"
                >
                  {shortenLabel(slice.label)}
                </text>
                <text
                  className="series-chart-text"
                  x={280}
                  y={0}
                  textAnchor="end"
                  style={{ fill: textColor }}
                  fontSize="12"
                >
                  {formatCompact(slice.value)} ({slice.pct}%)
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

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
