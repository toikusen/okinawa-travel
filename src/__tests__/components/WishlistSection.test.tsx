import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../components/EventSheet', () => ({
  EventSheet: ({ open, event, dayId }: { open: boolean; event: { id: string } | null; dayId: string | null }) =>
    open ? <div data-testid="sheet">{`${dayId ?? 'wishlist'}/${event?.id ?? 'new'}`}</div> : null,
}))

import { WishlistSection } from '../../components/WishlistSection'
import type { TripEvent } from '../../types'

const item = (id: string, title: string): TripEvent => ({
  id, type: 'shared', title, time_start: '', time_end: '',
  location: '', notes: '', sort_order: 0,
})

const days = [{ id: 'd1', date: '2026-10-12', label: '', sort_order: 0 }]

describe('WishlistSection', () => {
  it('explains itself when empty and still offers a way in', () => {
    render(<WishlistSection tripId="t1" days={days} members={[]} events={[]} />)
    expect(screen.getByText('還沒排進哪一天的地方,先丟這裡。')).toBeInTheDocument()
    expect(screen.getByText('＋ 新增想去的地方')).toBeInTheDocument()
    expect(screen.queryByTestId('sheet')).toBeNull()
  })

  it('lists the collected places with a count', () => {
    render(<WishlistSection tripId="t1" days={days} members={[]} events={[item('e1', '古宇利島'), item('e2', '瀨長島')]} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('古宇利島')).toBeInTheDocument()
    expect(screen.getByText('瀨長島')).toBeInTheDocument()
  })

  it('opens a blank wishlist sheet from the add button', () => {
    render(<WishlistSection tripId="t1" days={days} members={[]} events={[]} />)
    fireEvent.click(screen.getByText('＋ 新增想去的地方'))
    expect(screen.getByTestId('sheet')).toHaveTextContent('wishlist/new')
  })

  it('opens the card it was tapped on, so it can be given a date', () => {
    render(<WishlistSection tripId="t1" days={days} members={[]} events={[item('e1', '古宇利島')]} />)
    fireEvent.click(screen.getByText('古宇利島'))
    expect(screen.getByTestId('sheet')).toHaveTextContent('wishlist/e1')
  })
})
