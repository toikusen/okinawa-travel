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

const eventWithImage: TripEvent = {
  ...sharedEvent,
  image_url: 'https://cdn.example.com/img.jpg',
  link_url: 'https://example.com',
}

describe('EventCard with image', () => {
  it('shows thumbnail img when image_url is present', () => {
    render(<EventCard event={eventWithImage} onClick={() => {}} onImageClick={() => {}} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/img.jpg')
  })

  it('calls onImageClick when thumbnail is tapped', () => {
    const onImageClick = vi.fn()
    render(<EventCard event={eventWithImage} onClick={() => {}} onImageClick={onImageClick} />)
    fireEvent.click(screen.getByRole('img'))
    expect(onImageClick).toHaveBeenCalledWith(eventWithImage)
  })

  it('shows edit button when no image_url', () => {
    render(<EventCard event={sharedEvent} onClick={() => {}} />)
    expect(screen.getByLabelText('編輯行程')).toBeInTheDocument()
  })

  it('hides edit button when image_url is present', () => {
    render(<EventCard event={eventWithImage} onClick={() => {}} onImageClick={() => {}} />)
    expect(screen.queryByLabelText('編輯行程')).toBeNull()
  })
})
