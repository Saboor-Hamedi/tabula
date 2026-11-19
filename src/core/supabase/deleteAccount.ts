import { clearPersistedWorkspace } from '../storage/persistence'
import { supabase } from './client'

export interface DeleteAccountFeedback {
  reason?: string | null
  note?: string | null
}

/**
 * Permanently deletes the currently signed-in user's account via the
 * `public.delete_my_account()` Supabase RPC (with optional exit feedback),
 * wipes local workspace data, and signs out cleanly.
 */
export async function deleteMyAccount(feedback?: DeleteAccountFeedback): Promise<void> {
  if (!supabase) {
    throw new Error('Account deletion requires a configured Supabase project.')
  }

  const p_reason = feedback?.reason?.trim() || null
  const p_note = feedback?.note?.trim() || null

  const { error } = await supabase.rpc('delete_my_account', { p_reason, p_note })
  if (error) {
    throw new Error(error.message || 'Could not delete account.')
  }

  try {
    await clearPersistedWorkspace()
  } catch {
    // Best-effort local cleanup
  }

  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Session is already invalidated once auth.users row is deleted
  }
}

/**
 * Updates the signed-in user's display name in `public.profiles` and auth metadata.
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<string> {
  const cleaned = displayName.trim()
  if (!cleaned) {
    throw new Error('Display name cannot be empty.')
  }
  if (cleaned.length > 80) {
    throw new Error('Display name must be 80 characters or fewer.')
  }
  if (!supabase) {
    throw new Error('Profile updates require a configured Supabase project.')
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: cleaned })
    .eq('id', userId)

  if (profileError) {
    throw new Error(profileError.message || 'Could not update display name.')
  }

  await supabase.auth.updateUser({
    data: { full_name: cleaned, name: cleaned },
  })

  return cleaned
}
