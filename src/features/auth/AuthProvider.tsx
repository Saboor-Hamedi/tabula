import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../core/supabase/client'
import { setAuthState } from '../../core/supabase/session'
import { signOutAccount } from '../../core/supabase/signOut'
import { clearUsageState, refreshUsage } from '../../core/supabase/usage'
import type { AppRole, PricingTier, UserProfile } from '../../core/supabase/types'
import { AuthContext, type AuthState } from './context'

/**
 * The account session.
 *
 * Mounted once, at the root. It owns the Supabase listener and publishes the
 * session to the shared store, so no other component ever opens a second
 * listener or has to know how the session is fetched.
 */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(() => isSupabaseConfigured)

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
    if (!supabase) return

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthState({ user: session?.user ?? null, loading: Boolean(session?.user) })
      if (session?.user) {
        void refreshUsage()
        void fetchProfile(session.user.id).then((p) => {
          setProfile(p)
          setLoading(false)
          setAuthState({ user: session.user, profile: p, loading: false })
        })
      } else {
        clearUsageState()
        setLoading(false)
        setAuthState({ user: null, profile: null, loading: false })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthState({ user: session?.user ?? null })
      if (session?.user) {
        void refreshUsage()
        void fetchProfile(session.user.id).then((p) => {
          setProfile(p)
          setAuthState({ user: session.user, profile: p })
        })
      } else {
        clearUsageState()
        setProfile(null)
        setAuthState({ user: null, profile: null })
      }
    })

    const onFocus = () => {
      void refreshUsage()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchProfile])

  // Publish the session so any component can read it without a listener.
  useEffect(() => {
    setAuthState({ user, profile, loading })
  }, [user, profile, loading])

  const signOut = useCallback(async () => {
    setUser(null)
    setSession(null)
    setProfile(null)
    await signOutAccount()
  }, [])

  const refreshSession = useCallback(async () => {
    if (!supabase) return null
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
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
      redirectTo: `${window.location.origin}/login`,
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/workspace`,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signInWithOtp = useCallback(async (targetEmail: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') }
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/workspace`,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null
    const next = await fetchProfile(user.id)
    setProfile(next)
    return next
  }, [user, fetchProfile])

  const tier: PricingTier = profile?.tier ?? 'free'
  const isPro = tier === 'pro' || tier === 'enterprise'
  const role: AppRole = profile?.role ?? 'user'
  const isVerified = Boolean(user && (!user.email || user.email_confirmed_at))
  const needsVerification = Boolean(user && user.email && !user.email_confirmed_at)

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      profile,
      tier,
      role,
      isPro,
      isAdmin: role === 'admin',
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
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      tier,
      role,
      isPro,
      isVerified,
      needsVerification,
      loading,
      signOut,
      refreshSession,
      resendVerificationEmail,
      resetPasswordForEmail,
      signInWithOAuth,
      signInWithOtp,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

