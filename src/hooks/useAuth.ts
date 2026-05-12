import { useState, useEffect } from 'react'
import { User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return auth.onAuthStateChanged((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
  const signOut = () => firebaseSignOut(auth)

  return { user, loading, signIn, signOut }
}
