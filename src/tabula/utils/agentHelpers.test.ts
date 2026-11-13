import { describe, expect, it } from 'vitest'
import { compactPythonToolResult, compactText, stripCodeFences } from './agentHelpers'

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
})
