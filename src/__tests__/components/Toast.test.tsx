import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '../../components/Toast'
import { toast } from '../../lib/toast'

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders nothing until a message is pushed', () => {
    render(<Toast />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a pushed message', () => {
    render(<Toast />)
    act(() => toast('儲存失敗'))
    expect(screen.getByRole('status')).toHaveTextContent('儲存失敗')
  })

  it('dismisses itself after 3 seconds', () => {
    render(<Toast />)
    act(() => toast('儲存失敗'))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
