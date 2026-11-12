import type { ReactNode } from 'react'

/**
 * One number with a label.
 *
 * The value uses tabular figures so a row of metrics lines up on the decimal
 * point, which is what makes a dashboard read as measured rather than
 * decorative.
 */

export interface MetricProps {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
}

export function Metric({ label, value, hint, icon }: MetricProps) {
  return (
    <div className="dash-metric">
      {icon ? <span className="dash-metric-icon">{icon}</span> : null}
      <span className="dash-metric-value">{value}</span>
      <span className="dash-metric-label">{label}</span>
      {hint ? <span className="dash-metric-hint">{hint}</span> : null}
    </div>
  )
}
