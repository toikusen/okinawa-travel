import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockUseTrip = vi.fn()
vi.mock('../../hooks/useTrip', () => ({ useTrip: (id: string | null) => mockUseTrip(id) }))
vi.mock('../../hooks/useSyncStatus', () => ({ useSyncStatus: () => 'connected' }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: {} } }),
}))
vi.mock('../../components/DaySection', () => ({ DaySection: () => <div data-testid="day-section" /> }))
vi.mock('../../components/SyncIndicator', () => ({ SyncIndicator: () => null }))
vi.mock('../../components/InstallPrompt', () => ({ InstallPrompt: () => null }))

import { TimelinePage } from '../../pages/TimelinePage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trips/:tripId" element={<TimelinePage />} />
        <Route path="/" element={<div data-testid="trip-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TimelinePage', () => {
  it('feeds the route param tripId into useTrip and renders the trip', () => {
    mockUseTrip.mockReturnValue({
      trip: { id: 't1', name: '沖繩 2026', owner_email: 'sei@test.com', members: [], start_date: '2026-08-01', end_date: '2026-08-02' },
      days: [{ id: 'd1', date: '2026-08-01', label: '', sort_order: 0 }],
      loading: false,
    })

    renderAt('/trips/t1')

    expect(mockUseTrip).toHaveBeenCalledWith('t1')
    expect(screen.getByText('沖繩 2026')).toBeInTheDocument()
    expect(screen.getByTestId('day-section')).toBeInTheDocument()
  })

  it('redirects to / when the trip fails to load (not a member)', () => {
    mockUseTrip.mockReturnValue({ trip: null, days: [], loading: false })

    renderAt('/trips/unknown')

    expect(screen.getByTestId('trip-list')).toBeInTheDocument()
  })
})
