// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockChannel, mockRpc, mockStorageFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockChannel = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  }))
  const mockRpc = vi.fn()
  const mockStorageFrom = vi.fn()
  return { mockFrom, mockChannel, mockRpc, mockStorageFrom }
})

vi.mock('../../supabase', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: vi.fn(),
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  },
}))

import {
  createTrip,
  joinTrip,
  createEvent,
  reorderEvents,
} from '../../lib/db'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createTrip', () => {
  it('inserts into trips, trip_members, and days; returns a UUID', async () => {
    const tripsInsert = vi.fn().mockResolvedValue({ error: null })
    const dayInsert = vi.fn().mockResolvedValue({ error: null })
    const memberInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'trips') return { insert: tripsInsert }
      if (table === 'trip_members') return { insert: memberInsert }
      if (table === 'days') return { insert: dayInsert }
      return {}
    })

    const id = await createTrip('沖繩 2025', 'sei@test.com', 'Sei', 'https://avatar.url', '2025-06-11', '2025-06-12')

    // Returns a client-generated UUID (not predictable, just verify format)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(tripsInsert).toHaveBeenCalledWith(expect.objectContaining({ name: '沖繩 2025', owner_email: 'sei@test.com' }))
    expect(memberInsert).toHaveBeenCalledWith({
      trip_id: id,
      user_email: 'sei@test.com',
      display_name: 'Sei',
      avatar_url: 'https://avatar.url',
    })

    const [daysArg] = dayInsert.mock.calls[0] as [Array<{ date: string }>]
    expect(daysArg.length).toBe(2)
    expect(daysArg[0].date).toBe('2025-06-11')
    expect(daysArg[1].date).toBe('2025-06-12')
  })
})

describe('joinTrip', () => {
  it('returns true when join_trip_rpc succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const result = await joinTrip('trip-id', 'user@test.com', 'User', '')
    expect(mockRpc).toHaveBeenCalledWith('join_trip_rpc', { p_trip_id: 'trip-id' })
    expect(result).toBe(true)
  })

  it('returns false when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await joinTrip('bad-trip-id', 'user@test.com', 'User', '')
    expect(result).toBe(false)
  })

  it('returns false when the rpc reports failure (trip not found)', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await joinTrip('missing-trip', 'user@test.com', 'User', '')
    expect(result).toBe(false)
  })
})

describe('createEvent', () => {
  it('calls from("events").insert() and returns the new id', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'event-id' }, error: null }),
        }),
      }),
    })

    const id = await createEvent('trip-id', 'day-id', {
      type: 'shared',
      title: '美麗海水族館',
      time_start: '12:00',
      time_end: '15:00',
      location: '本部町',
      notes: '',
      sort_order: 0,
    })

    expect(mockFrom).toHaveBeenCalledWith('events')
    expect(id).toBe('event-id')
  })
})

describe('reorderEvents', () => {
  it('calls update for each id with correct sort_order', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await reorderEvents('trip-id', 'day-id', ['e1', 'e2', 'e3'])

    expect(mockUpdate).toHaveBeenCalledTimes(3)
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 0 })
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1 })
    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 2 })
    expect(mockEq).toHaveBeenCalledWith('id', 'e1')
    expect(mockEq).toHaveBeenCalledWith('id', 'e2')
    expect(mockEq).toHaveBeenCalledWith('id', 'e3')
  })
})
