import { describe, expect, it } from 'vitest'
import {
  insightPath,
  insightsPath,
  postPath,
  postsPath,
  slugifyUsername,
  userPath,
} from './paths'

describe('slugifyUsername', () => {
  it('cleans names into url-safe slugs', () => {
    expect(slugifyUsername('Ada Lovelace')).toBe('ada-lovelace')
    expect(slugifyUsername('  Grace_Hopper  ')).toBe('grace_hopper')
    expect(slugifyUsername('A!b@c#d')).toBe('a-b-c-d')
  })

  it('returns null for empty or missing input', () => {
    expect(slugifyUsername('')).toBeNull()
    expect(slugifyUsername(null)).toBeNull()
    expect(slugifyUsername(undefined)).toBeNull()
    expect(slugifyUsername('   ')).toBeNull()
  })

  it('prefixes reserved slugs so they cannot shadow routes', () => {
    expect(slugifyUsername('app')).toBe('u-app')
    expect(slugifyUsername('posts')).toBe('u-posts')
    expect(slugifyUsername('verify')).toBe('u-verify')
  })
})

describe('userPath', () => {
  it('returns the base when no slug is known', () => {
    expect(userPath('/workspace', null)).toBe('/workspace')
    expect(userPath('/app')).toBe('/app')
  })

  it('prefixes the username when present', () => {
    expect(userPath('/workspace', 'ada')).toBe('/ada/workspace')
  })

  it('encodes unusual characters in the slug', () => {
    expect(userPath('/app', 'ada lovelace')).toBe('/ada%20lovelace/app')
  })
})

describe('postPath / insightPath', () => {
  it('builds article urls with encoding', () => {
    expect(postPath('q3 revenue')).toBe('/posts/q3%20revenue')
    expect(insightPath('q3 revenue')).toBe('/posts/q3%20revenue')
  })
})

describe('postsPath / insightsPath', () => {
  it('omits the tag when missing', () => {
    expect(postsPath()).toBe('/posts')
    expect(postsPath(null)).toBe('/posts')
    expect(insightsPath()).toBe('/posts')
  })

  it('appends a query tag when present', () => {
    expect(postsPath('revenue')).toBe('/posts?tag=revenue')
  })
})
