import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmSheet } from '../../components/ConfirmSheet'

describe('ConfirmSheet', () => {
  it('calls onConfirm when the confirm button is pressed', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmSheet title="確定刪除?" confirmLabel="刪除" onConfirm={onConfirm} onCancel={vi.fn()} />
    )
    await userEvent.click(screen.getByRole('button', { name: '刪除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the cancel button is pressed', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmSheet title="確定刪除?" confirmLabel="刪除" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('keeps confirm disabled until the required text matches', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmSheet
        title="刪除旅程"
        confirmLabel="刪除"
        requireTypedText="沖繩四日遊"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    const confirm = screen.getByRole('button', { name: '刪除' })
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText('請輸入旅程名稱以確認'), '沖繩')
    expect(confirm).toBeDisabled()

    await userEvent.type(screen.getByLabelText('請輸入旅程名稱以確認'), '四日遊')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
