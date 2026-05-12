// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { ForkCard } from '../../components/ForkCard'
import type { TripEvent } from '../../types'

const forkEvent: TripEvent = {
  id: 'e2',
  type: 'fork',
  title: '',
  time_start: '15:30',
  time_end: '17:30',
  location: '',
  notes: '',
  sort_order: 1,
  fork_items: [
    { person: 'Sei', title: '參加活動', location: '', notes: '' },
    { person: '同事', title: '浦添 PARCO', location: '', notes: '' },
  ],
}

describe('ForkCard', () => {
  it('renders both person names', () => {
    render(<ForkCard event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText('Sei')).toBeInTheDocument()
    expect(screen.getByText('同事')).toBeInTheDocument()
  })

  it('renders both activity titles', () => {
    render(<ForkCard event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText('參加活動')).toBeInTheDocument()
    expect(screen.getByText('浦添 PARCO')).toBeInTheDocument()
  })

  it('shows time range in header', () => {
    render(<ForkCard event={forkEvent} onClick={() => {}} />)
    expect(screen.getByText(/15:30–17:30/)).toBeInTheDocument()
  })

  it('calls onClick with the event when clicked', () => {
    const onClick = vi.fn()
    render(<ForkCard event={forkEvent} onClick={onClick} />)
    fireEvent.click(screen.getByText('Sei'))
    expect(onClick).toHaveBeenCalledWith(forkEvent)
  })
})
