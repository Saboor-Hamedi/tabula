/**
 * Splits a Python script into distinct sections or feature cells
 * based on comment banners (e.g. "# 1. DATA AUDIT", "# ===...", "# Step 1: ...").
 */

export interface CodeSection {
  id: string
  title: string
  code: string
  startLine: number
}

export function parseCodeSections(code: string): CodeSection[] {
  const lines = code.split('\n')
  const sections: CodeSection[] = []

  let currentTitle = 'Initial Setup'
  let currentLines: string[] = []
  let currentStartLine = 1
  let sectionIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check for section markers
    let isHeader = false
    let detectedTitle = ''

    // Pattern 1: # ==================== followed by # TITLE
    if (trimmed.startsWith('# ===') && i + 1 < lines.length && lines[i + 1].trim().startsWith('#')) {
      const nextLine = lines[i + 1].trim().replace(/^#+\s*/, '').replace(/#+$/, '').trim()
      if (nextLine.length > 0 && !nextLine.startsWith('=')) {
        isHeader = true
        detectedTitle = nextLine
        // Skip closing banner if present
        if (i + 2 < lines.length && lines[i + 2].trim().startsWith('# ===')) {
          i += 2
        } else {
          i += 1
        }
      }
    }
    // Pattern 2: # 1. TITLE or # Step 1: TITLE or # --- TITLE ---
    else if (
      trimmed.match(/^#+\s*(?:\d+[\.:]|Step\s*\d+|Section\s*\d+|Part\s*\d+)\s+([^\n]+)/i) ||
      trimmed.match(/^#+\s*-{3,}\s*([^\n-]+)\s*-{3,}/)
    ) {
      const match =
        trimmed.match(/^#+\s*(?:\d+[\.:]|Step\s*\d+|Section\s*\d+|Part\s*\d+)\s+([^\n]+)/i) ||
        trimmed.match(/^#+\s*-{3,}\s*([^\n-]+)\s*-{3,}/)
      if (match && match[1]) {
        isHeader = true
        detectedTitle = match[1].replace(/#+$/, '').trim()
      }
    }

    if (isHeader) {
      if (currentLines.length > 0 && currentLines.some((l) => l.trim().length > 0 && !l.trim().startsWith('#'))) {
        sections.push({
          id: `section-${sectionIndex++}`,
          title: currentTitle,
          code: currentLines.join('\n').trim(),
          startLine: currentStartLine,
        })
      }
      currentTitle = detectedTitle
      currentLines = []
      currentStartLine = i + 1
    } else {
      currentLines.push(line)
    }
  }

  // Push final section
  if (currentLines.length > 0 && currentLines.some((l) => l.trim().length > 0)) {
    sections.push({
      id: `section-${sectionIndex++}`,
      title: currentTitle,
      code: currentLines.join('\n').trim(),
      startLine: currentStartLine,
    })
  }

  return sections
}
