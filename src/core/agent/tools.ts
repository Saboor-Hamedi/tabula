import { jsonSchema, tool, type ToolSet } from 'ai'
import type { InspectSchemaArgs, RunPythonArgs, RunSqlArgs } from '../types'
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

const runPythonInput = jsonSchema<RunPythonArgs>({
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description:
        'Python code to execute (using pandas as pd, numpy as np, matplotlib.pyplot as plt). The active dataset is loaded in `df`.',
    },
    purpose: {
      type: 'string',
      description:
        'A short description of what this Python calculation or plot is for.',
    },
  },
  required: ['code'],
  additionalProperties: false,
})

export function createAgentTools(context: ToolContext): ToolSet {
  return {
    inspect_schema: tool({
      description:
        'Inspect DuckDB table schemas (column types, null counts, distinct counts, min/max, samples). Only call when the Column Digest lacks needed details (e.g. null counts, min/max, or unlisted tables). Omit "table" to inspect largest tables.',
      inputSchema: inspectSchemaInput,
      execute: async (args) => executeTool('inspect_schema', args, context),
    }),
    run_sql: tool({
      description:
        'Execute one read-only DuckDB SQL query against the current session. Returns columns, rows (capped), the true row count, and timings. Use this for exploration and for the final analysis. Never guess column names.',
      inputSchema: runSqlInput,
      execute: async (args) => executeTool('run_sql', args, context),
    }),
    run_python: tool({
      description:
        'Execute Python data science code (pandas, numpy, scipy, matplotlib) in the browser. The active dataset is automatically loaded as DataFrame `df`. Visual plots created with plt are captured and displayed on the right panel.',
      inputSchema: runPythonInput,
      execute: async (args) => executeTool('run_python', args, context),
    }),
  }
}
