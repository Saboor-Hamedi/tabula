import { supabase } from '../../core/supabase/client'

/**
 * The administration data layer.
 *
 * Everything here is admin-only: the database refuses a member, and the
 * dashboard never offers a control that would not work.
 *
 * The numbers are worked out from the rows that are read, so the dashboard
 * needs nothing beyond the two read policies — no view, no function.
 */

/** One member, with their subscription and their last login. */
export interface Member {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  tier: string | null
  role: string | null
  last_sign_in_at: string | null
  joined_at: string | null
  subscription_status: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
}

export class AdminError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminError'
  }
}

interface SubscriptionRow {
  user_id: string
  status: string | null
  tier: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  created_at: string
}

/** Every member, newest first, with their latest subscription. */
export async function listMembers(): Promise<Member[]> {
  if (!supabase) throw new AdminError('Supabase is not configured.')

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profileError) {
    if (/row-level security|permission/i.test(profileError.message)) {
      throw new AdminError(
        'Only administrators can read the member list. Apply the administrator policies in features/migration/migration.sql.',
      )
    }
    throw new AdminError(profileError.message)
  }

  const profiles = (profileRows ?? []) as Record<string, unknown>[]

  const { data: subscriptionRows } = await supabase
    .from('subscriptions')
    .select(
      'user_id, status, tier, current_period_start, current_period_end, cancel_at_period_end, created_at',
    )
    .order('created_at', { ascending: false })

  const byUser = new Map<string, SubscriptionRow>()
  for (const row of (subscriptionRows ?? []) as SubscriptionRow[]) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, row)
  }

  return profiles.map((profile) => {
    const subscription = byUser.get(String(profile.id))
    return {
      id: String(profile.id),
      email: (profile.email as string | null) ?? null,
      display_name: (profile.display_name as string | null) ?? null,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      tier: (profile.tier as string | null) ?? null,
      role: (profile.role as string | null) ?? null,
      last_sign_in_at: (profile.last_sign_in_at as string | null) ?? null,
      joined_at: (profile.created_at as string | null) ?? null,
      subscription_status: subscription?.status ?? null,
      current_period_start: subscription?.current_period_start ?? null,
      current_period_end: subscription?.current_period_end ?? null,
      cancel_at_period_end: subscription?.cancel_at_period_end ?? null,
    }
  })
}
