"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import type { User as SupabaseUser } from "@supabase/supabase-js"

/**
 * Profile shape returned by the /api/v1/auth/me endpoint.
 * Mirrors the Drizzle `users` table columns.
 */
export interface UserProfile {
  id: string
  fullName: string
  email: string
  role: "admin" | "agent" | "karyawan"
  department: string | null
}

interface AuthContextValue {
  /** Supabase Auth user (JWT-level identity) */
  authUser: SupabaseUser | null
  /** Application profile from the `users` table */
  profile: UserProfile | null
  /** True while the initial session check is in flight */
  loading: boolean
  /** Re-fetch the profile (e.g. after login) */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  authUser: null,
  profile: null,
  loading: true,
  refresh: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createSupabaseBrowserClient()

  /** Fetch the DB profile for the currently authenticated user. */
  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/v1/auth/me")
      if (res.ok) {
        const data = await res.json()
        setProfile(data.user ?? null)
      } else {
        setProfile(null)
      }
    } catch {
      setProfile(null)
    }
  }

  const refresh = async () => {
    if (!supabase) {
      Promise.resolve().then(() => setLoading(false))
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setAuthUser(user)
    if (user) {
      await fetchProfile()
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      Promise.resolve().then(() => {
        if (mounted) setLoading(false);
      });
      return
    }

    // Initial session check
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().finally(() => {
      if (mounted) setLoading(false);
    })

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null
      setAuthUser(user)
      if (user) {
        await fetchProfile()
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false;
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ authUser, profile, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
