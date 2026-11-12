import type { ContentBlock } from '../../../core/types'
import { parseMessageContent } from '../../../core/parsing/parseMessage'
import type { PostBlock, PostImage } from '../../../core/supabase/types'

/**
 * Turning an assistant answer into a publishable draft.
 *
 * Everything here is pure so the rules — how a title is derived, how long the
 * excerpt is, which image becomes the cover — can be reasoned about (and
 * tested) without touching the database.
 */

export interface DraftImage {
  url: string
  altText: string | null
  caption: string | null
}

export interface PostDraft {
  title: string
  subtitle: string | null
  excerpt: string
  content: string
  blocks: PostBlock[]
  coverImageUrl: string | null
  coverCaption: string | null
  images: DraftImage[]
  tags: string[]
  readingTimeMinutes: number
}

/** Average silent reading speed, in words per minute. */
const WORDS_PER_MINUTE = 220

const TITLE_MAX = 90
const EXCERPT_MAX = 240

/** Removes markdown decoration so a line can be used as plain prose. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*---+\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Counts the words of the prose, ignoring code blocks. */
export function countWords(text: string): number {
  const prose = text.replace(/```[\s\S]*?```/g, ' ')
  return prose.split(/\s+/).filter((word) => word.length > 0).length
}

/** Reading time in whole minutes, never below one. */
export function estimateReadingTime(text: string): number {
  return Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE))
}

/** Truncates on a word boundary so the result still reads as a sentence. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${body.replace(/[,;:.!?\s]+$/, '')}…`
}

/** Pulls the first markdown image out of a body of text. */
export function findFirstImage(text: string): { url: string; alt: string } | null {
  const match = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(text)
  if (!match) return null
  return { alt: match[1] ?? '', url: match[2] }
}

/** Collects every markdown image in order of appearance. */
export function findAllImages(text: string): DraftImage[] {
  const images: DraftImage[] = []
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let match = pattern.exec(text)
  while (match) {
    images.push({
      url: match[2],
      altText: match[1] && match[1].length > 0 ? match[1] : null,
      caption: null,
    })
    match = pattern.exec(text)
  }
  return images
}

/** Derives a headline from the answer itself. */
export function deriveTitle(content: string): string {
  const heading = /^\s{0,3}#{1,3}\s+(.+)$/m.exec(content)
  if (heading) {
    const text = stripMarkdown(heading[1])
    if (text.length > 0) return truncate(text, TITLE_MAX)
  }

  const firstBlock = content
    .split(/\n\s*\n/)
    .map((block) => stripMarkdown(block))
    .find((block) => block.length > 0 && !/^```/.test(block.trim()))

  if (firstBlock) return truncate(firstBlock, TITLE_MAX)
  return 'Untitled insight'
}

/** Derives a standfirst from the first real paragraph of the answer. */
export function deriveExcerpt(content: string): string {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)

  for (const paragraph of paragraphs) {
    if (paragraph.startsWith('#')) continue
    if (paragraph.startsWith('```')) continue
    const text = stripMarkdown(paragraph)
    if (text.length < 24) continue
    return truncate(text, EXCERPT_MAX)
  }

  const fallback = stripMarkdown(content)
  return fallback.length > 0 ? truncate(fallback, EXCERPT_MAX) : ''
}

/** Tags are lowercase, de-duplicated and free of punctuation. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '')
    if (clean.length === 0) continue
    seen.add(clean.slice(0, 32))
  }
  return [...seen].slice(0, 8)
}

/**
 * Builds a publishable draft from an assistant answer.
 *
 * The render blocks are stored alongside the raw markdown so the public page
 * can draw the very same mermaid diagrams, charts and tables.
 */
export function buildDraftFromAnswer(
  content: string,
  options: { tags?: string[] } = {},
): PostDraft {
  const blocks = parseBlocks(content)
  const images = findAllImages(content)
  const cover = images[0] ?? null

  return {
    title: deriveTitle(content),
    subtitle: null,
    excerpt: deriveExcerpt(content),
    content,
    blocks,
    coverImageUrl: cover?.url ?? null,
    coverCaption: null,
    images,
    tags: normalizeTags(options.tags ?? []),
    readingTimeMinutes: estimateReadingTime(content),
  }
}

/**
 * Converts the workspace parser output into the stored block shape.
 *
 * The stored shape is declared separately from `ContentBlock` so a change in
 * the renderer cannot silently rewrite published posts.
 */
export function parseBlocks(content: string): PostBlock[] {
  return parseMessageContent(content).map((block: ContentBlock): PostBlock => {
    if (block.type === 'chart') {
      return { type: 'chart', chart: block.chart }
    }
    if (block.type === 'table') {
      return {
        type: 'table',
        headers: block.headers,
        rows: block.rows,
        alignments: block.alignments,
      }
    }
    if (block.type === 'mermaid') {
      return { type: 'mermaid', code: block.code }
    }
    return { type: 'markdown', content: block.content }
  })
}

/** URL-safe handle derived from a title, with a short suffix for uniqueness. */
export function buildSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base || 'insight'}-${suffix}`
}

/** Maps a stored image row to the shape used by the composer. */
export function toDraftImage(image: PostImage): DraftImage {
  return {
    url: image.url,
    altText: image.alt_text,
    caption: image.caption,
  }
}
