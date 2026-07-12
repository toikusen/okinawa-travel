// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from '../../components/BottomSheet'

function renderSheet(onClose = vi.fn()) {
  render(
    <BottomSheet label="測試面板" onClose={onClose} backdropTestId="bd" panelClassName="">
      <button>內容按鈕</button>
    </BottomSheet>
  )
  return onClose
}

describe('BottomSheet', () => {
  it('exposes dialog semantics', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog', { name: '測試面板' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on Escape', () => {
    const onClose = renderSheet()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has an accessible close control on the backdrop', () => {
    const onClose = renderSheet()
    fireEvent.click(screen.getByLabelText('關閉'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the panel on open', () => {
    renderSheet()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })
})
