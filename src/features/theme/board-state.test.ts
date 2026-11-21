import { describe, expect, it } from 'vitest'
import { clampNoteText, MAX_NOTE_WORDS, stripNoteMarkdown } from './board-state'

describe('stripNoteMarkdown & clampNoteText', () => {
  it('strips markdown bold, headings, inline code, tables, and rules from sticky notes', () => {
    const raw = [
      '### Practical Score Summary',
      '**Class A** leads with `94.3%` practical score.',
      '',
      '| Class | Score |',
      '| --- | --- |',
      '| Class A | 94.3 |',
      '',
      '---',
      '- Top performer: **Class A**',
      '* Second place: *Class B* (`91.2%`)',
    ].join('\n')

    const cleaned = clampNoteText(raw)
    expect(cleaned).not.toContain('###')
    expect(cleaned).not.toContain('**')
    expect(cleaned).not.toContain('`')
    expect(cleaned).not.toContain('| Class |')
    expect(cleaned).not.toContain('---')
    expect(cleaned).toContain('Practical Score Summary')
    expect(cleaned).toContain('Class A leads with 94.3% practical score.')
    expect(cleaned).toContain('• Top performer: Class A')
    expect(cleaned).toContain('• Second place: Class B (91.2%)')
  })

  it('enforces the 200-word limit on sticky notes', () => {
    const longWords = Array.from({ length: 240 }, (_, i) => `word${i + 1}`).join(' ')
    const clamped = clampNoteText(longWords)
    const count = clamped.split(/\s+/).filter(Boolean).length
    expect(count).toBeLessThanOrEqual(MAX_NOTE_WORDS)
    expect(stripNoteMarkdown('**clean**')).toBe('clean')
  })
})
