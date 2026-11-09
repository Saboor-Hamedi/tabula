import { describe, expect, it } from 'vitest'
import { parseCodeSections } from './codeSections'

describe('parseCodeSections', () => {
  it('splits code with numbered comment banners into sections', () => {
    const code = `
import pandas as pd

# ============================================================
# 1. DATA AUDIT
# ============================================================
print(len(df))

# ============================================================
# 2. NUMERIC DESCRIPTIVES
# ============================================================
print(df.describe())
`
    const sections = parseCodeSections(code)
    expect(sections.length).toBeGreaterThanOrEqual(2)
    expect(sections.some((s) => s.title.includes('DATA AUDIT'))).toBe(true)
    expect(sections.some((s) => s.title.includes('NUMERIC DESCRIPTIVES'))).toBe(true)
  })

  it('returns a single section if no banners exist', () => {
    const code = `print("hello")\nprint("world")`
    const sections = parseCodeSections(code)
    expect(sections.length).toBe(1)
  })
})
