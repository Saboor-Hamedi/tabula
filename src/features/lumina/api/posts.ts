import { supabase } from '../../../core/supabase/client'

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
}

const TABLE = 'lumina_posts'

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

/** Creates or updates a Lumina post in `public.lumina_posts`. */
export async function saveLuminaPost(input: SaveLuminaPostInput): Promise<LuminaPost> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const cleanTitle = input.title.trim()
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

  const cleanContent = input.content.trim()
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

/** Deletes a Lumina post by ID. */
export async function deleteLuminaPost(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Increments view count safely via RPC. */
export async function incrementLuminaPostView(slug: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('lumina_increment_post_view', { p_slug: slug }).then(() => {}).catch(() => {})
}
