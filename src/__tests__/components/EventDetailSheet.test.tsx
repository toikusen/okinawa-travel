// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventDetailSheet } from '../../components/EventDetailSheet'
import type { TripEvent } from '../../types'

const event: TripEvent = {
  id: 'e1',
  type: 'shared',
  title: '首里城',
  time_start: '09:00',
  time_end: '11:00',
  location: '那霸市',
  notes: '',
  sort_order: 0,
  image_url: 'https://cdn.example.com/shurijo.jpg',
  link_url: 'https://oki-park.jp/shurijo/',
}

describe('EventDetailSheet', () => {
  it('renders nothing when open=false', () => {
    render(<EventDetailSheet open={false} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows image with correct src', () => {
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/shurijo.jpg')
  })

  it('shows event title and location', () => {
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('首里城')).toBeInTheDocument()
    expect(screen.getByText('那霸市')).toBeInTheDocument()
  })

  it('shows link button when link_url present', () => {
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('前往官網')).toBeInTheDocument()
  })

  it('hides link button when no link_url', () => {
    const noLink = { ...event, link_url: null }
    render(<EventDetailSheet open={true} event={noLink} onClose={() => {}} onEdit={() => {}} />)
    expect(screen.queryByText('前往官網')).toBeNull()
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    render(<EventDetailSheet open={true} event={event} onClose={() => {}} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('編輯行程'))
    expect(onEdit).toHaveBeenCalledWith(event)
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<EventDetailSheet open={true} event={event} onClose={onClose} onEdit={() => {}} />)
    fireEvent.click(screen.getByTestId('detail-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
