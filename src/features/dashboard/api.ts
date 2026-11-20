import { supabase } from '../../core/supabase/client'

/**
 * The administration data layer.
 *
 * Everything here is admin-only: the database refuses a non-admin caller at
 * both the RLS policy level and inside every SECURITY DEFINER RPC.
 */

export interface Member {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  tier: string | null
  role: string | null
  is_suspended: boolean
  suspended_reason: string | null
  suspended_at: string | null
  tokens_remaining: number | null
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

interface BalanceRow {
  user_id: string
  tokens_remaining: number
}

export interface DeletedAccountEntry {
  id: number
  email: string | null
  display_name: string | null
  tier: string | null
  reason: string | null
  note: string | null
  deleted_at: string
}

export interface EmailGrantEntry {
  email: string
  tier: 'free' | 'pro' | 'enterprise'
  duration_days: number
  tokens_granted: number
  note: string | null
  claimed_by: string | null
  claimed_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface AdminAuditLogEntry {
  id: number
  admin_id: string | null
  admin_email: string | null
  action: string
  target_user_id: string | null
  target_email: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export type MemberAdminAction =
  | 'grant_pro_month'
  | 'grant_enterprise_month'
  | 'extend_period'
  | 'reset_trial'
  | 'downgrade_free'
  | 'set_tokens'
  | 'suspend'
  | 'unsuspend'
  | 'delete_user'

/** Recent deleted accounts with optional exit feedback (admin-only). */
export async function listDeletedAccounts(): Promise<DeletedAccountEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('account_deletions')
    .select('id, email, display_name, tier, reason, note, deleted_at')
    .order('deleted_at', { ascending: false })
    .limit(50)

  if (error) {
    return []
  }

  return (data ?? []) as DeletedAccountEntry[]
}

/** Active and historical email Pro grants (admin-only). */
export async function listEmailGrants(): Promise<EmailGrantEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('admin_email_grants')
    .select(
      'email, tier, duration_days, tokens_granted, note, claimed_by, claimed_at, expires_at, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    return []
  }

  return (data ?? []) as EmailGrantEntry[]
}

/** Recent administrator security audit logs (admin-only). */
export async function listAdminAuditLogs(): Promise<AdminAuditLogEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('id, admin_id, admin_email, action, target_user_id, target_email, details, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return []
  }

  return (data ?? []) as AdminAuditLogEntry[]
}

/** Every member, newest first, with their latest subscription and token balance. */
export async function listMembers(): Promise<Member[]> {
  if (!supabase) throw new AdminError('Supabase is not configured.')

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profileError) {
    if (/row-level security|permission/i.test(profileError.message)) {
      throw new AdminError(
        'Only administrators can read the member list. Apply features/migration/admin.sql or tabula.sql in Supabase.',
      )
    }
    throw new AdminError(profileError.message)
  }

  const profiles = (profileRows ?? []) as Record<string, unknown>[]

  const [{ data: subscriptionRows }, { data: balanceRows }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'user_id, status, tier, current_period_start, current_period_end, cancel_at_period_end, created_at',
      )
      .order('created_at', { ascending: false }),
    supabase.from('user_balances').select('user_id, tokens_remaining'),
  ])

  const byUser = new Map<string, SubscriptionRow>()
  for (const row of (subscriptionRows ?? []) as SubscriptionRow[]) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, row)
  }

  const balanceByUser = new Map<string, number>()
  for (const row of (balanceRows ?? []) as BalanceRow[]) {
    if (typeof row.tokens_remaining === 'number') {
      balanceByUser.set(row.user_id, row.tokens_remaining)
    }
  }

  return profiles.map((profile) => {
    const userId = String(profile.id)
    const subscription = byUser.get(userId)
    const tier = (subscription?.tier ?? (profile.tier as string | null) ?? 'free') as string
    const defaultTokens =
      tier === 'enterprise' ? 25_000_000 : tier === 'pro' ? 5_000_000 : 250_000

    return {
      id: userId,
      email: (profile.email as string | null) ?? null,
      display_name: (profile.display_name as string | null) ?? null,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      tier,
      role: (profile.role as string | null) ?? null,
      is_suspended: Boolean(profile.is_suspended),
      suspended_reason: (profile.suspended_reason as string | null) ?? null,
      suspended_at: (profile.suspended_at as string | null) ?? null,
      tokens_remaining: balanceByUser.get(userId) ?? defaultTokens,
      last_sign_in_at: (profile.last_sign_in_at as string | null) ?? null,
      joined_at: (profile.created_at as string | null) ?? null,
      subscription_status: subscription?.status ?? null,
      current_period_start: subscription?.current_period_start ?? null,
      current_period_end: subscription?.current_period_end ?? null,
      cancel_at_period_end: subscription?.cancel_at_period_end ?? null,
    }
  })
}

export interface GrantProByEmailInput {
  email: string
  tier?: 'pro' | 'enterprise'
  days?: number
  tokens?: number
  note?: string
}

export interface GrantProByEmailResult {
  status: 'applied' | 'pre_approved'
  email: string
  user_id: string | null
  tier: string
  duration_days: number
  tokens_remaining: number
  expires_at: string
}

/**
 * Grants Pro (or Enterprise) for a given number of days (default 30 days = 1 full month)
 * to an email address. Applies immediately if the user already has an account,
 * or pre-approves the email so it activates automatically the moment they sign up.
 */
export async function grantProByEmail(
  input: GrantProByEmailInput,
): Promise<GrantProByEmailResult> {
  if (!supabase) throw new AdminError('Supabase is not configured.')

  const cleanedEmail = input.email.trim().toLowerCase()
  if (!cleanedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanedEmail)) {
    throw new AdminError('Please enter a valid email address.')
  }

  const tier = input.tier ?? 'pro'
  const days = Math.max(1, Math.min(input.days ?? 30, 3650))
  const defaultTokens = tier === 'enterprise' ? 25_000_000 : 5_000_000
  const tokens = Math.max(0, Math.min(input.tokens ?? defaultTokens, 100_000_000))

  const { data, error } = await supabase.rpc('admin_grant_pro_by_email', {
    p_email: cleanedEmail,
    p_tier: tier,
    p_days: days,
    p_tokens: tokens,
    p_note: input.note?.trim() || null,
  })

  if (error) {
    if (/function .* does not exist|schema cache/i.test(error.message)) {
      throw new AdminError(
        'Admin RPC is not installed yet. Run features/migration/admin.sql (or tabula.sql) in your Supabase SQL Editor.',
      )
    }
    throw new AdminError(error.message)
  }

  return data as GrantProByEmailResult
}

/** Revokes a pre-approved email grant. */
export async function revokeEmailGrant(email: string): Promise<void> {
  if (!supabase) throw new AdminError('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_revoke_email_grant', {
    p_email: email.trim().toLowerCase(),
  })
  if (error) {
    throw new AdminError(error.message)
  }
}

export interface ManageMemberInput {
  targetUserId: string
  action: MemberAdminAction
  tier?: 'free' | 'pro' | 'enterprise'
  days?: number
  tokens?: number
  reason?: string
}

/**
 * Executes an admin control action on a member account (grant 1-month Pro,
 * extend +30 days, set tokens, reset trial, downgrade to free, suspend/unsuspend,
 * or delete non-admin user).
 */
export async function manageMemberAccess(input: ManageMemberInput): Promise<void> {
  if (!supabase) throw new AdminError('Supabase is not configured.')

  const { error } = await supabase.rpc('admin_manage_member', {
    p_target_user_id: input.targetUserId,
    p_action: input.action,
    p_tier: input.tier ?? null,
    p_days: input.days ?? 30,
    p_tokens: input.tokens ?? null,
    p_reason: input.reason?.trim() || null,
  })

  if (error) {
    if (/function .* does not exist|schema cache/i.test(error.message)) {
      throw new AdminError(
        'Admin RPC is not installed yet. Run features/migration/admin.sql (or tabula.sql) in your Supabase SQL Editor.',
      )
    }
    throw new AdminError(error.message)
  }
}
