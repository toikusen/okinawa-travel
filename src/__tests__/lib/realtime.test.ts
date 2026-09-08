// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { reportChannelStatus, getChannelStatus, onChannelStatus } from '../../lib/realtime'

describe('realtime status store', () => {
  it('maps SUBSCRIBED to connected', () => {
    reportChannelStatus('SUBSCRIBED')
    expect(getChannelStatus()).toBe('connected')
  })

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('maps %s to error', (raw) => {
    reportChannelStatus('SUBSCRIBED')
    reportChannelStatus(raw)
    expect(getChannelStatus()).toBe('error')
  })

  it('notifies listeners only on change', () => {
    reportChannelStatus('SUBSCRIBED')
    const listener = vi.fn()
    const off = onChannelStatus(listener)
    reportChannelStatus('SUBSCRIBED')
    expect(listener).not.toHaveBeenCalled()
    reportChannelStatus('CLOSED')
    expect(listener).toHaveBeenCalledWith('error')
    off()
    reportChannelStatus('SUBSCRIBED')
    expect(listener).toHaveBeenCalledOnce()
  })
})
