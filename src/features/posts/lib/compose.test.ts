import { describe, expect, it } from 'vitest'
import {
  buildDraftFromAnswer,
  buildSlug,
  countWords,
  deriveExcerpt,
  deriveTitle,
  estimateReadingTime,
  findAllImages,
  findFirstImage,
  normalizeTags,
  parseBlocks,
  stripMarkdown,
  truncate,
} from './compose'

const ANSWER = [
  '# Q3 revenue is down 12%',
  '',
  'Revenue fell in every region except EMEA, where it grew **18%**.',
  '',
  '```mermaid',
  'pie title Revenue',
  '"EMEA" : 42',
  '"AMER" : 58',
  '```',
  '',
  '| Region | Revenue |',
  '| --- | --- |',
  '| EMEA | 4.2M |',
].join('\n')

describe('stripMarkdown', () => {
  it('removes decoration and keeps the prose', () => {
    expect(stripMarkdown('**Bold** and `code` and [a link](https://x.dev)')).toBe(
      'Bold and code and a link',
    )
  })

  it('keeps the alt text of an image', () => {
    expect(stripMarkdown('![A chart](https://x.dev/a.png)')).toBe('A chart')
  })
})

describe('deriveTitle', () => {
  it('prefers the first heading', () => {
    expect(deriveTitle(ANSWER)).toBe('Q3 revenue is down 12%')
  })

  it('falls back to the first paragraph', () => {
    expect(deriveTitle('Just a plain opening line that carries the point.')).toBe(
      'Just a plain opening line that carries the point.',
    )
  })

  it('never returns an empty title', () => {
    expect(deriveTitle('')).toBe('Untitled insight')
  })
})

describe('deriveExcerpt', () => {
  it('skips the heading and takes the first real paragraph', () => {
    expect(deriveExcerpt(ANSWER)).toBe(
      'Revenue fell in every region except EMEA, where it grew 18%.',
    )
  })
})

describe('truncate', () => {
  it('cuts on a word boundary', () => {
    expect(truncate('alpha beta gamma delta', 12)).toBe('alpha beta…')
  })

  it('leaves short text alone', () => {
    expect(truncate('short', 40)).toBe('short')
  })
})

describe('reading time', () => {
  it('counts words outside code blocks', () => {
    expect(countWords('one two three\n```four five six```')).toBe(3)
  })

  it('never returns less than a minute', () => {
    expect(estimateReadingTime('a few words')).toBe(1)
  })
})

describe('images', () => {
  it('finds the first image', () => {
    expect(findFirstImage(ANSWER)).toBeNull()
    expect(findFirstImage('![Chart](https://x.dev/a.png)')).toEqual({
      alt: 'Chart',
      url: 'https://x.dev/a.png',
    })
  })

  it('collects every image in order', () => {
    const images = findAllImages('![a](1.png) text ![b](2.png)')
    expect(images.map((image) => image.url)).toEqual(['1.png', '2.png'])
  })
})

describe('normalizeTags', () => {
  it('lowercases, cleans and de-duplicates', () => {
    expect(normalizeTags(['Revenue', 'revenue', 'Q3!', '  '])).toEqual([
      'revenue',
      'q3',
    ])
  })
})

describe('parseBlocks', () => {
  it('splits an answer into render blocks', () => {
    const blocks = parseBlocks(ANSWER)
    expect(blocks.map((block) => block.type)).toEqual([
      'markdown',
      'mermaid',
      'table',
    ])
  })
})

describe('buildSlug', () => {
  it('turns a title into a url-safe handle', () => {
    const slug = buildSlug('Q3 revenue is down 12%')
    expect(slug).toMatch(/^q3-revenue-is-down-12-[a-z0-9]{5}$/)
  })

  it('falls back when the title has no usable characters', () => {
    expect(buildSlug('***')).toMatch(/^insight-[a-z0-9]{5}$/)
  })
})

describe('buildDraftFromAnswer', () => {  it('derives everything a post needs from one answer', () => {
    const draft = buildDraftFromAnswer(ANSWER)

    expect(draft.title).toBe('Q3 revenue is down 12%')
    expect(draft.excerpt).toContain('Revenue fell in every region')
    expect(draft.blocks).toHaveLength(3)
    expect(draft.readingTimeMinutes).toBeGreaterThanOrEqual(1)
    expect(draft.tags).toEqual([])
  })
})
