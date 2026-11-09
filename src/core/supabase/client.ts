import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function sanitizeSupabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined
  let url = rawUrl.trim().replace(/^['"]|['"]$/g, '')
  if (!url) return undefined
  // Ensure protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  // Strip trailing slashes
  url = url.replace(/\/+$/, '')
  // Strip accidental REST or Auth paths copied from API documentation
  url = url.replace(/\/rest\/v1\/?$/, '')
  url = url.replace(/\/auth\/v1\/?$/, '')
  return url.replace(/\/+$/, '')
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseUrl = sanitizeSupabaseUrl(rawUrl)
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabaseAnonKey = rawKey?.trim().replace(/^['"]|['"]$/g, '')

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-supabase-anon-key'),
)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
