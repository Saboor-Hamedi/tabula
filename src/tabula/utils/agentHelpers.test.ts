import { describe, expect, it } from 'vitest'
import {
  cleanCodeError,
  compactPythonToolResult,
  compactSqlToolResult,
  compactText,
  formatPythonForDisplay,
  formatSqlForDisplay,
  stripCodeFences,
} from './agentHelpers'

describe('agentHelpers', () => {
  it('strips accidental markdown fences from SQL and Python tool inputs', () => {
    expect(stripCodeFences('```sql\nSELECT 1;\n```')).toBe('SELECT 1;')
    expect(stripCodeFences('```python\ndf.head(5)\n```')).toBe('df.head(5)')
    expect(stripCodeFences('SELECT * FROM orders LIMIT 10')).toBe('SELECT * FROM orders LIMIT 10')
  })

  it('compacts long stdout without dropping the leading output', () => {
    const long = 'a'.repeat(5000)
    const compacted = compactText(long, 200)
    expect(compacted.length).toBeLessThan(200)
    expect(compacted).toContain('truncated')
  })

  it('caps dfPreview rows and columns sent back to the agent while preserving totalRows', () => {
    const columns = Array.from({ length: 20 }, (_, i) => `col_${i}`)
    const rows = Array.from({ length: 40 }, () => columns.map((_, i) => String(i)))
    const result = compactPythonToolResult({
      code: 'df',
      stdout: 'ok',
      stderr: '',
      images: [],
      elapsedMs: 12,
      error: null,
      executedAt: 0,
      dfPreview: { columns, rows, totalRows: 1000, totalCols: 20 },
    })
    expect(result.dfPreview?.columns).toHaveLength(12)
    expect(result.dfPreview?.rows).toHaveLength(15)
    expect(result.dfPreview?.totalRows).toBe(1000)
    expect(result.dfPreview?.truncatedForAgent).toBe(true)
  })

  it('omits untouched dfPreview when script only generated plots to save tokens', () => {
    const result = compactPythonToolResult({
      code: 'plt.plot([1, 2], [3, 4])',
      stdout: '',
      stderr: '',
      images: ['data:image/png;base64,abc'],
      elapsedMs: 18,
      error: null,
      executedAt: 0,
      dfInfo: { shape: [500, 10], columns: ['a', 'b'], dfChanged: false },
      dfPreview: { columns: ['a', 'b'], rows: [['1', '2']], totalRows: 500, totalCols: 10 },
    })
    expect(result.hasPlots).toBe(true)
    expect(result.dfPreview).toBeUndefined()
  })

  it('formats long single-line SQL queries into clean multi-line clauses', () => {
    const rawSql =
      'SELECT category, COUNT(*) AS orders, SUM(revenue) AS total FROM sales WHERE revenue > 0 GROUP BY category ORDER BY total DESC LIMIT 10'
    const formatted = formatSqlForDisplay(rawSql)
    expect(formatted).toContain('\nFROM sales')
    expect(formatted).toContain('\nWHERE revenue > 0')
    expect(formatted).toContain('\nGROUP BY category')
    expect(formatted).toContain('\nORDER BY total DESC')
    expect(formatted).toContain('\nLIMIT 10')
  })

  it('cleans noisy ASCII banners and blank lines from Python code and extracts 1-line errors', () => {
    const py = '# ====================\n# 1. Clean data\n# ====================\ndf = df.dropna()\n\n\n\nprint(len(df))\nsummary'
    expect(formatPythonForDisplay(py)).toBe('# 1. Clean data\ndf = df.dropna()\nprint(len(df))')

    const traceback =
      'Traceback (most recent call last):\n  File "/lib/python3.12/_pyodide/_base.py", line 499, in eval_code\n  File "<input>", line 4, in <module>\nKeyError: \'missing_col\''
    expect(cleanCodeError(traceback)).toBe("Line 4: KeyError: 'missing_col'")
  })

  it('compacts SQL tool results for LLM consumption', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      notes: 'x'.repeat(120),
    }))
    const compacted = compactSqlToolResult(
      {
        columns: ['id', 'notes'],
        rows,
        rowCount: 500,
        returnedRows: 50,
        truncated: true,
        elapsedMs: 9,
      },
      'Check notes',
      10,
    )
    expect(compacted.rows).toHaveLength(10)
    expect(String(compacted.rows[0].notes).length).toBeLessThanOrEqual(80)
  })
})
