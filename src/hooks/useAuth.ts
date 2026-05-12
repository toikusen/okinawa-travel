import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (redirectTo?: string) =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.origin },
    })

  const signOut = () => supabase.auth.signOut()

  return { user, loading, signIn, signOut }
}
