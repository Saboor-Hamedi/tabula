import { describe, expect, it } from 'vitest'
import { formatTableCellText, isNumericOrStatValue } from './DataTable'

describe('DataTable numeric & statistical value detection', () => {
  it('identifies statistical and quantitative numbers correctly', () => {
    // Pure integers and floats
    expect(isNumericOrStatValue('16.70')).toBe(true)
    expect(isNumericOrStatValue('17')).toBe(true)
    expect(isNumericOrStatValue('1.28')).toBe(true)
    expect(isNumericOrStatValue('-5.4')).toBe(true)

    // Ratios and counts (e.g. 395 / 395)
    expect(isNumericOrStatValue('395 / 395')).toBe(true)
    expect(isNumericOrStatValue('395/395')).toBe(true)
    expect(isNumericOrStatValue('10 / 25')).toBe(true)

    // Percentages and currencies
    expect(isNumericOrStatValue('100%')).toBe(true)
    expect(isNumericOrStatValue('$1,234.50')).toBe(true)

    // Ranges and statistical standard deviations
    expect(isNumericOrStatValue('15 - 22')).toBe(true)
    expect(isNumericOrStatValue('16.70 ± 1.28')).toBe(true)
    expect(isNumericOrStatValue('16.70 (1.28)')).toBe(true)

    // Placeholders
    expect(isNumericOrStatValue('—')).toBe(true)
    expect(isNumericOrStatValue('N/A')).toBe(true)
  })

  it('rejects row labels and text values', () => {
    expect(isNumericOrStatValue('Measure')).toBe(false)
    expect(isNumericOrStatValue('Mean')).toBe(false)
    expect(isNumericOrStatValue('Std Dev')).toBe(false)
    expect(isNumericOrStatValue('Median')).toBe(false)
    expect(isNumericOrStatValue('Customer Name')).toBe(false)
  })

  it('formats long decimals in table cells to 1 decimal place like 94.3', () => {
    expect(formatTableCellText('94.4444434343')).toBe('94.4')
    expect(formatTableCellText('94.31289%')).toBe('94.3%')
    expect(formatTableCellText('16.70 ± 1.2845')).toBe('16.7 ± 1.3')
    expect(formatTableCellText('94.0000')).toBe('94')
  })
})
