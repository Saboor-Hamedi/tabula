import { describe, expect, it } from 'vitest'
import {
  buildHash,
  joinPath,
  matchPath,
  normalizeRouteTarget,
  parseBrowserLocation,
  parseHash,
} from './match'

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

describe('parseBrowserLocation', () => {
  it('prefers a legacy hash when it looks like a route', () => {
    expect(parseBrowserLocation('/', '', '#/posts').path).toBe('/posts')
  })

  it('ignores hashes that look like OAuth tokens', () => {
    expect(parseBrowserLocation('/landing', '', '#access_token=abc123').path).toBe('/landing')
  })

  it('reads clean pathname and search', () => {
    const location = parseBrowserLocation('/posts', '?tag=revenue', '')
    expect(location.path).toBe('/posts')
    expect(location.query.get('tag')).toBe('revenue')
  })

  it('normalizes a trailing slash and a leading-slash-less path', () => {
    expect(parseBrowserLocation('/posts/', '', '').path).toBe('/posts')
    expect(parseBrowserLocation('posts', '', '').path).toBe('/posts')
  })

  it('returns the root path for an empty pathname', () => {
    expect(parseBrowserLocation('', '', '').path).toBe('/')
  })
})

describe('normalizeRouteTarget', () => {
  it('strips a leading hash', () => {
    expect(normalizeRouteTarget('#posts')).toBe('/posts')
  })

  it('adds a leading slash to a bare path', () => {
    expect(normalizeRouteTarget('posts')).toBe('/posts')
  })

  it('leaves a clean path untouched', () => {
    expect(normalizeRouteTarget('/posts?tag=x')).toBe('/posts?tag=x')
  })
})

describe('joinPath', () => {
  it('returns the base when the path is empty', () => {
    expect(joinPath('/posts', '')).toBe('/posts')
  })

  it('returns absolute paths unchanged', () => {
    expect(joinPath('/posts', '/app')).toBe('/app')
  })

  it('joins relative paths with exactly one slash', () => {
    expect(joinPath('/posts/', 'q3')).toBe('/posts/q3')
  })
})
