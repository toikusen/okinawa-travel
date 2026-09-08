import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNow } from '../../hooks/useNow'

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the current time on first render', () => {
    vi.setSystemTime(new Date('2026-10-12T09:30:00'))
    const { result } = renderHook(() => useNow())
    expect(result.current.getHours()).toBe(9)
    expect(result.current.getMinutes()).toBe(30)
  })

  it('advances once a minute has passed', () => {
    vi.setSystemTime(new Date('2026-10-12T09:30:00'))
    const { result } = renderHook(() => useNow())
    act(() => {
      vi.setSystemTime(new Date('2026-10-12T09:31:00'))
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.getMinutes()).toBe(31)
  })

  it('clears its interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useNow())
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
