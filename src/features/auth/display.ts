import { useAuthUser, useProfile } from './useProfile'

/**
 * The name to show for the signed-in member.
 *
 * The display name wins, then the metadata the provider returned, then the
 * e-mail, and finally a neutral fallback.
 */
export function useDisplayName(): string {
  const user = useAuthUser()
  const profile = useProfile()
  return (
    profile?.display_name?.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Guest'
  )
}
