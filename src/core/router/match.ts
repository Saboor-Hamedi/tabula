/**
 * Hash path matching.
 *
 * The app is a static bundle served from any host, so the URL fragment is the
 * router. Both `#app` and `#/app` resolve to `/app`, which keeps every link
 * that already exists in the product working.
 */

export interface ParsedLocation {
  path: string
  query: URLSearchParams
}

export type RouteParams = Record<string, string>

/** Splits a fragment into its path and its query string. */
export function parseHash(hash: string): ParsedLocation {
  const raw = hash.replace(/^#/, '')
  const queryIndex = raw.indexOf('?')
  const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex + 1) : ''

  const normalized = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  const trimmed = normalized.replace(/\/+$/, '')

  return {
    path: trimmed.length > 0 ? trimmed : '/',
    query: new URLSearchParams(queryPart),
  }
}

/**
 * Matches a path against a pattern.
 *
 * Patterns use `:name` for a parameter and a trailing `*` for a wildcard that
 * captures the rest of the path. Returns the extracted parameters, or `null`
 * when the pattern does not apply.
 */
export function matchPath(pattern: string, path: string): RouteParams | null {
  const patternSegments = pattern.split('/').filter(Boolean)
  const pathSegments = path.split('/').filter(Boolean)

  const params: RouteParams = {}

  for (let index = 0; index < patternSegments.length; index += 1) {
    const expected = patternSegments[index]

    if (expected === '*') {
      params['*'] = pathSegments.slice(index).join('/')
      return params
    }

    const actual = pathSegments[index]
    if (actual === undefined) return null

    if (expected.startsWith(':')) {
      const name = expected.slice(1)
      params[name] = safeDecode(actual)
      continue
    }

    if (expected !== actual) return null
  }

  if (pathSegments.length !== patternSegments.length) return null

  return params
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Builds a fragment for a path and an optional query. */
export function buildHash(path: string, query?: URLSearchParams | Record<string, string>): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const params =
    query instanceof URLSearchParams ? query : new URLSearchParams(query ?? {})

  const search = params.toString()
  return `#${normalized}${search ? `?${search}` : ''}`
}

/** Joins a base path with a path that may be relative. */
export function joinPath(base: string, path: string): string {
  if (!path) return base
  if (path.startsWith('/')) return path
  const trimmed = base.replace(/\/+$/, '')
  return `${trimmed}/${path}`
}

const KNOWN_BARE_HASHES = /^#\/|^#(landing|app|workspace|posts|insights|login|signup|verify)(\/|\?|$)/

/** Reads either a legacy `#/route` fragment (ignoring OAuth tokens) or clean `pathname + search`. */
export function parseBrowserLocation(
  pathname: string,
  search: string,
  hash: string,
): ParsedLocation {
  if (hash && KNOWN_BARE_HASHES.test(hash)) {
    return parseHash(hash)
  }
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const trimmed = normalized.replace(/\/+$/, '')
  return {
    path: trimmed.length > 0 ? trimmed : '/',
    query: new URLSearchParams(search.replace(/^\?/, '')),
  }
}

/** Normalizes any internal route string (with or without leading `#`) into a clean `/path?query`. */
export function normalizeRouteTarget(to: string): string {
  const clean = to.startsWith('#') ? to.slice(1) : to
  return clean.startsWith('/') ? clean : `/${clean}`
}
