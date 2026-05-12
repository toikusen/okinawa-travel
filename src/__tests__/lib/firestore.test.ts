// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBatch = {
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}
const mockDocRef = { id: 'mock-trip-id' }

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-col'),
  doc: vi.fn(() => mockDocRef),
  setDoc: vi.fn().mockResolvedValue(undefined),
  writeBatch: vi.fn(() => mockBatch),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  arrayUnion: vi.fn((v: unknown) => v),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-event-id' }),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}))

vi.mock('../../firebase', () => ({ db: {} }))

import {
  createTrip,
  joinTrip,
  createEvent,
  reorderEvents,
} from '../../lib/firestore'
import { setDoc, getDoc, updateDoc, addDoc } from 'firebase/firestore'

beforeEach(() => vi.clearAllMocks())

describe('createTrip', () => {
  it('calls setDoc with trip data and batch-creates day documents', async () => {
    const id = await createTrip('沖繩 2025', 'sei@test.com', '2025-06-11', '2025-06-12')
    expect(setDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({ name: '沖繩 2025', members: ['sei@test.com'] })
    )
    // 2 days: June 11 and June 12
    expect(mockBatch.set).toHaveBeenCalledTimes(2)
    expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    expect(id).toBe('mock-trip-id')
  })
})

describe('joinTrip', () => {
  it('returns false when trip does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any)
    const result = await joinTrip('nonexistent-id', 'user@test.com')
    expect(result).toBe(false)
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('adds email to members and returns true when trip exists', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true } as any)
    const result = await joinTrip('trip-id', 'user@test.com')
    expect(result).toBe(true)
    expect(updateDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({ members: 'user@test.com' })
    )
  })
})

describe('createEvent', () => {
  it('calls addDoc and returns the new event id', async () => {
    const eventData = {
      type: 'shared' as const,
      title: '美麗海水族館',
      time_start: '12:00',
      time_end: '15:00',
      location: '本部町',
      notes: '',
      sort_order: 0,
    }
    const id = await createEvent('trip-id', 'day-id', eventData)
    expect(addDoc).toHaveBeenCalledWith('mock-col', eventData)
    expect(id).toBe('new-event-id')
  })
})

describe('reorderEvents', () => {
  it('batch-updates sort_order for each event id in order', async () => {
    await reorderEvents('trip-id', 'day-id', ['e1', 'e2', 'e3'])
    expect(mockBatch.update).toHaveBeenCalledTimes(3)
    expect(mockBatch.update).toHaveBeenCalledWith(mockDocRef, { sort_order: 0 })
    expect(mockBatch.update).toHaveBeenCalledWith(mockDocRef, { sort_order: 1 })
    expect(mockBatch.update).toHaveBeenCalledWith(mockDocRef, { sort_order: 2 })
    expect(mockBatch.commit).toHaveBeenCalledTimes(1)
  })
})
