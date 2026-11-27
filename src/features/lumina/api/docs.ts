import { supabase } from '../../../core/supabase/client'
import { sanitizeMarkdownInput } from '../components/Markdown'
import { slugifyLuminaTitle } from './posts'

export type LuminaDocSection = 'Prologue' | 'Features' | 'Reference' | 'Legal'

export interface LuminaDocRecord {
  id?: string
  slug: string
  section: LuminaDocSection
  title: string
  subtitle: string | null
  summary: string | null
  content: string
  sort_order: number
  published: boolean
  created_at?: string
  updated_at?: string
}

const TABLE = 'lumina_docs'

/** Fetches published documentation overrides/pages from `public.lumina_docs`. */
export async function fetchLuminaDocsMap(): Promise<Record<string, LuminaDocRecord>> {
  if (!supabase) return {}
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })

    if (error || !Array.isArray(data)) return {}
    const map: Record<string, LuminaDocRecord> = {}
    for (const row of data as LuminaDocRecord[]) {
      if (row.slug) {
        map[row.slug] = row
      }
    }
    return map
  } catch {
    return {}
  }
}

/** Searches documentation in Supabase via `public.lumina_search_docs` (`pg_trgm`). */
export async function searchLuminaDocsInDb(query: string): Promise<LuminaDocRecord[]> {
  if (!supabase || !query.trim()) return []
  try {
    const { data, error } = await supabase.rpc('lumina_search_docs', {
      p_query: query.trim(),
      p_include_drafts: false,
      p_limit: 12,
    })
    if (error || !Array.isArray(data)) return []
    return data as LuminaDocRecord[]
  } catch {
    return []
  }
}

/** Lists all documentation records from `public.lumina_docs` for the Dashboard CRUD panel. */
export async function listAllLuminaDocs(): Promise<LuminaDocRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as LuminaDocRecord[]
}

/** Creates or updates a documentation page in `public.lumina_docs`. */
export async function saveLuminaDoc(doc: LuminaDocRecord): Promise<LuminaDocRecord> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const cleanTitle = sanitizeMarkdownInput(doc.title).trim()
  if (cleanTitle.length < 2) {
    throw new Error('Documentation title is required.')
  }
  const cleanSlug = slugifyLuminaTitle(doc.slug || cleanTitle)
  if (!cleanSlug) {
    throw new Error('A valid documentation slug is required.')
  }

  const payload = {
    slug: cleanSlug,
    section: doc.section,
    title: cleanTitle,
    subtitle: doc.subtitle ? sanitizeMarkdownInput(doc.subtitle).trim() : null,
    summary: doc.summary ? sanitizeMarkdownInput(doc.summary).trim() : null,
    content: sanitizeMarkdownInput(doc.content),
    sort_order: Number.isFinite(doc.sort_order) ? doc.sort_order : 100,
    published: doc.published ?? true,
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'slug' })
    .select('*')
    .single()

  if (error) {
    const denied = error.code === '42501' || /row-level security/i.test(error.message)
    throw new Error(denied ? 'Only administrators can modify Lumina documentation.' : error.message)
  }
  return data as LuminaDocRecord
}

/** Deletes a documentation page from `public.lumina_docs` by slug. */
export async function deleteLuminaDoc(slug: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from(TABLE).delete().eq('slug', slug)
  if (error) throw new Error(error.message)
}
