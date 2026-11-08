/**
 * Lightweight inline markdown for table cells.
 *
 * The agent writes GFM tables whose cells often contain `**bold**`, `*italic*`
 * and `` `code` ``. Rendering those cells as raw text leaked the asterisks into
 * the UI. This module converts a cell into a small token list so the table can
 * render emphasis without pulling a second markdown renderer into every cell.
 */

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }

const PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g

/** Splits a cell value into text/emphasis tokens. */
export function parseInlineMarkdown(value: string): InlineToken[] {
  if (value.length === 0) return []

  const tokens: InlineToken[] = []
  let lastIndex = 0

  for (const match of value.matchAll(PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: value.slice(lastIndex, index) })
    }

    const raw = match[0]
    if (raw.startsWith('**') || raw.startsWith('__')) {
      tokens.push({ type: 'strong', value: raw.slice(2, -2) })
    } else if (raw.startsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) })
    } else {
      tokens.push({ type: 'em', value: raw.slice(1, -1) })
    }

    lastIndex = index + raw.length
  }

  if (lastIndex < value.length) {
    tokens.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return tokens
}

/** Plain-text version of a cell, used for copy and export. */
export function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}
