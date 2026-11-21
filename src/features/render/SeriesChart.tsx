import { useId, useMemo } from 'react'
import type { SeriesChartData } from '../../core/types'
import { annotationBackground, CHART_COLORS, niceMax } from './chartTheme'

/** Bar, line, pie, and scatter figures with direct bar labels and optional highlight. */
const WIDTH = 680
const HEIGHT = 342
const MARGIN = { top: 56, right: 28, bottom: 74, left: 64 }

function cleanChartText(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/\s*[([][nN]\s*=\s*\d+\s*[)\]]/g, '')
    .replace(/(-?\d+)\.(\d{2,})(%?)/g, (_m, intP: string, decP: string, pct: string) => {
      const n = Number.parseFloat(`${intP}.${decP}`)
      if (!Number.isFinite(n)) return _m
      const r = Math.round(n * 10) / 10
      return `${Number.isInteger(r) ? String(r) : r.toFixed(1)}${pct}`
    })
    .trim()
}

function formatChartNum(val: number): string {
  if (!Number.isFinite(val)) return '0'
  const abs = Math.abs(val)
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 10_000) return `${(val / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  const rounded = Math.round(val * 10) / 10
  return Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : rounded.toFixed(1)
}

function shortenLabel(label: string, maxLen = 15): string {
  const clean = cleanChartText(label)
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean
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
  const uid = useId().replace(/:/g, '')
  const barGradId = `bar-grad-${uid}`
  const hiGradId = `hi-grad-${uid}`
  const areaGradId = `area-grad-${uid}`

  const textColor = data.textColor ?? 'var(--text)'
  const highlightColor = data.textColor ?? CHART_COLORS.highlight
  const cleanTitle = cleanChartText(data.title)
  const cleanNote = cleanChartText(data.note)
  const cleanXLabel = cleanChartText(data.xLabel)
  const cleanYLabel = cleanChartText(data.yLabel)
  const isPercentAxis = /%|percent|rate|share/i.test(`${cleanTitle} ${cleanYLabel}`)

  const pieSlices = useMemo(() => {
    const rawPoints = Array.isArray(data?.points) ? data.points : []
    const positive = rawPoints
      .map((p, idx) => ({
        label: cleanChartText(p?.label) || `Item ${idx + 1}`,
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
    const yMax = niceMax(rawMax * 1.08)
    const yMin = rawMin < 0 ? -niceMax(-rawMin) : 0
    const ySpan = yMax - yMin || 1
    const count = Math.max(pointsList.length, 1)
    const slot = plotWidth / count
    const barWidth = Math.max(8, Math.min(44, slot * 0.56))

    const y = (value: number) =>
      MARGIN.top + plotHeight - ((value - yMin) / ySpan) * plotHeight
    const centerX = (index: number) => MARGIN.left + slot * (index + 0.5)

    const points = pointsList.map((point, index) => ({
      ...point,
      label: cleanChartText(point?.label),
      index,
      x: centerX(index),
      y: y(point?.value ?? 0),
    }))
    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ')
    const area =
      points.length > 1
        ? `${line} L${points[points.length - 1].x},${MARGIN.top + plotHeight} L${points[0].x},${MARGIN.top + plotHeight} Z`
        : ''
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = yMin + (ySpan * index) / 4
      return { value, y: y(value) }
    })

    return { plotWidth, plotHeight, points, line, area, yTicks, barWidth, slot }
  }, [data?.points])

  const highlighted =
    data?.highlightIndex !== undefined && geometry.points[data.highlightIndex]
      ? geometry.points[data.highlightIndex]
      : undefined
  const calloutLabel = cleanChartText(
    data?.highlightLabel ??
      (highlighted
        ? `${highlighted.label ?? ''}: ${formatChartNum(highlighted.value ?? 0)}${isPercentAxis ? '%' : ''}`
        : ''),
  )
  const calloutWidth = Math.max(96, (calloutLabel?.length ?? 0) * 6.8 + 22)
  const calloutX = highlighted
    ? Math.min(
        WIDTH - MARGIN.right - calloutWidth / 2,
        Math.max(MARGIN.left + calloutWidth / 2, highlighted.x),
      )
    : 0
  const calloutY = highlighted ? Math.max(MARGIN.top + 16, highlighted.y - 26) : 0
  const labelStep = Math.ceil(Math.max(geometry.points.length, 1) / 12)
  const rotateLabels = geometry.points.length >= 2

  if (data.kind === 'pie') {
    const cx = 210
    const cy = 186
    const rOuter = 104
    const rInner = 46
    return (
      <div className="series-chart">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${cleanTitle}. pie chart.`}
          data-export-text-color={data.textColor ?? undefined}
        >
          <text
            className="series-chart-text"
            x={WIDTH / 2}
            y={26}
            textAnchor="middle"
            style={{ fill: textColor }}
            fontSize="15"
            fontWeight="700"
          >
            {cleanTitle}
          </text>
          {cleanNote ? (
            <text
              className="series-chart-text"
              x={WIDTH / 2}
              y={44}
              textAnchor="middle"
              style={{ fill: textColor, opacity: 0.75 }}
              fontSize="11.5"
            >
              {cleanNote}
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
            const legendY = 78 + idx * 24
            const pctText = `${Number.isInteger(slice.pct) ? slice.pct : slice.pct.toFixed(1)}%`
            return (
              <g key={`legend-${slice.index}`} transform={`translate(370, ${legendY})`}>
                <rect x={0} y={-9} width={11} height={11} rx={3} fill={slice.color} />
                <text
                  className="series-chart-text"
                  x={18}
                  y={0}
                  style={{ fill: textColor }}
                  fontSize="11.5"
                  fontWeight="600"
                >
                  {shortenLabel(slice.label, 20)}
                </text>
                <text
                  className="series-chart-text"
                  x={260}
                  y={0}
                  textAnchor="end"
                  style={{ fill: textColor }}
                  fontSize="11.5"
                  fontWeight="600"
                >
                  {pctText}
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
        aria-label={`${cleanTitle}. ${data.kind} chart.`}
        data-export-text-color={data.textColor ?? undefined}
      >
        <defs>
          <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id={hiGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.line} stopOpacity="0.2" />
            <stop offset="100%" stopColor={CHART_COLORS.line} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <text
          className="series-chart-text"
          x={WIDTH / 2}
          y={24}
          textAnchor="middle"
          style={{ fill: textColor }}
          fontSize="15"
          fontWeight="700"
        >
          {cleanTitle}
        </text>
        {cleanNote ? (
          <text
            className="series-chart-text"
            x={WIDTH / 2}
            y={42}
            textAnchor="middle"
            style={{ fill: textColor, opacity: 0.75 }}
            fontSize="11"
          >
            {cleanNote}
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
              strokeDasharray="3 3"
            />
            <text
              className="series-chart-text"
              x={MARGIN.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              style={{ fill: textColor, opacity: 0.78 }}
              fontSize="10.5"
            >
              {formatChartNum(tick.value)}
            </text>
          </g>
        ))}

        <line
          x1={MARGIN.left}
          y1={HEIGHT - MARGIN.bottom}
          x2={WIDTH - MARGIN.right}
          y2={HEIGHT - MARGIN.bottom}
          stroke={CHART_COLORS.axis}
          strokeWidth="1.2"
        />

        {data.kind === 'bar'
          ? geometry.points.map((point) => {
              const top = Math.min(point.y, HEIGHT - MARGIN.bottom)
              const height = Math.max(2, HEIGHT - MARGIN.bottom - point.y)
              const active = point.index === data.highlightIndex
              const valLabel = `${formatChartNum(point.value ?? 0)}${isPercentAxis ? '%' : ''}`
              return (
                <g key={`${point.label}-${point.index}`}>
                  <rect
                    x={point.x - geometry.barWidth / 2}
                    y={top}
                    width={geometry.barWidth}
                    height={height}
                    rx="4"
                    fill={active ? `url(#${hiGradId})` : `url(#${barGradId})`}
                  />
                  {geometry.points.length <= 14 && !active ? (
                    <text
                      className="series-chart-text"
                      x={point.x}
                      y={Math.max(MARGIN.top - 4, top - 6)}
                      textAnchor="middle"
                      style={{ fill: textColor }}
                      fontSize="10"
                      fontWeight="600"
                    >
                      {valLabel}
                    </text>
                  ) : null}
                </g>
              )
            })
          : null}

        {data.kind === 'line' ? (
          <>
            {geometry.area ? <path d={geometry.area} fill={`url(#${areaGradId})`} /> : null}
            <path
              d={geometry.line}
              fill="none"
              stroke={CHART_COLORS.line}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : null}

        {data.kind !== 'bar'
          ? geometry.points.map((point) => (
              <circle
                key={`${point.label}-${point.index}`}
                cx={point.x}
                cy={point.y}
                r={data.kind === 'scatter' ? 4.5 : 3.5}
                fill="#ffffff"
                stroke={CHART_COLORS.point}
                strokeWidth="2"
              />
            ))
          : null}

        {highlighted ? (
          <>
            <rect
              x={calloutX - calloutWidth / 2}
              y={calloutY - 20}
              width={calloutWidth}
              height="22"
              rx="11"
              fill={annotationBackground(highlightColor)}
              stroke={highlightColor}
              strokeWidth="1.4"
            />
            <text
              className="series-chart-annotation"
              x={calloutX}
              y={calloutY - 5}
              textAnchor="middle"
              style={{ fill: highlightColor }}
              fontSize="11"
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
              y={HEIGHT - MARGIN.bottom + 14}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              transform={
                rotateLabels
                  ? `rotate(-25 ${point.x} ${HEIGHT - MARGIN.bottom + 14})`
                  : undefined
              }
              style={{ fill: textColor }}
              fontSize="10.5"
            >
              {shortenLabel(point.label, 16)}
            </text>
          ) : null,
        )}

        <text
          className="series-chart-text"
          x={(MARGIN.left + WIDTH - MARGIN.right) / 2}
          y={HEIGHT - 8}
          textAnchor="middle"
          style={{ fill: textColor, opacity: 0.85 }}
          fontSize="11"
          fontWeight="600"
        >
          {cleanXLabel}
        </text>
        <text
          className="series-chart-text"
          x={16}
          y={(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}
          textAnchor="middle"
          style={{ fill: textColor, opacity: 0.85 }}
          fontSize="11"
          fontWeight="600"
          transform={`rotate(-90 16 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2})`}
        >
          {cleanYLabel}
        </text>
      </svg>
    </div>
  )
}
