// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventSheet } from '../../components/EventSheet'
import type { TripEvent } from '../../types'

vi.mock('../../lib/db', () => ({
  createEvent: vi.fn().mockResolvedValue('new-id'),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}))

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

describe('EventSheet', () => {
  it('renders nothing when open=false', () => {
    render(
      <EventSheet open={false} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={() => {}} />
    )
    expect(screen.queryByText('共同')).toBeNull()
  })

  it('shows create title and empty form when open=true with no event', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={() => {}} />
    )
    expect(screen.getByText('新增行程')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('行程名稱')).toBeInTheDocument()
  })

  it('shows edit title and pre-fills fields from existing event', () => {
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" eventCount={1} onClose={() => {}} />
    )
    expect(screen.getByText('編輯行程')).toBeInTheDocument()
    expect(screen.getByDisplayValue('美麗海水族館')).toBeInTheDocument()
  })

  it('switches to fork mode when 分岔 toggle clicked', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分岔'))
    expect(screen.getByPlaceholderText('人名 A')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('人名 B')).toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" eventCount={0} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
