import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockListMyTrips = vi.fn()
vi.mock('../../lib/db', () => ({
  listMyTrips: () => mockListMyTrips(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'sei@test.com', user_metadata: {} } }),
}))

vi.mock('../../components/InstallPrompt', () => ({ InstallPrompt: () => null }))

import { TripListPage } from '../../pages/TripListPage'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <TripListPage />
    </MemoryRouter>
  )
}

describe('TripListPage', () => {
  it('renders trips and navigates to the trip on tap', async () => {
    mockListMyTrips.mockResolvedValue([
      { id: 't1', name: '沖繩 2026', start_date: '2026-08-01', end_date: '2026-08-05', owner_email: 'sei@test.com' },
      { id: 't2', name: '東京跨年', start_date: '2026-12-30', end_date: '2027-01-02', owner_email: 'other@test.com' },
    ])

    renderPage()

    expect(await screen.findByText('沖繩 2026')).toBeInTheDocument()
    expect(screen.getByText('東京跨年')).toBeInTheDocument()

    fireEvent.click(screen.getByText('沖繩 2026'))
    expect(mockNavigate).toHaveBeenCalledWith('/trips/t1')
  })

  it('shows empty state when there are no trips', async () => {
    mockListMyTrips.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('還沒有旅程,建立第一個吧!')).toBeInTheDocument()
  })

  it('navigates to /trips/new from the create button', async () => {
    mockListMyTrips.mockResolvedValue([])

    renderPage()
    fireEvent.click(await screen.findByText('+ 新增旅程'))

    expect(mockNavigate).toHaveBeenCalledWith('/trips/new')
  })
})
