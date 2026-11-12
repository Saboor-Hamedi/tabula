import { createContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { AppRole, PricingTier, UserProfile } from '../../core/supabase/types'

/**
 * The session context.
 *
 * Kept apart from the provider and the hook so each file exports one kind of
 * thing.
 */

export interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  tier: PricingTier
  role: AppRole
  isPro: boolean
  isAdmin: boolean
  isVerified: boolean
  needsVerification: boolean
  loading: boolean
  isConfigured: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<Session | null>
  resendVerificationEmail: (email?: string) => Promise<{ error: Error | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<UserProfile | null>
}


export const AuthContext = createContext<AuthState | null>(null)
