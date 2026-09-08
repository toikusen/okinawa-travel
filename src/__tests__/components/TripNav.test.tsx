import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripNav } from '../../components/TripNav'

describe('TripNav', () => {
  it('offers exactly two tabs', () => {
    render(<TripNav onToday={vi.fn()} onTop={vi.fn()} active="today" />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '今天' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '行程' })).toBeInTheDocument()
  })

  it('no longer exposes a settings tab', () => {
    render(<TripNav onToday={vi.fn()} onTop={vi.fn()} active="today" />)
    expect(screen.queryByRole('button', { name: '設定' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '旅伴' })).not.toBeInTheDocument()
  })

  it('calls the scroll handlers', async () => {
    const onToday = vi.fn()
    const onTop = vi.fn()
    render(<TripNav onToday={onToday} onTop={onTop} active="itinerary" />)
    await userEvent.click(screen.getByRole('button', { name: '今天' }))
    await userEvent.click(screen.getByRole('button', { name: '行程' }))
    expect(onToday).toHaveBeenCalledOnce()
    expect(onTop).toHaveBeenCalledOnce()
  })

  it('disables 今天 when the trip is not under way', () => {
    render(<TripNav onToday={vi.fn()} onTop={vi.fn()} active="itinerary" todayDisabled />)
    expect(screen.getByRole('button', { name: '今天' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '行程' })).toBeEnabled()
  })
})
