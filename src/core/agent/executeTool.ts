import type { DuckDBHandle } from '../duckdb/initDuckDB'
import { listTables, tableExists } from '../duckdb/listTables'
import { runSQL } from '../duckdb/runSQL'
import { profileTable } from '../profiling/profileTable'
import { runPython } from '../python'
import { DIGEST_MAX_TABLES, MAX_AGENT_STEPS, MAX_RESULT_ROWS } from '../constants'
import type { PythonExecutionResult } from '../python'
import type { TableProfile, TableSummary, ToolName, ToolResultPayload, ToolTraceEntry } from '../types'
import { compactPythonToolResult, stripCodeFences } from '../../tabula/utils/agentHelpers'
import {
  createTraceEntry,
  createTraceId,
  summarizeToolError,
  summarizeToolResult,
  truncateDetail,
} from './trace'

export interface ToolContext {
  handle: DuckDBHandle
  sessionId: string
  schemaName: string
  tableNames: string[]
  tables: TableSummary[]
  onTrace: (entry: ToolTraceEntry) => void
  onPythonResult?: (result: PythonExecutionResult) => void
}

const CACHE_LIMIT = 40
const queryCache = new Map<string, ToolResultPayload>()
const schemaCache = new Map<string, ToolResultPayload>()

function cacheResult(
  cache: Map<string, ToolResultPayload>,
  key: string,
  value: ToolResultPayload,
): ToolResultPayload {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
  return value
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase()
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function inspectSchema(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResultPayload> {
  const requestedTable = readString(args, 'table')
  const cacheKey = `${context.schemaName}:${requestedTable?.toLowerCase() ?? '*'}`
  const cached = schemaCache.get(cacheKey)
  if (cached) return { ...cached, cached: true }

  const available = Array.isArray(context.tableNames) && context.tableNames.length > 0
    ? context.tableNames
    : (await listTables(context.handle.connection, context.schemaName)).map((table) => table.name)

  if (!available || available.length === 0) {
    return {
      error: 'This session has no tables. Ask the user to upload a CSV or XLSX file.',
      schema: context.schemaName,
      tables: [],
    }
  }

  const safeTables = Array.isArray(context.tables) ? context.tables : []
  const ranked = [...safeTables].sort(
    (left, right) => (right.rowCount ?? 0) - (left.rowCount ?? 0) || (right.columnCount ?? 0) - (left.columnCount ?? 0),
  )
  const rankedNames = ranked
    .map((table) => table?.name)
    .filter((name): name is string => typeof name === 'string')

  const tablesToProfile: string[] = []
  if (requestedTable) {
    const match = available.find((name) => name.toLowerCase() === requestedTable.toLowerCase())
    if (!match) {
      return {
        error: `Table "${requestedTable}" was not found.`,
        availableTables: available.slice(0, 50),
        availableTableCount: available.length,
        hint: 'Pass the exact table name, or omit it to inspect the largest tables.',
      }
    }
    tablesToProfile.push(match)
  } else {
    const ordered = rankedNames.filter((name) => available.includes(name))
    tablesToProfile.push(...(ordered.length > 0 ? ordered : available).slice(0, DIGEST_MAX_TABLES))
  }

  const profiles: TableProfile[] = []
  for (const tableName of tablesToProfile) {
    try {
      const exists = await tableExists(context.handle.connection, context.schemaName, tableName)
      if (!exists) continue
      profiles.push(await profileTable(context.handle.connection, context.schemaName, tableName))
    } catch {
      // Ignore profiling failures on damaged tables
    }
  }

  return cacheResult(schemaCache, cacheKey, {
    engine: 'DuckDB (in-memory)',
    schema: context.schemaName,
    scope: requestedTable ? 'single_table' : 'largest_tables',
    tableCount: profiles.length,
    totalTableCount: available.length,
    tables: profiles,
    maxAgentSteps: MAX_AGENT_STEPS,
    guidance:
      available.length > profiles.length
        ? `This workbook has ${available.length} tables. The largest ${profiles.length} are shown. Ask for a specific table by exact name when needed.`
        : 'Use the exact column names and types shown above. The schema is already on the search_path, so unqualified table names work. Explore distributions, nulls, cardinality, group-bys, and time trends before answering.',
  })
}

async function runSql(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResultPayload> {
  const rawSql = readString(args, 'sql')
  if (!rawSql) {
    return { error: 'The "sql" argument is required and must be a non-empty string.' }
  }
  const sql = stripCodeFences(rawSql)

  const purpose = readString(args, 'purpose')
  const cacheKey = `${context.schemaName}:${normalizeSql(sql)}`
  const cached = queryCache.get(cacheKey)
  if (cached) return { ...cached, cached: true }

  const limitMatch = /\blimit\s+(\d+)\b/i.exec(sql)
  const explicitLimit = limitMatch ? parseInt(limitMatch[1], 10) : undefined
  const effectiveMaxRows = explicitLimit && explicitLimit > 0
    ? Math.min(Math.max(explicitLimit, MAX_RESULT_ROWS), 500)
    : MAX_RESULT_ROWS

  const result = await runSQL({
    handle: context.handle,
    sql,
    schemaName: context.schemaName,
    maxRows: effectiveMaxRows,
    readOnly: true,
  })

  return cacheResult(queryCache, cacheKey, {
    ...result,
    purpose: purpose ?? undefined,
    note: result.truncated
      ? `Results were capped at ${result.returnedRows} returned rows out of ${result.rowCount}. Aggregate or filter further if you need the full picture.`
      : undefined,
  })
}

async function runPythonTool(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResultPayload> {
  const rawCode = readString(args, 'code')
  if (!rawCode) {
    return { error: 'The "code" argument is required and must be a non-empty string.' }
  }
  const code = stripCodeFences(rawCode)

  const primaryTable = Array.isArray(context.tableNames) ? context.tableNames[0] : undefined
  const result = await runPython(code, {
    connection: context.handle?.connection ?? null,
    schemaName: context.schemaName,
    tableName: primaryTable,
  })

  // Synchronize with the UI's Python Results tab so transformed df and plots appear immediately
  if (context.onPythonResult && result) {
    try {
      context.onPythonResult(result)
    } catch {
      // Ignore UI callback errors
    }
  }

  return compactPythonToolResult(result)
}

export async function executeTool(
  toolName: ToolName,
  rawArgs: unknown,
  context: ToolContext,
): Promise<ToolResultPayload> {
  const args = toRecord(rawArgs)
  const traceId = createTraceId()
  const startedAt = Date.now()

  context.onTrace(
    createTraceEntry({
      id: traceId,
      sessionId: context.sessionId,
      toolName,
      args,
      status: 'running',
      summary: 'Running…',
      detail: '',
      startedAt,
      finishedAt: null,
    }),
  )

  try {
    let result: ToolResultPayload
    if (toolName === 'inspect_schema') {
      result = await inspectSchema(args, context)
    } else if (toolName === 'run_sql') {
      result = await runSql(args, context)
    } else {
      result = await runPythonTool(args, context)
    }

    const summary = result.error
      ? summarizeToolError(result.error)
      : summarizeToolResult(toolName, result)

    context.onTrace(
      createTraceEntry({
        id: traceId,
        sessionId: context.sessionId,
        toolName,
        args,
        status: result.error ? 'error' : 'success',
        summary,
        detail: truncateDetail(result),
        startedAt,
        finishedAt: Date.now(),
      }),
    )

    return result
  } catch (error) {
    const message = summarizeToolError(error)
    context.onTrace(
      createTraceEntry({
        id: traceId,
        sessionId: context.sessionId,
        toolName,
        args,
        status: 'error',
        summary: message,
        detail: truncateDetail(message),
        startedAt,
        finishedAt: Date.now(),
      }),
    )
    return { error: message, tool: toolName }
  }
}
