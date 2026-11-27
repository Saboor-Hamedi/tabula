import { supabase } from '../../../core/supabase/client'
import { sanitizeMarkdownInput } from '../components/Markdown'

export type LuminaPostCategory = 'Release' | 'Guide' | 'Feature' | 'Announcement'
export type LuminaPostStatus = 'draft' | 'published' | 'archived'

export interface LuminaPost {
  id: string
  slug: string
  title: string
  category: LuminaPostCategory
  status: LuminaPostStatus
  version: string | null
  summary: string
  content: string
  cover_image_url: string | null
  tags: string[]
  featured: boolean
  /** Slug of the parent post; null means this is a top-level post. */
  parent_slug: string | null
  /** Position among siblings — lower numbers appear first. */
  sort_order: number
  published: boolean
  reading_time_minutes: number
  view_count: number
  author_name: string
  author_avatar_url: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface SaveLuminaPostInput {
  id?: string
  title: string
  slug?: string
  category: LuminaPostCategory
  status?: LuminaPostStatus
  version?: string | null
  summary?: string
  content: string
  tags?: string[]
  featured?: boolean
  published?: boolean
  parentSlug?: string | null
  sortOrder?: number
}

const TABLE = 'lumina_posts'

let hierarchyColumnsReady: boolean | null = null

/**
 * Nested-post columns are additive. Older databases (or a schema cache that
 * has not reloaded yet) must keep working, so feature-detect once and omit the
 * new columns from writes when they are unavailable.
 */
export async function hasLuminaPostHierarchy(): Promise<boolean> {
  if (!supabase) return false
  if (hierarchyColumnsReady !== null) return hierarchyColumnsReady
  const { error } = await supabase.from(TABLE).select('parent_slug').limit(1)
  hierarchyColumnsReady = !error
  return hierarchyColumnsReady
}

export function slugifyLuminaTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

export function estimateMarkdownReadingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function deriveMarkdownSummary(markdown: string): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        Boolean(l) &&
        !l.startsWith('#') &&
        !l.startsWith('```') &&
        !l.startsWith('|') &&
        !l.startsWith('>'),
    )
  const first = (lines[0] || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
  return first.slice(0, 260)
}

/** True when `candidate` sits somewhere below `ancestorSlug` in the post tree. */
export function isLuminaPostDescendant(
  candidate: { slug: string; parent_slug: string | null },
  ancestorSlug: string,
  bySlug: Map<string, { slug: string; parent_slug: string | null }>,
): boolean {
  let cursor = candidate.parent_slug
  const visited = new Set<string>()
  while (cursor && !visited.has(cursor)) {
    if (cursor === ancestorSlug) return true
    visited.add(cursor)
    cursor = bySlug.get(cursor)?.parent_slug ?? null
  }
  return false
}

export interface LuminaPostTreeNode {
  post: LuminaPost
  children: LuminaPostTreeNode[]
}

/**
 * Builds a nested post tree. Posts whose parent is missing, filtered out, or
 * would create a cycle are promoted to roots so no post is ever hidden.
 */
export function buildLuminaPostTree(posts: LuminaPost[]): LuminaPostTreeNode[] {
  const bySlug = new Map(posts.map((post) => [post.slug, post]))
  const nodes = new Map<string, LuminaPostTreeNode>()
  for (const post of posts) {
    nodes.set(post.slug, { post, children: [] })
  }

  const roots: LuminaPostTreeNode[] = []
  for (const post of posts) {
    const node = nodes.get(post.slug)!
    const parentNode = post.parent_slug ? nodes.get(post.parent_slug) : undefined
    const parentPost = post.parent_slug ? bySlug.get(post.parent_slug) : undefined
    if (!parentNode || !parentPost) {
      roots.push(node)
      continue
    }
    if (parentNode === node || isLuminaPostDescendant(parentPost, post.slug, bySlug)) {
      roots.push(node)
      continue
    }
    parentNode.children.push(node)
  }

  const compare = (a: LuminaPostTreeNode, b: LuminaPostTreeNode) =>
    a.post.sort_order - b.post.sort_order ||
    Number(b.post.featured) - Number(a.post.featured) ||
    (b.post.published_at || b.post.created_at).localeCompare(
      a.post.published_at || a.post.created_at,
    ) ||
    a.post.title.localeCompare(b.post.title)

  const sortTree = (list: LuminaPostTreeNode[]) => {
    list.sort(compare)
    for (const node of list) sortTree(node.children)
  }
  sortTree(roots)
  return roots
}

function normalizePostRow(row: Record<string, unknown>): LuminaPost {
  const published = Boolean(row.published ?? row.status === 'published')
  const rawStatus = row.status as LuminaPostStatus | undefined
  const status: LuminaPostStatus =
    rawStatus === 'draft' || rawStatus === 'archived' || rawStatus === 'published'
      ? rawStatus
      : published
        ? 'published'
        : 'draft'

  return {
    id: String(row.id ?? ''),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    category: (row.category as LuminaPostCategory) || 'Release',
    status,
    version: row.version ? String(row.version) : null,
    summary: String(row.summary ?? ''),
    content: String(row.content ?? ''),
    cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    featured: Boolean(row.featured),
    parent_slug: row.parent_slug ? String(row.parent_slug) : null,
    sort_order:
      row.sort_order == null
        ? 100
        : Number.isFinite(Number(row.sort_order))
          ? Number(row.sort_order)
          : 100,
    published: status === 'published',
    reading_time_minutes: Number(row.reading_time_minutes ?? 1),
    view_count: Number(row.view_count ?? 0),
    author_name: String(row.author_name ?? 'Saboor Hamedi'),
    author_avatar_url: row.author_avatar_url ? String(row.author_avatar_url) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

/**
 * Lists Lumina posts using PostgreSQL `pg_trgm` (`public.lumina_search_posts` RPC)
 * when searching, or standard indexed ordering when listing without a search query.
 */
export async function listLuminaPosts(options?: {
  category?: LuminaPostCategory | 'All'
  includeDrafts?: boolean
  search?: string
}): Promise<LuminaPost[]> {
  if (!supabase) return []

  const searchTerm = options?.search?.trim() || ''
  const categoryArg =
    options?.category && options.category !== 'All' ? options.category : null

  if (searchTerm.length > 0) {
    const { data: rpcData, error: rpcError } = await supabase.rpc('lumina_search_posts', {
      p_query: searchTerm,
      p_category: categoryArg,
      p_include_drafts: Boolean(options?.includeDrafts),
      p_limit: 40,
      p_offset: 0,
    })

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData.map((r) => normalizePostRow(r as Record<string, unknown>))
    }
  }

  let query = supabase
    .from(TABLE)
    .select('*')
    .order('featured', { ascending: false })
  if (await hasLuminaPostHierarchy()) {
    query = query.order('sort_order', { ascending: true })
  }
  query = query
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (!options?.includeDrafts) {
    query = query.eq('published', true)
  }

  if (categoryArg) {
    query = query.eq('category', categoryArg)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) {
    return []
  }

  return data.map((r) => normalizePostRow(r as Record<string, unknown>))
}

/** Lists all Lumina posts (including drafts and archived) for the Dashboard CRUD panel. */
export async function listAllLuminaPosts(): Promise<LuminaPost[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((r) => normalizePostRow(r as Record<string, unknown>))
}

/** Fetches a single Lumina post by slug from `public.lumina_posts`. */
export async function fetchLuminaPostBySlug(slug: string): Promise<LuminaPost | null> {
  if (!supabase) return null
  const cleanSlug = slug.trim().toLowerCase()
  if (!cleanSlug) return null

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('slug', cleanSlug)
    .maybeSingle()

  if (error || !data) return null
  return normalizePostRow(data as Record<string, unknown>)
}

/** Lists the direct sub-topics of a post, in display order. */
export async function listLuminaPostChildren(parentSlug: string): Promise<LuminaPost[]> {
  if (!supabase) return []
  const cleanSlug = slugifyLuminaTitle(parentSlug)
  if (!cleanSlug) return []
  if (!(await hasLuminaPostHierarchy())) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('parent_slug', cleanSlug)
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false })
  if (error || !Array.isArray(data)) return []
  return data.map((row) => normalizePostRow(row as Record<string, unknown>))
}

/** Creates or updates a Lumina post in `public.lumina_posts`. */
export async function saveLuminaPost(input: SaveLuminaPostInput): Promise<LuminaPost> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }
  const hierarchyReady = await hasLuminaPostHierarchy()

  const cleanTitle = sanitizeMarkdownInput(input.title).trim()
  if (cleanTitle.length < 3) {
    throw new Error('Post title must be at least 3 characters.')
  }
  if (cleanTitle.length > 240) {
    throw new Error('Post title cannot exceed 240 characters.')
  }

  const cleanSlug = slugifyLuminaTitle(input.slug || cleanTitle)
  if (!cleanSlug) {
    throw new Error('A valid URL slug is required.')
  }

  const cleanParent = input.parentSlug ? slugifyLuminaTitle(input.parentSlug) : ''
  const parentSlug =
    hierarchyReady && cleanParent && cleanParent !== cleanSlug ? cleanParent : null
  const rawSortOrder = input.sortOrder
  const sortOrder =
    rawSortOrder != null && Number.isFinite(Number(rawSortOrder))
      ? Math.max(-1000, Math.min(1000, Math.round(Number(rawSortOrder))))
      : 100

  let previousSlug: string | null = null
  if (input.id) {
    const { data: existing } = await supabase
      .from(TABLE)
      .select('slug')
      .eq('id', input.id)
      .maybeSingle()
    previousSlug = existing?.slug ? String(existing.slug) : null

    if (hierarchyReady && parentSlug && parentSlug === (previousSlug ?? cleanSlug)) {
      throw new Error('A post cannot be its own parent.')
    }
    if (hierarchyReady && parentSlug) {
      const { data: minimalRows } = await supabase.from(TABLE).select('slug, parent_slug')
      const minimal = (minimalRows ?? []) as Array<{
        slug: string
        parent_slug: string | null
      }>
      const bySlug = new Map(minimal.map((row) => [row.slug, row]))
      const selectedParent = bySlug.get(parentSlug)
      if (selectedParent && isLuminaPostDescendant(selectedParent, previousSlug ?? cleanSlug, bySlug)) {
        throw new Error('Choose a parent that is not nested under this post.')
      }
    }
  }

  const cleanContent = sanitizeMarkdownInput(input.content).trim()
  if (cleanContent.length < 10) {
    throw new Error('Post content must be at least 10 characters.')
  }

  const resolvedStatus: LuminaPostStatus =
    input.status ?? (input.published === false ? 'draft' : 'published')
  const isPublished = resolvedStatus === 'published'
  const cleanSummary =
    (input.summary?.trim() || deriveMarkdownSummary(cleanContent)).slice(0, 580)
  const cleanTags = (input.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8)

  const payload: Record<string, unknown> = {
    title: cleanTitle,
    slug: cleanSlug,
    category: input.category,
    status: resolvedStatus,
    published: isPublished,
    version: input.version?.trim() || null,
    summary: cleanSummary,
    content: cleanContent,
    tags: cleanTags,
    featured: Boolean(input.featured),
    ...(hierarchyReady ? { parent_slug: parentSlug, sort_order: sortOrder } : {}),
    reading_time_minutes: estimateMarkdownReadingTime(cleanContent),
    published_at: isPublished ? new Date().toISOString() : null,
  }

  if (input.id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()

    if (error) {
      const denied = error.code === '42501' || /row-level security/i.test(error.message)
      throw new Error(denied ? 'Only administrators can update Lumina posts.' : error.message)
    }
    if (hierarchyReady && previousSlug && previousSlug !== cleanSlug) {
      await supabase
        .from(TABLE)
        .update({ parent_slug: cleanSlug })
        .eq('parent_slug', previousSlug)
    }
    return normalizePostRow(data as Record<string, unknown>)
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    const denied = error.code === '42501' || /row-level security/i.test(error.message)
    throw new Error(denied ? 'Only administrators can publish Lumina posts.' : error.message)
  }
  return normalizePostRow(data as Record<string, unknown>)
}

/** Updates a Lumina post status (`published`, `draft`, `archived`). */
export async function setLuminaPostStatus(
  postId: string,
  status: LuminaPostStatus,
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const isPublished = status === 'published'
  const { error } = await supabase
    .from(TABLE)
    .update({
      status,
      published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
    })
    .eq('id', postId)

  if (error) throw new Error(error.message)
}

/**
 * Deletes a Lumina post. By default its children are promoted to its own
 * parent level; with `cascade` they are deleted recursively instead.
 */
export async function deleteLuminaPost(
  id: string,
  options: { cascade?: boolean; _seen?: Set<string> } = {},
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const hierarchyReady = await hasLuminaPostHierarchy()
  const { data: existing } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const row = existing as Record<string, unknown> | null
  const slug = row?.slug ? String(row.slug) : null
  const parentSlug = hierarchyReady && row?.parent_slug ? String(row.parent_slug) : null

  const seen = options._seen ?? new Set<string>()
  if (slug) {
    if (seen.has(slug)) return
    seen.add(slug)
  }

  if (hierarchyReady && options.cascade && slug) {
    const children = await listLuminaPostChildren(slug)
    for (const child of children) {
      await deleteLuminaPost(child.id, { cascade: true, _seen: seen })
    }
  } else if (hierarchyReady && slug) {
    await supabase.from(TABLE).update({ parent_slug: parentSlug }).eq('parent_slug', slug)
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Swaps a post's sort order with the sibling directly above or below it. */
export async function moveLuminaPost(
  postId: string,
  direction: 'up' | 'down',
): Promise<void> {
  if (!supabase || !(await hasLuminaPostHierarchy())) return
  const { data: current } = await supabase
    .from(TABLE)
    .select('parent_slug')
    .eq('id', postId)
    .maybeSingle()
  if (!current) return

  let query = supabase
    .from(TABLE)
    .select('id, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  query = current.parent_slug
    ? query.eq('parent_slug', current.parent_slug)
    : query.is('parent_slug', null)

  const { data: siblings } = await query
  if (!Array.isArray(siblings)) return
  const rows = siblings as Array<{ id: string; sort_order: number }>
  const index = rows.findIndex((row) => row.id === postId)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return

  const source = rows[index]
  const target = rows[targetIndex]
  await Promise.all([
    supabase.from(TABLE).update({ sort_order: target.sort_order }).eq('id', source.id),
    supabase.from(TABLE).update({ sort_order: source.sort_order }).eq('id', target.id),
  ])
}

/** Increments view count safely via RPC. */
export async function incrementLuminaPostView(slug: string): Promise<void> {
  if (!supabase) return
  try {
    await supabase.rpc('lumina_increment_post_view', { p_slug: slug })
  } catch {
    // Ignore view counter errors
  }
}
