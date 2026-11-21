import type { DuckDBHandle } from '../duckdb/initDuckDB'
import { listTables, tableExists } from '../duckdb/listTables'
import { runSQL } from '../duckdb/runSQL'
import { profileTable } from '../profiling/profileTable'
import { runPython } from '../python'
import { buildExtraDatasets } from '../python/extraDatasets'
import { DIGEST_MAX_TABLES, MAX_AGENT_STEPS, MAX_RESULT_ROWS } from '../constants'
import type { PythonExecutionResult } from '../python'
import type {
  ExecutedCodeStep,
  ExecutedCodeTable,
  Session,
  TableProfile,
  TableSummary,
  ToolName,
  ToolResultPayload,
  ToolTraceEntry,
} from '../types'
import {
  compactPythonToolResult,
  compactSqlToolResult,
  formatPythonForDisplay,
  formatSqlForDisplay,
  stripCodeFences,
} from '../../tabula/utils/agentHelpers'
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
  primaryTable?: string
  tableNames: string[]
  tables: TableSummary[]
  allSessions?: Session[]
  onTrace: (entry: ToolTraceEntry) => void
  onPythonResult?: (result: PythonExecutionResult) => void
  onCodeStep?: (step: ExecutedCodeStep) => void
}

interface ResolvedTableTarget {
  schemaName: string
  tableName: string
}

function stripQuotes(ident: string): string {
  return ident.trim().replace(/^"+|"+$/g, '')
}

function resolveTableTarget(ref: string, context: ToolContext): ResolvedTableTarget | null {
  const cleaned = ref.trim()
  if (!cleaned) return null
  const lower = stripQuotes(cleaned).toLowerCase()
  const sessions = Array.isArray(context.allSessions) ? context.allSessions : []

  // 1. Check schema.table format (e.g. s_123.orders or "s_123"."orders")
  const dotIdx = cleaned.indexOf('.')
  if (dotIdx > 0 && dotIdx < cleaned.length - 1) {
    const rawSchema = stripQuotes(cleaned.slice(0, dotIdx)).toLowerCase()
    const rawTable = stripQuotes(cleaned.slice(dotIdx + 1)).toLowerCase()
    if (rawSchema === context.schemaName.toLowerCase()) {
      const match = (context.tableNames ?? []).find((t) => t.toLowerCase() === rawTable)
      if (match) return { schemaName: context.schemaName, tableName: match }
    }
    for (const s of sessions) {
      if (s.schemaName?.toLowerCase() === rawSchema) {
        const match = (s.tables ?? []).find((t) => t.name.toLowerCase() === rawTable)
        if (match) return { schemaName: s.schemaName, tableName: match.name }
      }
    }
  }

  // 2. Check active session tables
  const activeMatch = (context.tableNames ?? []).find((t) => t.toLowerCase() === lower)
  if (activeMatch) {
    return { schemaName: context.schemaName, tableName: activeMatch }
  }

  // 3. Check other sessions by table name or fileName
  for (const s of sessions) {
    const tableMatch = (s.tables ?? []).find((t) => t.name.toLowerCase() === lower)
    if (tableMatch) {
      return { schemaName: s.schemaName, tableName: tableMatch.name }
    }
    if (s.fileName && s.fileName.toLowerCase() === lower) {
      const target = s.primaryTable ?? s.tables?.[0]?.name
      if (target) return { schemaName: s.schemaName, tableName: target }
    }
  }

  return null
}

function listAvailableTargets(context: ToolContext): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of context.tableNames ?? []) {
    const key = `${context.schemaName}.${t}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(t)
    }
  }
  for (const s of context.allSessions ?? []) {
    for (const t of s.tables ?? []) {
      const key = `${s.schemaName}.${t.name}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(`${s.schemaName}.${t.name} (${s.fileName})`)
      }
    }
  }
  return out.slice(0, 50)
}

const CACHE_LIMIT = 40
const queryCache = new Map<string, { payload: ToolResultPayload; table?: ExecutedCodeTable; elapsedMs: number }>()
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

  const tablesToProfile: Array<{ schemaName: string; tableName: string }> = []
  if (requestedTable) {
    const resolved = resolveTableTarget(requestedTable, context)
    if (!resolved) {
      const allTargets = listAvailableTargets(context)
      return {
        error: `Table "${requestedTable}" was not found.`,
        availableTables: allTargets,
        availableTableCount: allTargets.length,
        hint: 'Pass an exact table name, "schema.table", or uploaded file name.',
      }
    }
    tablesToProfile.push(resolved)
  } else {
    const ordered = rankedNames.filter((name) => available.includes(name))
    for (const tableName of (ordered.length > 0 ? ordered : available).slice(0, DIGEST_MAX_TABLES)) {
      tablesToProfile.push({ schemaName: context.schemaName, tableName })
    }
  }

  const profiles: TableProfile[] = []
  for (const target of tablesToProfile) {
    try {
      const exists = await tableExists(context.handle.connection, target.schemaName, target.tableName)
      if (!exists) continue
      profiles.push(await profileTable(context.handle.connection, target.schemaName, target.tableName))
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
  stepId: string,
): Promise<ToolResultPayload> {
  const rawSql = readString(args, 'sql')
  if (!rawSql) {
    return { error: 'The "sql" argument is required and must be a non-empty string.' }
  }
  const sql = stripCodeFences(rawSql)
  const cleanSql = formatSqlForDisplay(sql)

  const purpose = readString(args, 'purpose')
  const cacheKey = `${context.schemaName}:${normalizeSql(sql)}`
  const cached = queryCache.get(cacheKey)
  if (cached) {
    context.onCodeStep?.({
      id: stepId,
      language: 'sql',
      code: cleanSql,
      purpose: purpose ?? undefined,
      status: 'done',
      elapsedMs: cached.elapsedMs,
      table: cached.table,
    })
    return { ...cached.payload, cached: true }
  }

  // Stream the SQL code block into the chat response immediately while it executes
  context.onCodeStep?.({
    id: stepId,
    language: 'sql',
    code: cleanSql,
    purpose: purpose ?? undefined,
    status: 'running',
  })

  const limitMatch = /\blimit\s+(\d+)\b/i.exec(sql)
  const explicitLimit = limitMatch ? parseInt(limitMatch[1], 10) : undefined
  const effectiveMaxRows = explicitLimit && explicitLimit > 0
    ? Math.min(explicitLimit, MAX_RESULT_ROWS)
    : 50

  const result = await runSQL({
    handle: context.handle,
    sql,
    schemaName: context.schemaName,
    maxRows: effectiveMaxRows,
    readOnly: true,
  })

  const tableRows: string[][] = Array.isArray(result.rows)
    ? result.rows.map((row) =>
        result.columns.map((col) => {
          if (!row || typeof row !== 'object') return ''
          const cell = (row as Record<string, unknown>)[col]
          return cell === null || cell === undefined ? '' : String(cell)
        }),
      )
    : []

  const uiTable: ExecutedCodeTable | undefined =
    result.columns.length > 0
      ? {
          headers: result.columns,
          rows: tableRows,
          totalRows: result.rowCount,
          totalCols: result.columns.length,
        }
      : undefined

  context.onCodeStep?.({
    id: stepId,
    language: 'sql',
    code: cleanSql,
    purpose: purpose ?? undefined,
    status: 'done',
    elapsedMs: result.elapsedMs,
    table: uiTable,
  })

  const payload = compactSqlToolResult(result, purpose)
  if (queryCache.size >= CACHE_LIMIT) {
    const oldest = queryCache.keys().next().value
    if (oldest !== undefined) queryCache.delete(oldest)
  }
  queryCache.set(cacheKey, { payload, table: uiTable, elapsedMs: result.elapsedMs })
  return payload
}

async function runPythonTool(
  args: Record<string, unknown>,
  context: ToolContext,
  stepId: string,
): Promise<ToolResultPayload> {
  const rawCode = readString(args, 'code')
  if (!rawCode) {
    return { error: 'The "code" argument is required and must be a non-empty string.' }
  }
  const code = stripCodeFences(rawCode)
  const cleanPy = formatPythonForDisplay(code)
  const purpose = readString(args, 'purpose') ?? undefined

  const available = Array.isArray(context.tableNames) ? context.tableNames : []
  const requestedTable = readString(args, 'table')
  const requestedTables = Array.isArray(args.tables)
    ? args.tables.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : []

  let targetSchema = context.schemaName
  let targetTable = context.primaryTable ?? available[0]

  if (requestedTable) {
    const resolved = resolveTableTarget(requestedTable, context)
    if (!resolved) {
      return {
        error: `Table "${requestedTable}" was not found.`,
        availableTables: listAvailableTargets(context),
      }
    }
    targetSchema = resolved.schemaName
    targetTable = resolved.tableName
  }

  const extraDatasets: Array<{ key: string; schemaName: string; tableName: string }> = []
  for (const ref of requestedTables) {
    const resolved = resolveTableTarget(ref, context)
    if (!resolved) {
      return {
        error: `Table "${ref}" in "tables" was not found.`,
        availableTables: listAvailableTargets(context),
      }
    }
    extraDatasets.push({
      key: ref.trim(),
      schemaName: resolved.schemaName,
      tableName: resolved.tableName,
    })
  }

  if (!requestedTable && extraDatasets.length > 0) {
    targetSchema = extraDatasets[0].schemaName
    targetTable = extraDatasets[0].tableName
  }

  // Always populate `dfs` and virtual files for all uploaded tables so single-file and
  // multi-file scripts (including `dfs[...]`, `glob.glob`, and `os.listdir`) always work.
  if (extraDatasets.length === 0) {
    extraDatasets.push(
      ...buildExtraDatasets(context.allSessions, context.schemaName, context.tableNames),
    )
  }

  // Stream the Python code block into the chat response immediately while Pyodide runs it
  context.onCodeStep?.({
    id: stepId,
    language: 'python',
    code: cleanPy,
    purpose,
    status: 'running',
  })

  const result = await runPython(code, {
    connection: context.handle?.connection ?? null,
    schemaName: targetSchema,
    tableName: targetTable,
    extraDatasets: extraDatasets.length > 0 ? extraDatasets : undefined,
  })

  if (context.onPythonResult && result) {
    try {
      context.onPythonResult(result)
    } catch {
      // Ignore UI callback errors
    }
  }

  if (result && !result.error) {
    const hasImages = Array.isArray(result.images) && result.images.length > 0
    const cleanStdout = result.stdout?.trim() || undefined
    const dfWasModified = result.dfInfo?.dfChanged !== false
    const includeTable =
      result.dfPreview &&
      Array.isArray(result.dfPreview.columns) &&
      result.dfPreview.columns.length > 0 &&
      (dfWasModified || (!hasImages && !cleanStdout))

    context.onCodeStep?.({
      id: stepId,
      language: 'python',
      code: cleanPy,
      purpose,
      status: 'done',
      elapsedMs: result.elapsedMs,
      images: hasImages ? result.images : undefined,
      table: includeTable
        ? {
            headers: result.dfPreview!.columns,
            rows: result.dfPreview!.rows,
            totalRows: result.dfPreview!.totalRows,
            totalCols: result.dfPreview!.totalCols,
          }
        : undefined,
      stdout: cleanStdout,
    })
  }

  return compactPythonToolResult(result)
}

function buildErrorContext(context: ToolContext): { availableTables: string[] } {
  return {
    availableTables: listAvailableTargets(context),
  }
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
      result = await runSql(args, context, traceId)
    } else {
      result = await runPythonTool(args, context, traceId)
    }

    if (result.error && !result.availableTables) {
      result = { ...result, ...buildErrorContext(context) }
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
    const errorPayload: ToolResultPayload = {
      error: message,
      tool: toolName,
      ...buildErrorContext(context),
    }
    context.onTrace(
      createTraceEntry({
        id: traceId,
        sessionId: context.sessionId,
        toolName,
        args,
        status: 'error',
        summary: message,
        detail: truncateDetail(errorPayload),
        startedAt,
        finishedAt: Date.now(),
      }),
    )
    return errorPayload
  }
}
