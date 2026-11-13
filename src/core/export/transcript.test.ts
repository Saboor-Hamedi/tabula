import { describe, expect, it } from 'vitest'
import type { ChatMessage, Session } from '../types'
import { buildTranscript, transcriptFileName } from './transcript'

const session: Session = {
  id: 's1',
  fileName: 'orders.csv',
  fileType: 'csv',
  fileSize: 1024,
  uploadedAt: Date.now(),
  schemaName: 'sess_abc123',
  tables: [{ name: 'orders', rowCount: 420, columnCount: 9 }],
  primaryTable: 'orders',
}

function message(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: `m-${role}`, role, content, createdAt: Date.now() } as ChatMessage
}

describe('buildTranscript', () => {
  it('labels roles and keeps prose', () => {
    const transcript = buildTranscript(session, [
      message('user', 'How many orders?'),
      message('assistant', '**420** orders this quarter.'),
    ])
    expect(transcript).toContain('You:')
    expect(transcript).toContain('Lumina Tabula:')
    expect(transcript).toContain('How many orders?')
    expect(transcript).toContain('420 orders this quarter.')
  })

  it('collapses inline fence fragments so raw triple backticks do not leak', () => {
    const transcript = buildTranscript(session, [
      message('assistant', 'See chart:\n```chart\n{}\n```\nDone.'),
    ])
    expect(transcript).not.toContain('```')
  })

  it('skips empty messages', () => {
    const transcript = buildTranscript(session, [
      message('user', '   '),
      message('assistant', ''),
      message('user', 'Real question'),
    ])
    expect(transcript).toContain('Real question')
    expect(transcript.match(/You:/g)).toHaveLength(1)
  })

  it('collapses 3+ consecutive newlines', () => {
    const transcript = buildTranscript(session, [message('user', 'a\n\n\n\nb')])
    expect(transcript).not.toMatch(/\n{3,}/)
  })

  it('includes the source file name in the header', () => {
    expect(buildTranscript(session, [])).toContain('orders.csv')
  })
})

describe('transcriptFileName', () => {
  it('derives a slug from the file name', () => {
    expect(transcriptFileName(session)).toBe('orders-conversation.txt')
  })

  it('sanitizes unusual characters', () => {
    const weird: Session = { ...session, fileName: 'my weird file (final).xlsx' }
    expect(transcriptFileName(weird)).toBe('my-weird-file-final--conversation.txt')
  })

  it('replaces every non-slug character with a dash', () => {
    const blank: Session = { ...session, fileName: '.. .' }
    expect(transcriptFileName(blank)).toBe('--conversation.txt')
  })
})
