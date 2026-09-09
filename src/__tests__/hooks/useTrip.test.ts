import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { TripDataHandlers } from '../../lib/db'

const { handlers } = vi.hoisted(() => ({
  handlers: { current: null as TripDataHandlers | null },
}))

vi.mock('../../lib/db', () => ({
  subscribeToTripData: (_id: string, h: TripDataHandlers) => {
    handlers.current = h
    return () => {}
  },
}))

import { useTrip } from '../../hooks/useTrip'

describe('useTrip', () => {
  beforeEach(() => localStorage.clear())

  it('exposes events grouped by day', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    handlers.current!.onEvents({ d1: [{ id: 'e1' }] } as never)
    await waitFor(() => expect(result.current.eventsByDay.d1).toHaveLength(1))
  })

  it('caches events per trip, not per day', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    handlers.current!.onEvents({ d1: [{ id: 'e1' }] } as never)
    await waitFor(() => expect(localStorage.getItem('sb_events_t1')).toBeTruthy())
    expect(result.current.eventsByDay.d1).toHaveLength(1)
  })

  it('stops loading once the trip arrives', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    expect(result.current.loading).toBe(true)
    handlers.current!.onTrip({ id: 't1', name: '沖繩' } as never)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
