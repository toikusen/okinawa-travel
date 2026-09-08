import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUseTrip = vi.fn()
const mockDeleteTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: () => mockUseTrip() }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'owner@test.com', user_metadata: {} } }),
}))
vi.mock('../../lib/db', () => ({
  updateTrip: vi.fn(async () => ({ ok: true })),
  updateTripDates: vi.fn(async () => ({ ok: true })),
  deleteTrip: (...args: unknown[]) => mockDeleteTrip(...args),
  removeMember: vi.fn(async () => true),
}))
vi.mock('../../components/MembersSection', () => ({ MembersSection: () => null }))

import { SettingsPage } from '../../pages/SettingsPage'

const trip = {
  id: 't1', name: '沖繩四日遊', owner_email: 'owner@test.com',
  members: [], start_date: '2026-10-12', end_date: '2026-10-15',
}

function renderPage() {
  mockUseTrip.mockReturnValue({ trip, days: [], loading: false })
  return render(
    <MemoryRouter initialEntries={['/trips/t1/settings']}>
      <Routes>
        <Route path="/trips/:tripId/settings" element={<SettingsPage />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SettingsPage delete flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the trip name in a ConfirmSheet instead of window.prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '刪除旅程' }))

    expect(promptSpy).not.toHaveBeenCalled()
    expect(screen.getByLabelText('請輸入旅程名稱以確認')).toBeInTheDocument()
  })

  it('only deletes once the typed name matches', async () => {
    mockDeleteTrip.mockResolvedValue(true)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '刪除旅程' }))
    const input = screen.getByLabelText('請輸入旅程名稱以確認')
    const confirm = screen.getAllByRole('button', { name: '刪除旅程' })
      .find(b => b.closest('[role="dialog"]'))!

    await userEvent.type(input, '沖繩')
    expect(confirm).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, '沖繩四日遊')
    await userEvent.click(confirm)

    expect(mockDeleteTrip).toHaveBeenCalledWith('t1')
  })
})
