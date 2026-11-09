import { READ_ONLY_STATEMENTS } from '../constants'

export function quoteIdent(identifier: string): string {
  const safe = typeof identifier === 'string' ? identifier : String(identifier ?? '')
  return `"${safe.replace(/"/g, '""')}"`
}

export function quoteString(value: string): string {
  const safe = typeof value === 'string' ? value : String(value ?? '')
  return `'${safe.replace(/'/g, "''")}'`
}

export function qualifiedName(schemaName: string, tableName: string): string {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`
}

export function normalizeIdentifier(value: string, fallback: string): string {
  const str = typeof value === 'string' ? value : String(value ?? '')
  const fb = typeof fallback === 'string' ? fallback : 'data'
  const cleaned = str
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)

  const candidate = cleaned.length > 0 ? cleaned : fb
  return /^[0-9]/.test(candidate) ? `t_${candidate}` : candidate
}

export function uniqueIdentifier(base: string, used: Set<string>): string {
  let candidate = typeof base === 'string' && base.length > 0 ? base : 'data'
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}_${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

export function stripFileName(fileName: string): string {
  const str = typeof fileName === 'string' ? fileName : 'data'
  const withoutPath = str.split(/[\\/]/).pop() ?? str
  return withoutPath.replace(/\.[^.]+$/, '')
}

export function buildSchemaName(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase()
  return `sess_${compact || 'data'}`
}

function scrubSql(sql: string): string {
  let output = ''
  let index = 0
  let quote: '"' | "'" | '`' | null = null

  while (index < sql.length) {
    const char = sql[index]
    const next = sql[index + 1]

    if (quote) {
      if (char === quote) {
        if (next === quote) {
          index += 2
          continue
        }
        quote = null
      }
      index += 1
      continue
    }

    if (char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') index += 1
      continue
    }

    if (char === '/' && next === '*') {
      index += 2
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) index += 1
      index += 2
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      output += ' '
      index += 1
      continue
    }

    output += char
    index += 1
  }

  return output.trim()
}

export function assertReadOnlySql(sql: string): void {
  const scrubbed = scrubSql(sql)
  if (!scrubbed) {
    throw new Error('The SQL statement is empty.')
  }

  const statements = scrubbed
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (statements.length !== 1) {
    throw new Error('Only one read-only SQL statement can run at a time.')
  }

  const firstWord = statements[0].split(/\s+/)[0]?.toUpperCase() ?? ''
  const allowed = READ_ONLY_STATEMENTS.some((keyword) => firstWord === keyword)
  if (!allowed) {
    throw new Error(
      `Blocked "${firstWord || 'unknown'}" statement. The analytics tool only runs read-only queries (SELECT, WITH, DESCRIBE, SHOW, SUMMARIZE, EXPLAIN).`,
    )
  }
}

export function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') {
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(value)
    }
    return value.toString()
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return `[binary ${value.byteLength} bytes]`
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, (_key, nested: unknown) =>
        typeof nested === 'bigint' ? nested.toString() : nested,
      )
    } catch {
      return String(value)
    }
  }
  return String(value)
}
