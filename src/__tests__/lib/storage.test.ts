// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockStorage } = vi.hoisted(() => {
  const mockUpload = vi.fn()
  const mockGetPublicUrl = vi.fn()
  const mockFrom = vi.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }))
  return { mockStorage: { from: mockFrom, _upload: mockUpload, _getPublicUrl: mockGetPublicUrl } }
})

vi.mock('../../supabase', () => ({
  supabase: { storage: mockStorage },
}))

import { uploadEventImage } from '../../lib/storage'

beforeEach(() => vi.clearAllMocks())

describe('uploadEventImage', () => {
  it('uploads to correct path and returns public URL', async () => {
    mockStorage._upload.mockResolvedValue({ error: null })
    mockStorage._getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/trip1/event1.jpg' } })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const url = await uploadEventImage('trip1', 'event1', file)

    expect(mockStorage.from).toHaveBeenCalledWith('event-images')
    expect(mockStorage._upload).toHaveBeenCalledWith(
      'trip1/event1.jpg',
      file,
      expect.objectContaining({ upsert: true, contentType: 'image/jpeg' })
    )
    expect(url).toBe('https://cdn.example.com/trip1/event1.jpg')
  })

  it('throws when upload fails', async () => {
    mockStorage._upload.mockResolvedValue({ error: { message: 'upload error' } })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(uploadEventImage('trip1', 'event1', file)).rejects.toThrow('upload error')
  })

  it('throws when getPublicUrl returns no URL', async () => {
    mockStorage._upload.mockResolvedValue({ error: null })
    mockStorage._getPublicUrl.mockReturnValue({ data: { publicUrl: '' } })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(uploadEventImage('trip1', 'event1', file)).rejects.toThrow('Failed to get public URL')
  })
})
