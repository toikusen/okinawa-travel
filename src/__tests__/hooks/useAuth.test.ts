// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const {
  mockUnsubscribe,
  mockSignInWithOAuth,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
} = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}))

vi.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  },
}))

import { useAuth } from '../../hooks/useAuth'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  })
})

describe('useAuth', () => {
  it('resolves loading and sets user to null when unauthenticated', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('calls signInWithOAuth with google provider on signIn()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    await act(() => result.current.signIn())
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    )
  })

  it('calls supabase signOut on signOut()', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    await act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes auth listener on unmount', async () => {
    const { unmount } = renderHook(() => useAuth())
    await act(async () => {})
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
