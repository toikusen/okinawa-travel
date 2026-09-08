// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { EventSheet } from '../../components/EventSheet'
import { deleteEvent } from '../../lib/db'
import type { TripEvent } from '../../types'

vi.mock('../../lib/db', () => ({
  createEvent: vi.fn().mockResolvedValue('new-id'),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  reorderEvents: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/storage', () => ({
  uploadEventImage: vi.fn().mockResolvedValue('https://cdn.example.com/new.jpg'),
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
      <EventSheet open={false} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.queryByText('共同行程')).toBeNull()
  })

  it('shows create title and empty form when open=true with no event', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('新增行程')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('行程名稱')).toBeInTheDocument()
  })

  it('shows edit title and pre-fills fields from existing event', () => {
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByText('編輯行程')).toBeInTheDocument()
    expect(screen.getByDisplayValue('美麗海水族館')).toBeInTheDocument()
  })

  it('disables save and shows a hint when the title is empty', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('儲存')).toBeDisabled()
    expect(screen.getByText('請輸入行程名稱')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('行程名稱'), { target: { value: '首里城' } })
    expect(screen.getByText('儲存')).toBeEnabled()
    expect(screen.queryByText('請輸入行程名稱')).toBeNull()
  })

  it('fills times from a quick preset pill', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('早上'))
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument()
  })

  it('switches to fork mode and shows text inputs when no members provided', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))
    expect(screen.getByPlaceholderText('第 1 組')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('第 2 組')).toBeInTheDocument()
  })

  it('switches to fork mode and shows member selects when members provided', () => {
    const members = [
      { email: 'a@test.com', display_name: 'Alice', avatar_url: '' },
      { email: 'b@test.com', display_name: 'Bob', avatar_url: '' },
    ]
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} members={members} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
    expect(screen.getAllByText('Alice')).toHaveLength(2)
    expect(screen.getAllByText('Bob')).toHaveLength(2)
  })

  it('adds a third fork group with ＋ 新增一組', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))
    fireEvent.click(screen.getByText('＋ 新增一組'))
    expect(screen.getByPlaceholderText('第 3 組')).toBeInTheDocument()

    // removable back down to two
    fireEvent.click(screen.getByLabelText('移除第 3 組'))
    expect(screen.queryByPlaceholderText('第 3 組')).toBeNull()
  })

  it('confirms deletion through ConfirmSheet, not window.confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(
      <EventSheet open={true} event={sharedEvent} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('刪除'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(deleteEvent).not.toHaveBeenCalled()
    expect(screen.getByText('確定刪除這個行程?')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows image picker area', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByText('新增圖片')).toBeInTheDocument()
  })

  it('shows link URL input', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument()
  })

  it('pre-fills link_url from existing event', () => {
    const eventWithLink = {
      ...sharedEvent,
      link_url: 'https://oki-park.jp',
    }
    render(
      <EventSheet open={true} event={eventWithLink} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByDisplayValue('https://oki-park.jp')).toBeInTheDocument()
  })

  it('shows existing image preview thumbnail', () => {
    const eventWithImage = {
      ...sharedEvent,
      image_url: 'https://cdn.example.com/existing.jpg',
    }
    render(
      <EventSheet open={true} event={eventWithImage} dayId="d1" tripId="t1" events={[sharedEvent]} onClose={() => {}} />
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/existing.jpg')
  })

  it('blocks saving a fork event with an empty group', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))

    expect(screen.getByText('儲存')).toBeDisabled()
    expect(screen.getByText('每一組都要填人名和活動')).toBeInTheDocument()
  })

  it('allows saving once every group has a person and an activity', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))

    fireEvent.change(screen.getByLabelText('第 1 組'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('第 1 組活動'), { target: { value: '潛水' } })
    fireEvent.change(screen.getByLabelText('第 2 組'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('第 2 組活動'), { target: { value: '購物' } })

    expect(screen.getByText('儲存')).toBeEnabled()
  })

  it('treats whitespace-only fields as empty', () => {
    render(
      <EventSheet open={true} event={null} dayId="d1" tripId="t1" events={[]} onClose={() => {}} />
    )
    fireEvent.click(screen.getByText('分頭行動'))

    // Group 1's person is whitespace-only; everything else is filled with real text.
    fireEvent.change(screen.getByLabelText('第 1 組'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('第 1 組活動'), { target: { value: '潛水' } })
    fireEvent.change(screen.getByLabelText('第 2 組'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('第 2 組活動'), { target: { value: '購物' } })

    expect(screen.getByText('儲存')).toBeDisabled()
    expect(screen.getByText('每一組都要填人名和活動')).toBeInTheDocument()
  })
})
