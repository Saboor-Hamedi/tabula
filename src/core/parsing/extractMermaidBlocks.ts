import type { RawBlock } from '../types'

interface FenceState {
  char: string
  length: number
}

function isFenceLine(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})\s*$/)
  if (!match) return null
  return { char: match[1][0], length: match[1].length }
}

function isMermaidOpen(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})\s*mermaid\s*$/i)
  if (!match) return null
  return { char: match[1][0], length: match[1].length }
}

function isClosingFence(line: string, fence: FenceState): boolean {
  const state = isFenceLine(line)
  return state !== null && state.char === fence.char && state.length >= fence.length
}

export function extractMermaidBlocks(text: string): RawBlock[] {
  const lines = text.split('\n')
  const blocks: RawBlock[] = []
  let buffer: string[] = []
  let openFence: FenceState | null = null
  let mermaidCode: string[] = []

  const flushMarkdown = () => {
    if (buffer.length === 0) return
    const content = buffer.join('\n')
    if (content.trim().length > 0) {
      blocks.push({ type: 'markdown', content })
    }
    buffer = []
  }

  for (const line of lines) {
    if (openFence) {
      if (isClosingFence(line, openFence)) {
        blocks.push({ type: 'mermaid', code: mermaidCode.join('\n').trim() })
        mermaidCode = []
        openFence = null
      } else {
        mermaidCode.push(line)
      }
      continue
    }

    const fence = isMermaidOpen(line)
    if (fence) {
      flushMarkdown()
      openFence = fence
      continue
    }

    buffer.push(line)
  }

  if (openFence) {
    const unfinished = ['```mermaid', ...mermaidCode, '```'].join('\n')
    buffer.push(unfinished)
  }

  flushMarkdown()
  return blocks
}
