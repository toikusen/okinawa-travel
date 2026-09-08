import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../hooks/useNow', () => ({ useNow: () => new Date('2026-10-12T10:00:00') }))

import { NowSection } from '../../components/NowSection'

const days = [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }]
const ev = (id: string, title: string, s: string, e: string, location = '') => ({
  id, type: 'shared' as const, title, time_start: s, time_end: e,
  location, notes: '', sort_order: 0,
})

describe('NowSection', () => {
  it('shows the event happening now with its navigation link', () => {
    render(
      <NowSection
        days={days}
        eventsByDay={{ d1: [ev('a', '美麗海水族館', '09:00', '12:00', '本部町')] }}
        onOpen={vi.fn()}
      />
    )
    expect(screen.getByText('現在進行中')).toBeInTheDocument()
    expect(screen.getByText('美麗海水族館')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '導航到 本部町' })).toBeInTheDocument()
  })

  it('renders nothing when the trip has no events today', () => {
    const { container } = render(<NowSection days={days} eventsByDay={{}} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('labels the fallback as 明天 when today is done', () => {
    render(
      <NowSection
        days={[...days, { id: 'd2', date: '2026-10-13', label: '', sort_order: 1 }]}
        eventsByDay={{ d1: [ev('a', '早餐', '07:00', '08:00')], d2: [ev('t', '古宇利大橋', '09:00', '11:00')] }}
        onOpen={vi.fn()}
      />
    )
    expect(screen.getByText('明天')).toBeInTheDocument()
    expect(screen.getByText('古宇利大橋')).toBeInTheDocument()
  })
})
