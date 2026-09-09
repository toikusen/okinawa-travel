import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook, act, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../lib/db', () => ({
  reorderEvents: vi.fn(async () => ({ ok: true })),
  updateDayLabel: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../lib/toast', () => ({ toast: vi.fn() }))
vi.mock('../../components/EventSheet', () => ({ EventSheet: () => null }))
vi.mock('../../components/EventDetailSheet', () => ({ EventDetailSheet: () => null }))
vi.mock('../../hooks/useNow', () => ({ useNow: () => new Date('2026-10-12T10:00:00') }))

import { DaySection, applyReorder, useReorderState } from '../../components/DaySection'
import { reorderEvents, updateDayLabel } from '../../lib/db'
import { toast } from '../../lib/toast'

const day = { id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }
const ev = (id: string, time_start: string) => ({
  id, type: 'shared' as const, title: id, time_start, time_end: '',
  location: '', notes: '', sort_order: 0,
})

describe('DaySection now line', () => {
  it('places the now line after the last started event despite list order', () => {
    render(
      <DaySection day={day} tripId="t1" members={[]} events={[ev('b', '14:00'), ev('a', '09:00'), ev('c', '18:00')]} />
    )
    // Accessible name includes the time prefix (e.g. "14:00 b"), so match on the trailing letter.
    const cards = screen.getAllByRole('button', { name: /(?:^|\s)[abc]$/ })
    const line = screen.getByTestId('now-line')
    // The line sits between 'a' (started) and 'c' (not yet).
    expect(line.compareDocumentPosition(cards[1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(line.compareDocumentPosition(cards[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders no now line on a day that is not today', () => {
    render(
      <DaySection day={{ ...day, date: '2026-10-13' }} tripId="t1" members={[]} events={[ev('a', '09:00')]} />
    )
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument()
  })

  it('shows a visible drag handle', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[ev('a', '09:00')]} />)
    expect(screen.getByRole('button', { name: '拖曳排序' })).toBeVisible()
  })
})

describe('DaySection label editing', () => {
  it('reverts the label and toasts when updateDayLabel fails', async () => {
    vi.mocked(updateDayLabel).mockResolvedValueOnce({ ok: false })
    render(
      <DaySection day={{ ...day, label: '原本標籤' }} tripId="t1" members={[]} events={[]} />
    )

    fireEvent.click(screen.getByText('原本標籤'))
    const input = screen.getByLabelText('日期標籤')
    fireEvent.change(input, { target: { value: '新標籤' } })
    fireEvent.blur(input)

    await waitFor(() => expect(toast).toHaveBeenCalledWith('標籤儲存失敗,請再試一次'))
    expect(screen.getByText('原本標籤')).toBeInTheDocument()
  })
})

describe('applyReorder', () => {
  it('applyReorder moves an item and reports the new order', () => {
    const list = [ev('a', '09:00'), ev('b', '10:00'), ev('c', '11:00')]
    expect(applyReorder(list, 'c', 'a').map(e => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('applyReorder returns the original list when either id is unknown', () => {
    const list = [ev('a', '09:00')]
    expect(applyReorder(list, 'a', 'zzz')).toBe(list)
  })
})

// dnd-kit drags are unreliable to simulate in jsdom (see applyReorder above),
// so the optimistic-reorder state is exercised directly via the hook that
// DaySection uses internally.
describe('useReorderState', () => {
  it('keeps the optimistic order when an unrelated prop update arrives while the write is in flight', async () => {
    let resolveWrite: (result: { ok: boolean }) => void = () => {}
    vi.mocked(reorderEvents).mockImplementation(
      () => new Promise((resolve) => { resolveWrite = resolve })
    )

    const initial = [ev('a', '09:00'), ev('b', '10:00'), ev('c', '11:00')]
    const { result, rerender } = renderHook(
      ({ events }) => useReorderState(events, 'd1'),
      { initialProps: { events: initial } }
    )

    // Fire the drag-end handler but don't await its completion here — it
    // awaits the (still-pending) reorderEvents() promise. The synchronous
    // portion (setPendingOrder + starting the write) runs and flushes
    // within this act() call.
    act(() => {
      void result.current.handleDragEnd({
        active: { id: 'c' }, over: { id: 'a' },
      } as unknown as Parameters<typeof result.current.handleDragEnd>[0])
    })
    expect(result.current.events.map((e) => e.id)).toEqual(['c', 'a', 'b'])

    // Another day's event changed: a brand-new array reference with the
    // same, still-unswapped content for this day (this day's write hasn't
    // resolved yet, so the server still reports the pre-drag order).
    rerender({ events: [...initial] })

    // The optimistic order must survive — this is the bug: without the
    // in-flight guard the effect clears pendingOrder here and the list
    // snaps back to ['a', 'b', 'c'].
    expect(result.current.events.map((e) => e.id)).toEqual(['c', 'a', 'b'])

    await act(async () => { resolveWrite({ ok: true }) })
  })

  it('settles the optimistic order once its own write succeeds and the server catches up', async () => {
    let resolveWrite: (result: { ok: boolean }) => void = () => {}
    vi.mocked(reorderEvents).mockImplementation(
      () => new Promise((resolve) => { resolveWrite = resolve })
    )

    const initial = [ev('a', '09:00'), ev('b', '10:00'), ev('c', '11:00')]
    const { result, rerender } = renderHook(
      ({ events }) => useReorderState(events, 'd1'),
      { initialProps: { events: initial } }
    )

    let dragEndPromise!: Promise<void>
    act(() => {
      dragEndPromise = result.current.handleDragEnd({
        active: { id: 'c' }, over: { id: 'a' },
      } as unknown as Parameters<typeof result.current.handleDragEnd>[0])
    })

    // The write's own realtime push lands before the RPC promise resolves,
    // already carrying the new order.
    const reordered = [ev('c', '11:00'), ev('a', '09:00'), ev('b', '10:00')]
    rerender({ events: reordered })
    expect(result.current.events.map((e) => e.id)).toEqual(['c', 'a', 'b'])

    await act(async () => {
      resolveWrite({ ok: true })
      await dragEndPromise
    })

    // pendingOrder is cleared once the write settles and matches the server.
    expect(result.current.events).toBe(reordered)
  })
})

describe('DaySection route link', () => {
  const at = (id: string, location: string) => ({ ...ev(id, ''), location })

  it('chains the day places into one Google Maps route, in list order', () => {
    render(
      <DaySection
        day={day}
        tripId="t1"
        members={[]}
        events={[at('a', '那霸機場'), at('b', '美麗海水族館'), at('c', '國際通')]}
      />
    )
    const link = screen.getByRole('link', { name: /當日路線/ })
    const href = decodeURIComponent(link.getAttribute('href')!)
    expect(href).toContain('origin=那霸機場')
    expect(href).toContain('waypoints=美麗海水族館')
    expect(href).toContain('destination=國際通')
  })

  it('stays out of the way when there is nothing to route', () => {
    render(<DaySection day={day} tripId="t1" members={[]} events={[at('a', '那霸機場')]} />)
    expect(screen.queryByRole('link', { name: /當日路線/ })).toBeNull()
  })
})
