import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'

interface AuthContextType {
  currentUser: User | null
  session: Session | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAdmin: boolean
  isSuperAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    if (!error.message?.includes('Lock')) {
      console.error('Failed to load profile', error)
    }
    return null
  }
  return data as UserProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe,
    // so we don't need a separate getSession() call (which doubles the profile fetch).
    let lastUserId: string | null = null

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      const userId = newSession?.user?.id ?? null
      setCurrentUser(newSession?.user ?? null)

      // Only refetch the profile when the user identity actually changes.
      // TOKEN_REFRESHED / USER_UPDATED keep the same user, so re-fetching
      // their profile every hour adds latency for no reason.
      if (userId && userId !== lastUserId) {
        const profile = await fetchProfile(userId)
        setUserProfile(profile)
      } else if (!userId) {
        setUserProfile(null)
      }
      lastUserId = userId
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setLoading(false)
      }
    })

    // When the tab regains focus, proactively touch the session so any
    // expired token is refreshed *before* the user navigates and feels lag.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        // Send users back to the origin they signed up from after clicking the
        // email confirmation link. Without this, Supabase uses Site URL — which
        // is "localhost:3000" in fresh projects and breaks confirmations from prod.
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw error

    if (data.user) {
      const profile = await fetchProfile(data.user.id)
      if (profile && profile.display_name !== displayName) {
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', data.user.id)
        setUserProfile({ ...profile, display_name: displayName })
      } else {
        setUserProfile(profile)
      }
    }
  }

  const signOut = async () => {
    // scope: 'local' clears local storage instantly without a server round-trip,
    // so the button feels snappy. We also clear React state immediately rather
    // than waiting for onAuthStateChange.
    await supabase.auth.signOut({ scope: 'local' })
    setSession(null)
    setCurrentUser(null)
    setUserProfile(null)
  }

  const refreshProfile = async () => {
    if (!currentUser) return
    const profile = await fetchProfile(currentUser.id)
    setUserProfile(profile)
  }

  const isSuperAdmin = userProfile?.role === 'super_admin'
  const isAdmin = isSuperAdmin || userProfile?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        isAdmin,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
