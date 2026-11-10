import { useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../core/supabase/client'
import type { PricingTier, UserProfile } from '../../core/supabase/types'

export interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  tier: PricingTier
  isPro: boolean
  isVerified: boolean
  needsVerification: boolean
  loading: boolean
  isConfigured: boolean
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        console.warn('Could not fetch user profile:', error.message)
        return null
      }
      return data as UserProfile
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get current session
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchProfile(session.user.id).then((p) => {
          setProfile(p)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchProfile(session.user.id).then((p) => setProfile(p))
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const refreshSession = useCallback(async () => {
    if (!supabase) return null
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        // Fall back to getSession if refresh fails
        const { data: fallback } = await supabase.auth.getSession()
        if (fallback.session) {
          setSession(fallback.session)
          setUser(fallback.session.user)
          return fallback.session
        }
        return null
      }
      if (data.session) {
        setSession(data.session)
        setUser(data.session.user)
        return data.session
      }
      return null
    } catch {
      return null
    }
  }, [])

  const resendVerificationEmail = useCallback(async (targetEmail?: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    const emailToSend = targetEmail || user?.email
    if (!emailToSend) return { error: new Error('No email address provided.') }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: emailToSend,
    })
    return { error: error ? new Error(error.message) : null }
  }, [user])

  const resetPasswordForEmail = useCallback(async (targetEmail: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/#login`,
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/#app`,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signInWithOtp = useCallback(async (targetEmail: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/#app`,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const tier: PricingTier = profile?.tier ?? 'free'
  const isPro = tier === 'pro' || tier === 'enterprise'

  // Verification status (Prompt 4.2)
  // When email confirmation is enabled in Supabase, email_confirmed_at is set once confirmed.
  // OAuth providers (Google/GitHub) automatically set email_confirmed_at.
  const isVerified = Boolean(user && (!user.email || user.email_confirmed_at))
  const needsVerification = Boolean(user && user.email && !user.email_confirmed_at)

  return {
    user,
    session,
    profile,
    tier,
    isPro,
    isVerified,
    needsVerification,
    loading,
    isConfigured: isSupabaseConfigured,
    signOut,
    refreshSession,
    resendVerificationEmail,
    resetPasswordForEmail,
    signInWithOAuth,
    signInWithOtp,
    refreshProfile: () => (user ? fetchProfile(user.id).then(setProfile) : Promise.resolve(null)),
  }
}
