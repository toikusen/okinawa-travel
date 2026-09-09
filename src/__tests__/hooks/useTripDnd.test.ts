import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/db', () => ({
  WISHLIST: 'wishlist',
  moveEvent: vi.fn(async () => ({ ok: true })),
  reorderEvents: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))

import { useTripDnd } from '../../hooks/useTripDnd'
import { moveEvent, reorderEvents } from '../../lib/db'
import { toast } from '../../lib/toast'
import type { EventsByDay } from '../../lib/dnd'
import type { TripEvent } from '../../types'

const ev = (id: string): TripEvent => ({
  id, type: 'shared', title: id, time_start: '', time_end: '',
  location: '', notes: '', sort_order: 0,
})

const map = (): EventsByDay => ({
  d1: [ev('a'), ev('b')],
  d2: [ev('c')],
  wishlist: [],
})

type Hook = ReturnType<typeof useTripDnd>

/** dnd-kit drags are unreliable to simulate in jsdom, so the handlers are
 *  driven directly with the same shapes DndContext passes them. */
const drag = async (hook: { current: Hook }, activeId: string, overId: string) => {
  act(() => {
    hook.current.handleDragStart({ active: { id: activeId } } as never)
  })
  await act(async () => {
    await hook.current.handleDragEnd({ active: { id: activeId }, over: { id: overId } } as never)
  })
}

const render = (initial: EventsByDay = map()) =>
  renderHook(({ byDay }) => useTripDnd(byDay, 't1'), { initialProps: { byDay: initial } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(moveEvent).mockResolvedValue({ ok: true })
  vi.mocked(reorderEvents).mockResolvedValue({ ok: true })
})

describe('reordering inside one day', () => {
  it('writes the new order and leaves the day where it was', async () => {
    const { result } = render()
    await drag(result, 'b', 'a')

    expect(reorderEvents).toHaveBeenCalledWith('d1', ['b', 'a'])
    expect(moveEvent).not.toHaveBeenCalled()
  })

  it('writes nothing when the card lands back on itself', async () => {
    const { result } = render()
    await drag(result, 'a', 'a')

    expect(reorderEvents).not.toHaveBeenCalled()
    expect(moveEvent).not.toHaveBeenCalled()
  })
})

describe('moving a card to another day', () => {
  it('moves the row, then fixes its slot in the target day', async () => {
    const { result } = render()
    await drag(result, 'a', 'c')

    expect(moveEvent).toHaveBeenCalledWith('t1', 'a', 'd2')
    // Dropped on 'c', so it goes in front of it.
    expect(reorderEvents).toHaveBeenCalledWith('d2', ['a', 'c'])
  })

  it('accepts a drop on an empty day', async () => {
    const { result } = render({ d1: [ev('a')], d2: [], wishlist: [] })
    await drag(result, 'a', 'd2')

    expect(moveEvent).toHaveBeenCalledWith('t1', 'a', 'd2')
    expect(reorderEvents).toHaveBeenCalledWith('d2', ['a'])
  })

  it('writes nothing when a wishlist card is only reordered within the wishlist', async () => {
    const initial = { d1: [ev('a')], wishlist: [ev('w1'), ev('w2')] }
    const { result } = render(initial)
    await drag(result, 'w2', 'w1')

    expect(moveEvent).not.toHaveBeenCalled()
    expect(reorderEvents).not.toHaveBeenCalled()
    // No optimistic order either — the wishlist has nowhere to store one.
    expect(result.current.byDay).toBe(initial)
  })

  it('unschedules to the wishlist with a null day, and does not sort it', async () => {
    const { result } = render()
    await drag(result, 'a', 'wishlist')

    expect(moveEvent).toHaveBeenCalledWith('t1', 'a', null)
    expect(reorderEvents).not.toHaveBeenCalled()
  })

  it('schedules a wishlist card onto a day', async () => {
    const { result } = render({ d1: [ev('a')], wishlist: [ev('w')] })
    await drag(result, 'w', 'a')

    expect(moveEvent).toHaveBeenCalledWith('t1', 'w', 'd1')
    expect(reorderEvents).toHaveBeenCalledWith('d1', ['w', 'a'])
  })
})

describe('optimistic order', () => {
  it('keeps the dragged order when an unrelated push arrives mid-write', async () => {
    let settle: (r: { ok: boolean }) => void = () => {}
    vi.mocked(reorderEvents).mockImplementation(
      () => new Promise((resolve) => { settle = resolve })
    )

    const initial = map()
    const { result, rerender } = renderHook(
      ({ byDay }) => useTripDnd(byDay, 't1'),
      { initialProps: { byDay: initial } }
    )

    act(() => { result.current.handleDragStart({ active: { id: 'b' } } as never) })
    act(() => {
      void result.current.handleDragEnd({ active: { id: 'b' }, over: { id: 'a' } } as never)
    })
    expect(result.current.byDay.d1.map((e) => e.id)).toEqual(['b', 'a'])

    // Another day's event changed: a fresh reference whose d1 is still
    // pre-drag, because this write has not landed yet.
    rerender({ byDay: { ...initial, d2: [ev('c'), ev('x')] } })
    expect(result.current.byDay.d1.map((e) => e.id)).toEqual(['b', 'a'])

    await act(async () => { settle({ ok: true }) })
  })

  it('lets go of the optimistic copy once the server reports the same order', async () => {
    const { result, rerender } = renderHook(
      ({ byDay }) => useTripDnd(byDay, 't1'),
      { initialProps: { byDay: map() } }
    )

    await drag(result, 'b', 'a')

    const server: EventsByDay = { d1: [ev('b'), ev('a')], d2: [ev('c')], wishlist: [] }
    rerender({ byDay: server })
    expect(result.current.byDay).toBe(server)
  })

  it('reverts and says so when the write fails', async () => {
    vi.mocked(reorderEvents).mockResolvedValue({ ok: false, error: 'REORDER_REJECTED' })

    const initial = map()
    const { result } = render(initial)
    await drag(result, 'b', 'a')

    expect(result.current.byDay).toBe(initial)
    expect(toast).toHaveBeenCalledWith('排序沒有存成功,已還原')
  })

  it('reverts when the cross-day move itself fails, without sorting the target', async () => {
    vi.mocked(moveEvent).mockResolvedValue({ ok: false, error: 'denied' })

    const initial = map()
    const { result } = render(initial)
    await drag(result, 'a', 'c')

    expect(result.current.byDay).toBe(initial)
    expect(reorderEvents).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('排序沒有存成功,已還原')
  })
})

describe('cross-day preview', () => {
  it('shows the card in the day it is hovering over, before the drop', () => {
    const { result } = render()

    act(() => { result.current.handleDragStart({ active: { id: 'a' } } as never) })
    act(() => {
      result.current.handleDragOver({ active: { id: 'a' }, over: { id: 'c' } } as never)
    })

    expect(result.current.byDay.d1.map((e) => e.id)).toEqual(['b'])
    expect(result.current.byDay.d2.map((e) => e.id)).toEqual(['a', 'c'])
    expect(moveEvent).not.toHaveBeenCalled()
  })

  it('survives a push from another member mid-drag', () => {
    const { result, rerender } = renderHook(
      ({ byDay }) => useTripDnd(byDay, 't1'),
      { initialProps: { byDay: map() } }
    )

    act(() => { result.current.handleDragStart({ active: { id: 'a' } } as never) })
    act(() => {
      result.current.handleDragOver({ active: { id: 'a' }, over: { id: 'c' } } as never)
    })

    // Someone else edits their own card while the finger is still down.
    rerender({ byDay: { d1: [ev('a'), ev('b')], d2: [ev('c'), ev('theirs')], wishlist: [] } })

    // The card must stay where it is being dragged to, not snap home.
    expect(result.current.byDay.d1.map((e) => e.id)).toEqual(['b'])
    expect(result.current.byDay.d2.map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('leaves same-day hovering to dnd-kit', () => {
    const initial = map()
    const { result } = render(initial)

    act(() => { result.current.handleDragStart({ active: { id: 'a' } } as never) })
    act(() => {
      result.current.handleDragOver({ active: { id: 'a' }, over: { id: 'b' } } as never)
    })

    expect(result.current.byDay).toBe(initial)
  })
})
