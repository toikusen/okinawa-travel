import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUpdateTrip = vi.fn()
vi.mock('../../lib/db', () => ({
  updateTrip: (...args: unknown[]) => mockUpdateTrip(...args),
}))
const mockToast = vi.fn()
vi.mock('../../lib/toast', () => ({ toast: (m: string) => mockToast(m) }))

import { TripNotesSection } from '../../components/TripNotesSection'

const trip = (notes: string) => ({
  id: 't1', name: '沖繩四日遊', owner_email: 'a@test.com',
  start_date: '2026-10-12', end_date: '2026-10-15', members: [], notes,
})

describe('TripNotesSection', () => {
  beforeEach(() => {
    mockUpdateTrip.mockReset().mockResolvedValue({ ok: true })
    mockToast.mockReset()
  })

  it('opens straight into the editor when nothing is written yet', () => {
    render(<TripNotesSection trip={trip('')} />)
    // the placeholder is a worked example, not a list of field names
    expect(screen.getByLabelText('重要資訊')).toHaveAttribute(
      'placeholder', expect.stringContaining('訂房代號 X7K92')
    )
  })

  it('saves the draft when the textarea loses focus', async () => {
    render(<TripNotesSection trip={trip('')} />)
    await userEvent.type(screen.getByLabelText('重要資訊'), 'BR116 07:35')
    await userEvent.tab()
    expect(mockUpdateTrip).toHaveBeenCalledWith('t1', { notes: 'BR116 07:35' })
  })

  it('reads as text until 編輯 is tapped', async () => {
    render(<TripNotesSection trip={trip('BR116 07:35')} />)
    expect(screen.queryByLabelText('重要資訊')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '編輯' }))
    expect(screen.getByLabelText('重要資訊')).toHaveValue('BR116 07:35')
  })

  it('surfaces a write failure instead of pretending it saved', async () => {
    mockUpdateTrip.mockResolvedValue({ ok: false, error: 'nope' })
    render(<TripNotesSection trip={trip('')} />)
    await userEvent.type(screen.getByLabelText('重要資訊'), 'x')
    await userEvent.tab()
    expect(mockToast).toHaveBeenCalledWith('重要資訊儲存失敗,請再試一次')
    expect(screen.queryByText('已儲存')).not.toBeInTheDocument()
  })
})
