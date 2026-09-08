import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncIndicator } from '../../components/SyncIndicator'

describe('SyncIndicator', () => {
  it('renders nothing when connected', () => {
    const { container } = render(<SyncIndicator status="connected" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('warns honestly when offline', () => {
    render(<SyncIndicator status="offline" />)
    expect(screen.getByText('離線,只能檢視')).toBeInTheDocument()
  })

  it('warns when the connection dropped', () => {
    render(<SyncIndicator status="error" />)
    expect(screen.getByText('連線中斷,重新整理')).toBeInTheDocument()
  })
})
