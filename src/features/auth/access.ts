import { isSupabaseConfigured } from '../../core/supabase/client'

/**
 * Whether the product has an account system.
 *
 * Without a project configured there is no sign-in, so every route is open and
 * the product runs entirely on the device.
 */
export function isOpenAccess(): boolean {
  return !isSupabaseConfigured
}
