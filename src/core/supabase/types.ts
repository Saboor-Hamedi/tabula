export type PricingTier = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  tier: PricingTier
  created_at: string
  updated_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  tier: PricingTier
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
}
