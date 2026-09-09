/** Long-edge ceiling: a phone screen at 3x DPR never needs more than this. */
const MAX_EDGE = 1600
const QUALITY = 0.82
/** Below this a file is already cheap to upload; leave it alone. */
const SKIP_BELOW = 400 * 1024
/** Types an <img> + canvas round-trip can re-encode. GIF/SVG are excluded. */
const RECODABLE = ['image/jpeg', 'image/png', 'image/webp']

/** Scale factor that fits `w`x`h` inside `maxEdge`, never upscaling. */
export function fitScale(w: number, h: number, maxEdge = MAX_EDGE): number {
  const longEdge = Math.max(w, h)
  if (longEdge <= 0) return 1
  return Math.min(1, maxEdge / longEdge)
}

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode failed'))
    }
    img.src = url
  })
}

/**
 * Downscales a picked photo to at most 1600px on its long edge and re-encodes it
 * as JPEG. A phone photo is ~3000px / 3MB yet never renders wider than a phone
 * screen, so the original is pure upload, bandwidth and offline-cache cost.
 *
 * Falls back to the original file when it is already small, is a type canvas
 * cannot re-encode, fails to decode, or would come out larger.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size <= SKIP_BELOW || !RECODABLE.includes(file.type)) return file

  try {
    const img = await decode(file)
    const scale = fitScale(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx || !canvas.width || !canvas.height) return file
    // JPEG has no alpha: flatten onto white so a transparent PNG does not go black.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
