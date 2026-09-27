import type { SourceImage } from './types'

/** Longest edge of the in-memory working copy. Keeps 100-piece games light. */
export const MAX_EDGE = 1800

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class ImageLoadError extends Error {}

function loadElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageLoadError('This file could not be read as an image.'))
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageLoadError('Could not encode image.'))), type, quality)
  })
}

/**
 * Downscale an image source onto a canvas. Large reductions are done in
 * halving steps, which keeps quality high and memory spikes small.
 */
function downscale(source: CanvasImageSource, sw: number, sh: number, tw: number, th: number): HTMLCanvasElement {
  let cur: CanvasImageSource = source
  let cw = sw
  let ch = sh
  while (cw / 2 > tw && ch / 2 > th) {
    const step = document.createElement('canvas')
    step.width = Math.round(cw / 2)
    step.height = Math.round(ch / 2)
    const sctx = step.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(cur, 0, 0, step.width, step.height)
    cur = step
    cw = step.width
    ch = step.height
  }
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, tw, th)
  return out
}

/**
 * Read a user-selected file entirely in the browser: decode, respect EXIF
 * orientation (browsers apply it for <img>), and resize to at most MAX_EDGE.
 * Nothing leaves the device.
 */
export async function loadImageFile(file: File): Promise<SourceImage> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new ImageLoadError('Please choose an image file (JPG, PNG or WEBP).')
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadElement(url)
    if (img.decode) await img.decode().catch(() => undefined)
    return await processImage(img, img.naturalWidth, img.naturalHeight, file.name)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function processImage(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  name: string,
): Promise<SourceImage> {
  if (!sw || !sh) throw new ImageLoadError('This image appears to be empty.')
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))
  const canvas = downscale(source, sw, sh, width, height)
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
  return { canvas, width, height, previewUrl: URL.createObjectURL(blob), name }
}

/** A procedurally painted landscape, for trying the game without a photo. */
export async function createSampleImage(): Promise<SourceImage> {
  const w = 1600
  const h = 1200
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62)
  sky.addColorStop(0, '#1b2a6b')
  sky.addColorStop(0.45, '#c2508f')
  sky.addColorStop(1, '#ffb36b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const sun = ctx.createRadialGradient(w * 0.68, h * 0.5, 10, w * 0.68, h * 0.5, 260)
  sun.addColorStop(0, 'rgba(255,245,200,1)')
  sun.addColorStop(0.35, 'rgba(255,214,120,0.9)')
  sun.addColorStop(1, 'rgba(255,180,100,0)')
  ctx.fillStyle = sun
  ctx.beginPath()
  ctx.arc(w * 0.68, h * 0.5, 260, 0, Math.PI * 2)
  ctx.fill()

  const rand = (() => {
    let t = 7
    return () => ((t = (t * 16807) % 2147483647) - 1) / 2147483646
  })()
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.6})`
    ctx.beginPath()
    ctx.arc(rand() * w, rand() * h * 0.3, rand() * 2 + 0.6, 0, Math.PI * 2)
    ctx.fill()
  }

  const ridge = (base: number, amp: number, color: string, seed: number) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 8) {
      const y =
        base +
        Math.sin(x * 0.004 + seed) * amp +
        Math.sin(x * 0.011 + seed * 2) * amp * 0.45 +
        Math.sin(x * 0.029 + seed * 3) * amp * 0.15
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
  }
  ridge(h * 0.58, 70, '#6b3a78', 1)
  ridge(h * 0.66, 60, '#47285f', 2.3)
  ridge(h * 0.75, 50, '#2c1b47', 4.1)

  const lake = ctx.createLinearGradient(0, h * 0.8, 0, h)
  lake.addColorStop(0, '#ff9f68')
  lake.addColorStop(1, '#253a7a')
  ctx.fillStyle = lake
  ctx.fillRect(0, h * 0.82, w, h * 0.18)
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,230,180,${0.15 + rand() * 0.35})`
    const y = h * 0.84 + rand() * h * 0.14
    const x = w * 0.68 + (rand() - 0.5) * 360
    ctx.fillRect(x - 60, y, 60 + rand() * 90, 3)
  }

  for (let i = 0; i < 14; i++) {
    const x = rand() * w
    const base = h * 0.82
    const th = 90 + rand() * 120
    ctx.fillStyle = '#150d24'
    ctx.beginPath()
    ctx.moveTo(x, base - th)
    ctx.lineTo(x - th * 0.22, base)
    ctx.lineTo(x + th * 0.22, base)
    ctx.closePath()
    ctx.fill()
  }

  return processImage(c, w, h, 'Sample sunset')
}
