const numberFormatter = new Intl.NumberFormat('en-US')

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFormatter.format(value)
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const keep = Math.max(1, Math.floor((maxLength - 1) / 2))
  return `${value.slice(0, keep)}…${value.slice(value.length - keep)}`
}

export function safeStringify(value: unknown, spacing = 2): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(
      value,
      (_key, nested: unknown) => {
        if (typeof nested === 'bigint') return nested.toString()
        if (nested instanceof Date) return nested.toISOString()
        if (typeof nested === 'object' && nested !== null) {
          if (seen.has(nested)) return '[circular]'
          seen.add(nested)
        }
        return nested
      },
      spacing,
    )
  } catch {
    return String(value)
  }
}
