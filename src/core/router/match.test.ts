import { describe, expect, it } from 'vitest'
import { buildHash, matchPath, parseHash } from './match'

describe('parseHash', () => {
  it('treats a bare fragment as a path', () => {
    expect(parseHash('#app').path).toBe('/app')
  })

  it('accepts a slash-prefixed fragment', () => {
    expect(parseHash('#/insights/q3').path).toBe('/insights/q3')
  })

  it('reads the query string', () => {
    const location = parseHash('#insights?tag=revenue')
    expect(location.path).toBe('/insights')
    expect(location.query.get('tag')).toBe('revenue')
  })

  it('falls back to the root path', () => {
    expect(parseHash('#').path).toBe('/')
    expect(parseHash('').path).toBe('/')
  })

  it('drops a trailing slash', () => {
    expect(parseHash('#/insights/').path).toBe('/insights')
  })
})

describe('matchPath', () => {
  it('matches an exact path', () => {
    expect(matchPath('/app', '/app')).toEqual({})
    expect(matchPath('/app', '/workspace')).toBeNull()
  })

  it('extracts a parameter', () => {
    expect(matchPath('/insights/:slug', '/insights/q3-revenue')).toEqual({
      slug: 'q3-revenue',
    })
  })

  it('decodes a parameter', () => {
    expect(matchPath('/insights/:slug', '/insights/q3%20revenue')).toEqual({
      slug: 'q3 revenue',
    })
  })

  it('needs the same number of segments', () => {
    expect(matchPath('/insights/:slug', '/insights/a/b')).toBeNull()
    expect(matchPath('/insights', '/insights/a')).toBeNull()
  })

  it('captures the rest of the path with a wildcard', () => {
    expect(matchPath('/*', '/anything/at/all')).toEqual({ '*': 'anything/at/all' })
  })
})

describe('buildHash', () => {
  it('builds a fragment', () => {
    expect(buildHash('/app')).toBe('#/app')
  })

  it('appends the query string', () => {
    expect(buildHash('/insights', { tag: 'revenue' })).toBe('#/insights?tag=revenue')
  })
})
