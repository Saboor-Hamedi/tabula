/**
 * Every route in the product, in one place.
 *
 * Clean pathname URLs:
 *   /landing                         front page (with Posts search)
 *   /app, /:username/app             Analyse dashboard
 *   /workspace, /:username/workspace chat workspace
 *   /posts, /posts/:slug             published posts (+ legacy /insights aliases)
 */

export const ROUTES = {
  landing: '/landing',
  dashboard: '/app',
  userDashboard: '/:username/app',
  workspace: '/workspace',
  userWorkspace: '/:username/workspace',
  posts: '/posts',
  post: '/posts/:slug',
  insights: '/insights',
  insight: '/insights/:slug',
  signIn: '/login',
  signUp: '/signup',
  verify: '/verify',
  notFound: '*',
} as const

export type RouteName = keyof typeof ROUTES

const RESERVED_SLUGS = new Set([
  'landing',
  'app',
  'workspace',
  'posts',
  'insights',
  'login',
  'signup',
  'verify',
  'api',
  'assets',
])

/** Turns a display name or email local-part into a clean URL username segment. */
export function slugifyUsername(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!cleaned) return null
  return RESERVED_SLUGS.has(cleaned) ? `u-${cleaned}` : cleaned
}

/** Returns `/${slug}/workspace` or `/${slug}/app` when a username is known. */
export function userPath(base: '/app' | '/workspace', usernameSlug?: string | null): string {
  return usernameSlug ? `/${encodeURIComponent(usernameSlug)}${base}` : base
}

/** Builds a concrete path for a post article. */
export function postPath(slug: string): string {
  return `/posts/${encodeURIComponent(slug)}`
}

/** Legacy alias preserved for internal callers. */
export function insightPath(slug: string): string {
  return postPath(slug)
}

/** Builds the posts index URL, optionally filtered by a tag. */
export function postsPath(tag?: string | null): string {
  if (!tag) return ROUTES.posts
  return `${ROUTES.posts}?tag=${encodeURIComponent(tag)}`
}

export function insightsPath(tag?: string | null): string {
  return postsPath(tag)
}
