export interface FigureChanges {
  title?: string
  textColor?: string
}

function escapeMermaid(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function editMermaid(code: string, changes: FigureChanges): string {
  let next = code
  const title = changes.title?.trim()

  if (title) {
    const escaped = escapeMermaid(title)
    if (/^\s*title\s+/m.test(next)) {
      next = next.replace(/^(\s*title\s+).*$/m, `$1"${escaped}"`)
    } else if (/^\s*(xychart-beta|pie)\b/i.test(next)) {
      const lines = next.split('\n')
      lines.splice(1, 0, `    title "${escaped}"`)
      next = lines.join('\n')
    }
  }

  if (changes.textColor) {
    const color = changes.textColor.trim()
    next = next.replace(/^%%\s*tabula:textColor=.*?%%.*\n?/gim, '')
    next = `%% tabula:textColor=${color} %%\n${next}`
  }

  return next
}

function editChartJson(code: string, changes: FigureChanges): string {
  try {
    const parsed: unknown = JSON.parse(code)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return code
    const record = { ...(parsed as Record<string, unknown>) }

    if (changes.title?.trim()) record.title = changes.title.trim()
    if (changes.textColor) record.textColor = changes.textColor.trim()

    return JSON.stringify(record, null, 2)
  } catch {
    return code
  }
}

/**
 * Replaces the title/text color of the nth visible figure block in a message.
 * Figure numbering matches the renderer: generated diagrams and structured
 * charts both count as figures.
 */
export function editFigure(
  content: string,
  figureIndex: number,
  changes: FigureChanges,
): string {
  const lines = content.split('\n')
  const output: string[] = []
  let currentFigure = 0
  let fenceLanguage: string | null = null
  let fenceChar = '`'
  let buffer: string[] = []

  for (const line of lines) {
    if (!fenceLanguage) {
      const open = /^\s*(`{3,}|~{3,})\s*(mermaid|chart|elbow)\s*$/i.exec(line)
      if (open) {
        fenceLanguage = open[2].toLowerCase()
        fenceChar = open[1][0]
        buffer = [line]
      } else {
        output.push(line)
      }
      continue
    }

    buffer.push(line)
    const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line)
    if (!close || close[1][0] !== fenceChar) continue

    const isTarget = currentFigure === figureIndex
    const language = fenceLanguage
    const body = buffer.slice(1, -1)
    if (isTarget) {
      const edited =
        language === 'mermaid'
          ? editMermaid(body.join('\n'), changes)
          : editChartJson(body.join('\n'), changes)
      output.push(buffer[0], ...edited.split('\n'), buffer[buffer.length - 1])
    } else {
      output.push(...buffer)
    }

    currentFigure += 1
    fenceLanguage = null
    buffer = []
  }

  if (buffer.length > 0) output.push(...buffer)
  return output.join('\n')
}

/** Reads the visible title from a generated diagram. */
export function readMermaidTitle(code: string): string {
  const match = /^\s*title\s+"?([^"\n]+)"?\s*$/im.exec(code)
  return match ? match[1].trim() : ''
}

/** Reads the optional text-color directive from a generated diagram. */
export function readMermaidTextColor(code: string): string | undefined {
  const match = /%%\s*tabula:textColor\s*=\s*(#[0-9a-fA-F]{3,8})\s*%%/i.exec(code)
  return match ? match[1] : undefined
}
