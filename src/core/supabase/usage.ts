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

export async function refreshUsage(): Promise<UsageStatus | null> {
  if (!supabase) return null
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
    emit({ loading: snapshot.usage === null, error: null })
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        clearUsageState()
        return null
      }

      const res = await fetch('/api/usage', {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        emit({ loading: false, error: body?.error ?? 'Could not load usage status.' })
        return null
      }

      const usage = (await res.json()) as UsageStatus
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
