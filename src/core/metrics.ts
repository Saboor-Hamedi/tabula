/** Tiny local performance log; never sent anywhere unless telemetry is enabled. */
const metrics = new Map<string, number>()

export function recordMetric(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) return
  metrics.set(name, Math.round(value))
}

export function getMetrics(): Record<string, number> {
  return Object.fromEntries(metrics)
}
