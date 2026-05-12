// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.fn()
const mockSignInWithPopup = vi.fn()
const mockSignOut = vi.fn()

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  getAuth: vi.fn(),
}))

vi.mock('../../firebase', () => ({
  auth: {
    onAuthStateChanged: (cb: (u: null) => void) => {
      cb(null)
      return mockUnsubscribe
    },
  },
}))

import { useAuth } from '../../hooks/useAuth'

beforeEach(() => vi.clearAllMocks())

describe('useAuth', () => {
  it('resolves loading and sets user to null when unauthenticated', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('calls signInWithPopup on signIn()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(() => result.current.signIn())
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1)
  })

  it('calls signOut on signOut()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes auth listener on unmount', () => {
    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
