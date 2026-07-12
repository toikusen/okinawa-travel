import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockSignOut = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      email: 'sei@test.com',
      user_metadata: { full_name: '小安', avatar_url: '' },
    },
    signOut: mockSignOut,
  }),
}))

const mockUpdateMyDisplayName = vi.fn()
vi.mock('../../lib/db', () => ({
  updateMyDisplayName: (...args: unknown[]) => mockUpdateMyDisplayName(...args),
}))

import { AccountSheet } from '../../components/AccountSheet'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AccountSheet', () => {
  it('saves the trimmed name on blur and shows the saved badge', async () => {
    mockUpdateMyDisplayName.mockResolvedValue(true)
    render(<AccountSheet onClose={vi.fn()} />)

    const input = screen.getByLabelText('顯示名稱')
    fireEvent.change(input, { target: { value: '  阿安  ' } })
    fireEvent.blur(input)

    expect(await screen.findByText('已儲存')).toBeInTheDocument()
    expect(mockUpdateMyDisplayName).toHaveBeenCalledWith('sei@test.com', '阿安')
  })

  it('does not save when the name is unchanged or empty', () => {
    render(<AccountSheet onClose={vi.fn()} />)

    const input = screen.getByLabelText('顯示名稱')
    fireEvent.blur(input) // unchanged
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input) // empty

    expect(mockUpdateMyDisplayName).not.toHaveBeenCalled()
  })

  it('alerts when saving fails', async () => {
    mockUpdateMyDisplayName.mockResolvedValue(false)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<AccountSheet onClose={vi.fn()} />)

    const input = screen.getByLabelText('顯示名稱')
    fireEvent.change(input, { target: { value: '阿安' } })
    fireEvent.blur(input)

    await vi.waitFor(() => expect(alertSpy).toHaveBeenCalled())
    alertSpy.mockRestore()
  })

  it('signs out from the sign-out button', () => {
    render(<AccountSheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('登出'))
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('closes via the backdrop', () => {
    const onClose = vi.fn()
    render(<AccountSheet onClose={onClose} />)
    fireEvent.click(screen.getByTestId('account-sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
