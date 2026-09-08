import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { tripCb, daysCb, eventsCb } = vi.hoisted(() => ({
  tripCb: { current: null as ((t: unknown) => void) | null },
  daysCb: { current: null as ((d: unknown) => void) | null },
  eventsCb: { current: null as ((e: unknown) => void) | null },
}))

vi.mock('../../lib/db', () => ({
  subscribeToTrip: (_id: string, cb: (t: unknown) => void) => { tripCb.current = cb; return () => {} },
  subscribeToDays: (_id: string, cb: (d: unknown) => void) => { daysCb.current = cb; return () => {} },
  subscribeToTripEvents: (_id: string, cb: (e: unknown) => void) => { eventsCb.current = cb; return () => {} },
}))

import { useTrip } from '../../hooks/useTrip'

describe('useTrip', () => {
  beforeEach(() => localStorage.clear())

  it('exposes events grouped by day', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    eventsCb.current!({ d1: [{ id: 'e1' }] })
    await waitFor(() => expect(result.current.eventsByDay.d1).toHaveLength(1))
  })

  it('caches events per trip, not per day', async () => {
    const { result } = renderHook(() => useTrip('t1'))
    eventsCb.current!({ d1: [{ id: 'e1' }] })
    await waitFor(() => expect(localStorage.getItem('sb_events_t1')).toBeTruthy())
    expect(result.current.eventsByDay.d1).toHaveLength(1)
  })
})
