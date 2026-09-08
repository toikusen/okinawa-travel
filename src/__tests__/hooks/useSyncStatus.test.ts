import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { reportChannelStatus } from '../../lib/realtime'
import { useSyncStatus } from '../../hooks/useSyncStatus'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

describe('useSyncStatus', () => {
  beforeEach(() => setOnline(true))

  it('reports offline regardless of channel state when the browser is offline', () => {
    setOnline(false)
    reportChannelStatus('SUBSCRIBED')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current).toBe('offline')
  })

  it('reports connected when the channel is subscribed', () => {
    reportChannelStatus('SUBSCRIBED')
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current).toBe('connected')
  })

  it('reports error when the channel drops while still online', () => {
    reportChannelStatus('SUBSCRIBED')
    const { result } = renderHook(() => useSyncStatus())
    act(() => reportChannelStatus('CHANNEL_ERROR'))
    expect(result.current).toBe('error')
  })
})
