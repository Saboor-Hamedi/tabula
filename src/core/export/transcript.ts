import type { ChatMessage, Session } from '../types'
import { stripInlineMarkdown } from '../parsing/inlineMarkdown'

/** A plain-text conversation export that stays readable outside the app. */
export function buildTranscript(session: Session, messages: ChatMessage[]): string {
  const lines: string[] = [
    `Tabula conversation — ${session.fileName}`,
    `Exported ${new Date().toLocaleString()}`,
    '',
  ]

  for (const message of messages) {
    if (!message.content.trim()) continue
    const text = stripInlineMarkdown(message.content)
      .replace(/```[\s\S]*?```/g, '[figure]')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (!text) continue
    lines.push(message.role === 'user' ? 'You:' : 'Tabula:', text, '')
  }

  return lines.join('\n')
}

export function transcriptFileName(session: Session): string {
  const base = session.fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `${base || 'tabula'}-conversation.txt`
}

export function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
