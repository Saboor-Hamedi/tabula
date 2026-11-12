import { supabase } from './client'

/**
 * Admin-only client bridge for the single platform API key.
 *
 * The key is never stored in localStorage and never read directly from
 * Supabase by the browser. All reads/writes go through `/api/admin/key`,
 * which verifies `role = 'admin'`, encrypts the key at rest, and only ever
 * returns a masked status preview.
 */

export interface PlatformKeyStatus {
  configured: boolean
  masked: string | null
}

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

export async function fetchPlatformKeyStatus(): Promise<PlatformKeyStatus> {
  const headers = await getAdminAuthHeaders()
  const res = await fetch('/api/admin/key', { headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Unable to check platform API key status.')
  }
  return (await res.json()) as PlatformKeyStatus
}

export async function savePlatformApiKey(apiKey: string): Promise<PlatformKeyStatus> {
  const headers = await getAdminAuthHeaders()
  const res = await fetch('/api/admin/key', {
    method: 'PUT',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ apiKey: apiKey.trim() }),
  })
  const body = (await res.json().catch(() => null)) as (PlatformKeyStatus & { error?: string }) | null
  if (!res.ok) {
    throw new Error(body?.error ?? 'Could not save the API key.')
  }
  return {
    configured: Boolean(body?.configured),
    masked: body?.masked ?? null,
  }
}

export async function deletePlatformApiKey(): Promise<PlatformKeyStatus> {
  const headers = await getAdminAuthHeaders()
  const res = await fetch('/api/admin/key', {
    method: 'DELETE',
    headers,
  })
  const body = (await res.json().catch(() => null)) as (PlatformKeyStatus & { error?: string }) | null
  if (!res.ok) {
    throw new Error(body?.error ?? 'Could not remove the API key.')
  }
  return {
    configured: Boolean(body?.configured),
    masked: body?.masked ?? null,
  }
}
