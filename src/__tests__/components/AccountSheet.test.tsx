import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockSignOut = vi.fn()
let mockUser: { email: string; user_metadata: Record<string, string> } | null = null
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, signOut: mockSignOut }),
}))

const mockUpdateMyDisplayName = vi.fn()
vi.mock('../../lib/db', () => ({
  updateMyDisplayName: (...args: unknown[]) => mockUpdateMyDisplayName(...args),
}))

const mockToast = vi.fn()
vi.mock('../../lib/toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }))

import { AccountSheet } from '../../components/AccountSheet'

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = {
    email: 'sei@test.com',
    user_metadata: { full_name: '小安', avatar_url: '' },
  }
})

describe('AccountSheet', () => {
  it('fills in the current name once the async user loads', () => {
    // useAuth starts with user=null and resolves later — the input must sync
    mockUser = null
    const { rerender } = render(<AccountSheet onClose={vi.fn()} />)
    expect(screen.getByLabelText('顯示名稱')).toHaveValue('')

    mockUser = { email: 'sei@test.com', user_metadata: { full_name: '小安', avatar_url: '' } }
    rerender(<AccountSheet onClose={vi.fn()} />)
    expect(screen.getByLabelText('顯示名稱')).toHaveValue('小安')
  })

  it('saves the trimmed name via the save button and shows the saved badge', async () => {
    mockUpdateMyDisplayName.mockResolvedValue(true)
    render(<AccountSheet onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('顯示名稱'), { target: { value: '  阿安  ' } })
    fireEvent.click(screen.getByText('儲存'))

    expect(await screen.findByText('已儲存')).toBeInTheDocument()
    expect(mockUpdateMyDisplayName).toHaveBeenCalledWith('sei@test.com', '阿安')
  })

  it('saves on Enter', async () => {
    mockUpdateMyDisplayName.mockResolvedValue(true)
    render(<AccountSheet onClose={vi.fn()} />)

    const input = screen.getByLabelText('顯示名稱')
    fireEvent.change(input, { target: { value: '阿安' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText('已儲存')).toBeInTheDocument()
  })

  it('disables the save button when the name is unchanged or empty', () => {
    render(<AccountSheet onClose={vi.fn()} />)

    const button = screen.getByText('儲存')
    expect(button).toBeDisabled() // unchanged
    fireEvent.change(screen.getByLabelText('顯示名稱'), { target: { value: '   ' } })
    expect(button).toBeDisabled() // empty
    fireEvent.change(screen.getByLabelText('顯示名稱'), { target: { value: '阿安' } })
    expect(button).toBeEnabled()
  })

  it('toasts when saving fails', async () => {
    mockUpdateMyDisplayName.mockResolvedValue(false)
    render(<AccountSheet onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('顯示名稱'), { target: { value: '阿安' } })
    fireEvent.click(screen.getByText('儲存'))

    await vi.waitFor(() => expect(mockToast).toHaveBeenCalledWith('名稱儲存失敗,請再試一次'))
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
