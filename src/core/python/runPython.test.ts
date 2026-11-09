import { describe, expect, it } from 'vitest'
import { runPython } from './runPython'

describe('runPython', () => {
  it('returns empty result when code is empty or whitespace', async () => {
    const result = await runPython('   \n  \t  ')
    expect(result.code).toBe('')
    expect(result.error).toBe('Python code is empty.')
    expect(result.stdout).toBe('')
    expect(result.images).toEqual([])
  })

  it('rejects execution gracefully if code is invalid', async () => {
    const result = await runPython('')
    expect(result.error).toBeTruthy()
  })
})
