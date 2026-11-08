import { jsonSchema, tool, type ToolSet } from 'ai'
import type { InspectSchemaArgs, RunSqlArgs } from '../types'
import { executeTool, type ToolContext } from './executeTool'

const inspectSchemaInput = jsonSchema<InspectSchemaArgs>({
  type: 'object',
  properties: {
    table: {
      type: 'string',
      description:
        'Optional exact table name to profile. Omit this to inspect every table in the session.',
    },
  },
  additionalProperties: false,
})

const runSqlInput = jsonSchema<RunSqlArgs>({
  type: 'object',
  properties: {
    sql: {
      type: 'string',
      description:
        'A single read-only DuckDB SQL statement. Use exact column names returned by inspect_schema.',
    },
    purpose: {
      type: 'string',
      description:
        'A short description of what this query is intended to learn, e.g. "monthly revenue trend".',
    },
  },
  required: ['sql'],
  additionalProperties: false,
})

export function createAgentTools(context: ToolContext): ToolSet {
  return {
    inspect_schema: tool({
      description:
        'Inspect the DuckDB schema before writing SQL. Returns tables, column names, data types, null counts, distinct counts, min/max values, and sample values. Call this first on every turn. Omit "table" to inspect all tables.',
      inputSchema: inspectSchemaInput,
      execute: async (args) => executeTool('inspect_schema', args, context),
    }),
    run_sql: tool({
      description:
        'Execute one read-only DuckDB SQL query against the current session. Returns columns, rows (capped), the true row count, and timings. Use this for exploration and for the final analysis. Never guess column names.',
      inputSchema: runSqlInput,
      execute: async (args) => executeTool('run_sql', args, context),
    }),
  }
}
