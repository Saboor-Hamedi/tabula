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

  const tier: PricingTier = profile?.tier ?? 'free'
  const isPro = tier === 'pro' || tier === 'enterprise'

  return {
    user,
    session,
    profile,
    tier,
    isPro,
    loading,
    isConfigured: isSupabaseConfigured,
    signOut,
    refreshProfile: () => (user ? fetchProfile(user.id).then(setProfile) : Promise.resolve(null)),
  }
}
