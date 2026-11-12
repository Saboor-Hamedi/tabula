import { useSyncExternalStore } from 'react'
import { supabase } from './client'
import type { PricingTier, SubscriptionStatus } from './types'

export interface UsageStatus {
  tier: PricingTier
  status: SubscriptionStatus | string
  isAdmin: boolean
  hasAccess: boolean
  trialEndsAt: string | null
  trialDaysRemaining: number | null
  trialExpired: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  usedTokens: number
  inputTokens: number
  outputTokens: number
  queryCount: number
  monthlyLimit: number | null
  remainingTokens: number | null
  periodStart: string
  stripeConfigured: boolean
}

export type PricingModalReason = 'trial-expired' | 'quota-exceeded' | 'upgrade' | null

export interface BillingUiSnapshot {
  usage: UsageStatus | null
  loading: boolean
  error: string | null
  pricingModalOpen: boolean
  pricingModalReason: PricingModalReason
}

type Listener = () => void

let snapshot: BillingUiSnapshot = {
  usage: null,
  loading: false,
  error: null,
  pricingModalOpen: false,
  pricingModalReason: null,
}

const listeners = new Set<Listener>()
let inflightRefresh: Promise<UsageStatus | null> | null = null

function emit(next: Partial<BillingUiSnapshot>) {
  snapshot = { ...snapshot, ...next }
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeUsage(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getUsageSnapshot(): BillingUiSnapshot {
  return snapshot
}

export function useUsageStatus(): BillingUiSnapshot {
  return useSyncExternalStore(subscribeUsage, getUsageSnapshot, getUsageSnapshot)
}

export function clearUsageState(): void {
  emit({
    usage: null,
    loading: false,
    error: null,
    pricingModalOpen: false,
    pricingModalReason: null,
  })
}

export function openPricingModal(reason: PricingModalReason = 'upgrade'): void {
  emit({ pricingModalOpen: true, pricingModalReason: reason })
}

export function closePricingModal(): void {
  emit({ pricingModalOpen: false })
}

export function setLiveTokensRemaining(tokensRemaining: number): void {
  if (!snapshot.usage) return
  const clamped = Math.max(0, Math.round(tokensRemaining))
  const limit = snapshot.usage.monthlyLimit
  const usedTokens =
    limit !== null ? Math.max(0, limit - clamped) : snapshot.usage.usedTokens
  emit({
    usage: {
      ...snapshot.usage,
      remainingTokens: clamped,
      usedTokens,
    },
  })
}

async function fetchLiveBalanceFromSupabase(userId: string): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_balances')
    .select('tokens_remaining')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data || typeof data.tokens_remaining !== 'number') return null
  return Math.max(0, data.tokens_remaining)
}

async function buildUsageFromSupabaseFallback(userId: string): Promise<UsageStatus | null> {
  if (!supabase) return null
  const [profileRes, subRes, balanceTokens] = await Promise.all([
    supabase.from('profiles').select('role, tier').eq('id', userId).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    fetchLiveBalanceFromSupabase(userId),
  ])

  const isAdmin = profileRes.data?.role === 'admin'
  const tier = (subRes.data?.tier ?? profileRes.data?.tier ?? 'free') as PricingTier
  const status = (subRes.data?.status ?? 'trialing') as SubscriptionStatus | string
  const trialEndsAt = subRes.data?.trial_ends_at ?? null
  const trialMsLeft = trialEndsAt ? Date.parse(trialEndsAt) - Date.now() : null
  const trialDaysRemaining =
    trialMsLeft !== null ? Math.max(0, Math.ceil(trialMsLeft / 86_400_000)) : null
  const trialExpired =
    !isAdmin && tier === 'free' && trialMsLeft !== null && trialMsLeft <= 0
  const hasAccess = isAdmin || tier !== 'free' || !trialExpired
  const monthlyLimit =
    isAdmin || tier === 'enterprise' ? null : tier === 'pro' ? 5_000_000 : 250_000
  const remainingTokens =
    isAdmin || tier === 'enterprise' ? null : (balanceTokens ?? monthlyLimit)
  const usedTokens =
    monthlyLimit !== null && remainingTokens !== null
      ? Math.max(0, monthlyLimit - remainingTokens)
      : 0

  return {
    tier,
    status,
    isAdmin,
    hasAccess,
    trialEndsAt,
    trialDaysRemaining,
    trialExpired,
    currentPeriodEnd: subRes.data?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(subRes.data?.cancel_at_period_end),
    usedTokens,
    inputTokens: 0,
    outputTokens: 0,
    queryCount: 0,
    monthlyLimit,
    remainingTokens,
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    stripeConfigured: false,
  }
}

export async function refreshUsage(): Promise<UsageStatus | null> {
  if (!supabase) return null
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
    emit({ loading: snapshot.usage === null, error: null })
    try {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      const token = session?.access_token
      const userId = session?.user?.id
      if (!token || !userId) {
        clearUsageState()
        return null
      }

      const [apiRes, liveBalance] = await Promise.all([
        fetch('/api/usage', {
          headers: { authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetchLiveBalanceFromSupabase(userId),
      ])

      let usage: UsageStatus | null = null
      if (apiRes && apiRes.ok) {
        usage = (await apiRes.json()) as UsageStatus
      } else {
        usage = await buildUsageFromSupabaseFallback(userId)
      }

      if (!usage) {
        emit({ loading: false, error: 'Could not load usage status.' })
        return null
      }

      if (liveBalance !== null && !usage.isAdmin && usage.tier !== 'enterprise') {
        usage = {
          ...usage,
          remainingTokens: liveBalance,
          usedTokens:
            usage.monthlyLimit !== null
              ? Math.max(0, usage.monthlyLimit - liveBalance)
              : usage.usedTokens,
        }
      }

      emit({ usage, loading: false, error: null })
      return usage
    } catch {
      emit({ loading: false, error: 'Could not reach usage service.' })
      return null
    } finally {
      inflightRefresh = null
    }
  })()

  return inflightRefresh
}

export function canUseWorkspaceAnalysis(): boolean {
  if (!supabase) return false
  if (!snapshot.usage) return true
  return snapshot.usage.hasAccess
}

export function isQuotaExhausted(): boolean {
  const usage = snapshot.usage
  if (!usage || usage.isAdmin) return false
  return usage.monthlyLimit !== null && usage.remainingTokens !== null && usage.remainingTokens <= 0
}

export async function startStripeCheckout(): Promise<string> {
  if (!supabase) {
    throw new Error('Authentication is not configured.')
  }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sign in to upgrade your plan.')
  }

  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ billingCycle: 'monthly' }),
  })

  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? 'Could not start Stripe Checkout.')
  }
  return body.url
}

export async function openStripeBillingPortal(): Promise<string> {
  if (!supabase) {
    throw new Error('Authentication is not configured.')
  }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('Sign in to manage billing.')
  }

  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  })

  const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
  if (!res.ok || !body?.url) {
    throw new Error(body?.error ?? 'Could not open Stripe Billing Portal.')
  }
  return body.url
}
