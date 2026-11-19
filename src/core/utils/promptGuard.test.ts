import { describe, expect, it } from 'vitest'
import {
  MAX_PROMPT_WORDS,
  clampPromptInput,
  countWords,
  validateUserPrompt,
} from './promptGuard'

describe('promptGuard', () => {
  it('counts words accurately', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('Show monthly revenue by region')).toBe(5)
    expect(countWords('Line one\n\nLine   two')).toBe(4)
  })

  it('clamps pasted text to 300 words', () => {
    const words400 = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ')
    const clamped = clampPromptInput(words400)
    expect(countWords(clamped)).toBe(MAX_PROMPT_WORDS)
  })

  it('allows normal plain-English spreadsheet questions', () => {
    const res = validateUserPrompt('Compare Q3 revenue and profit margin across regions.')
    expect(res.ok).toBe(true)
    expect(res.error).toBeNull()
    expect(res.wordCount).toBe(8)
  })

  it('blocks messages exceeding 300 words', () => {
    const words301 = Array.from({ length: 301 }, (_, i) => `w${i}`).join(' ')
    const res = validateUserPrompt(words301)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/300 words/)
  })

  it('blocks pasted hacking links, localhost/SSRF URLs, and XSS payloads', () => {
    expect(validateUserPrompt('Open https://evil.example/steal?x=1').ok).toBe(false)
    expect(validateUserPrompt('Fetch http://169.254.169.254/latest/meta-data').ok).toBe(false)
    expect(validateUserPrompt('Run javascript:alert(1)').ok).toBe(false)
    expect(validateUserPrompt('<script>alert(1)</script>').ok).toBe(false)
    expect(validateUserPrompt('<img src=x onerror=alert(1)>').ok).toBe(false)
  })

  it('strips invisible BiDi and control spoofing characters', () => {
    const res = validateUserPrompt('Show\u202E sales\u200B total')
    expect(res.ok).toBe(true)
    expect(res.sanitized).toBe('Show sales total')
  })
})
