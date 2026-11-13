import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../constants'
import {
  getModelOption,
  isModelId,
  MODEL_OPTIONS,
  resolveModelId,
} from './modelOptions'

describe('MODEL_OPTIONS', () => {
  it('has a default model that exists in the options', () => {
    expect(MODEL_OPTIONS.some((option) => option.id === DEFAULT_MODEL)).toBe(true)
  })

  it('uses unique ids', () => {
    const ids = MODEL_OPTIONS.map((option) => option.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('isModelId', () => {
  it.each([
    ['deepseek-v4-flash', true],
    ['deepseek-v4-pro', true],
    ['gpt-4o', false],
    ['', false],
    [null, false],
    [undefined, false],
  ] as Array<[string | null | undefined, boolean]>)('isModelId(%j) => %s', (value, expected) => {
    expect(isModelId(value)).toBe(expected)
  })
})

describe('getModelOption', () => {
  it('returns the matching option', () => {
    expect(getModelOption('deepseek-v4-pro').shortLabel).toBe('V4 Pro')
  })
})

describe('resolveModelId', () => {
  it('returns the given id when valid', () => {
    expect(resolveModelId('deepseek-v4-pro')).toBe('deepseek-v4-pro')
  })

  it('falls back to the default model for garbage input', () => {
    expect(resolveModelId('not-a-model')).toBe(DEFAULT_MODEL)
    expect(resolveModelId(null)).toBe(DEFAULT_MODEL)
    expect(resolveModelId(undefined)).toBe(DEFAULT_MODEL)
  })
})
