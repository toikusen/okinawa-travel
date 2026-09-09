// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fitScale, compressImage } from '../../lib/image'

const fileOf = (bytes: number, type: string) =>
  new File([new Uint8Array(bytes)], 'photo.jpg', { type })

describe('fitScale', () => {
  it('shrinks a phone photo to the long-edge ceiling', () => {
    expect(fitScale(4000, 3000)).toBeCloseTo(0.4)
    expect(fitScale(3000, 4000)).toBeCloseTo(0.4)
  })

  it('never upscales an image that already fits', () => {
    expect(fitScale(800, 600)).toBe(1)
    expect(fitScale(1600, 1200)).toBe(1)
  })

  it('honours a custom ceiling and degenerate sizes', () => {
    expect(fitScale(2000, 1000, 500)).toBeCloseTo(0.25)
    expect(fitScale(0, 0)).toBe(1)
  })
})

describe('compressImage', () => {
  it('leaves an already-small file untouched', async () => {
    const file = fileOf(100 * 1024, 'image/jpeg')
    expect(await compressImage(file)).toBe(file)
  })

  it('leaves a type canvas cannot re-encode untouched', async () => {
    const gif = fileOf(2 * 1024 * 1024, 'image/gif')
    expect(await compressImage(gif)).toBe(gif)
  })
})
