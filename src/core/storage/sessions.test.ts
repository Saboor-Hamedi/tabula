import { beforeEach, describe, expect, it } from 'vitest'
import type { Session } from '../types'
import {
  clearSessionRegistry,
  findSession,
  getSessionRegistry,
  registerSession,
  unregisterSession,
} from './sessions'

function session(id: string, fileName = `${id}.csv`): Session {
  return {
    id,
    fileName,
    fileType: 'csv',
    fileSize: 1,
    uploadedAt: Date.now(),
    schemaName: `sess_${id}`,
    tables: [],
    primaryTable: null,
  }
}

describe('session registry', () => {
  beforeEach(() => {
    clearSessionRegistry()
  })

  it('registers sessions in insertion order', () => {
    registerSession(session('a'))
    registerSession(session('b'))
    expect(getSessionRegistry().map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('re-registering moves the session to the end without duplicating', () => {
    registerSession(session('a'))
    registerSession(session('b'))
    registerSession(session('a', 'renamed.csv'))
    const registry = getSessionRegistry()
    expect(registry.map((s) => s.id)).toEqual(['b', 'a'])
    expect(findSession('a')?.fileName).toBe('renamed.csv')
  })

  it('unregisters a single session', () => {
    registerSession(session('a'))
    registerSession(session('b'))
    unregisterSession('a')
    expect(getSessionRegistry().map((s) => s.id)).toEqual(['b'])
  })

  it('findSession returns null for unknown ids', () => {
    expect(findSession('nope')).toBeNull()
  })

  it('clearSessionRegistry empties the registry', () => {
    registerSession(session('a'))
    clearSessionRegistry()
    expect(getSessionRegistry()).toEqual([])
  })
})
