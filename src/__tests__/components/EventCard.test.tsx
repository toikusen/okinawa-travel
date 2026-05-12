// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from '../../components/EventCard'
import type { TripEvent } from '../../types'

const sharedEvent: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '美麗海水族館',
  time_start: '12:00',
  time_end: '15:00',
  location: '本部町',
  notes: '',
  sort_order: 0,
}

describe('EventCard', () => {
  it('renders title and time range', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByText('美麗海水族館')).toBeInTheDocument()
    expect(screen.getByText('12:00 – 15:00')).toBeInTheDocument()
  })

  it('renders location when present', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByText('本部町')).toBeInTheDocument()
  })

  it('calls onClick with the event when clicked', () => {
    const onClick = vi.fn()
    render(<EventCard event={sharedEvent} onClick={onClick} />)
    fireEvent.click(screen.getByText('美麗海水族館'))
    expect(onClick).toHaveBeenCalledWith(sharedEvent)
  })
})
