import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt') as Event & { prompt?: unknown }
  event.prompt = async () => {}
  window.dispatchEvent(event)
}

describe('useInstallPrompt', () => {
  beforeEach(() => localStorage.clear())

  it('offers installation when the browser fires the event', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => fireBeforeInstallPrompt())
    expect(result.current.canInstall).toBe(true)
  })

  it('stays quiet for 30 days after a dismissal', () => {
    const first = renderHook(() => useInstallPrompt())
    act(() => fireBeforeInstallPrompt())
    act(() => first.result.current.dismiss())
    first.unmount()

    const second = renderHook(() => useInstallPrompt())
    act(() => fireBeforeInstallPrompt())
    expect(second.result.current.canInstall).toBe(false)
  })
})
