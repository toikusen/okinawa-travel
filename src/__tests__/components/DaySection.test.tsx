import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../lib/db', () => ({
  reorderEvents: vi.fn(async () => ({ ok: true })),
  updateDayLabel: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../components/EventSheet', () => ({ EventSheet: () => null }))
vi.mock('../../components/EventDetailSheet', () => ({ EventDetailSheet: () => null }))
vi.mock('../../hooks/useNow', () => ({ useNow: () => new Date('2026-10-12T10:00:00') }))

import { DaySection } from '../../components/DaySection'

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
})
