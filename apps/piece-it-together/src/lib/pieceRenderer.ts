import type { PuzzleSpec } from './types'

export interface RenderedPiece {
  canvas: HTMLCanvasElement
  /** Outline in core-local coordinates, for precise hit testing. */
  hitPath: Path2D
}

/**
 * Pre-render every piece once: image clipped to the jigsaw outline, with a
 * baked drop shadow, bevel highlight and hairline border. Pieces are then
 * just positioned bitmaps, which keeps 100-piece games smooth on phones.
 */
export async function renderPieces(spec: PuzzleSpec, image: HTMLCanvasElement): Promise<RenderedPiece[]> {
  const { pw, ph, pad } = spec
  const s = Math.min(pw, ph)
  const w = Math.ceil(pw + pad * 2)
  const h = Math.ceil(ph + pad * 2)
  const bevel = Math.max(1, s * 0.022)
  const out: RenderedPiece[] = []

  for (let i = 0; i < spec.pieces.length; i++) {
    const piece = spec.pieces[i]
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.translate(pad, pad)
    const path = new Path2D(piece.path)

    // Soft shadow underneath for depth.
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = s * 0.06
    ctx.shadowOffsetY = s * 0.025
    ctx.fillStyle = '#222'
    ctx.fill(path)
    ctx.restore()

    // Image, clipped to the outline.
    ctx.save()
    ctx.clip(path)
    ctx.drawImage(image, -piece.col * pw, -piece.row * ph)

    // Inner bevel: light from the top-left, shade toward the bottom-right.
    ctx.lineWidth = bevel * 2
    ctx.translate(-bevel * 0.7, -bevel * 0.7)
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    ctx.stroke(path)
    ctx.translate(bevel * 1.4, bevel * 1.4)
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'
    ctx.stroke(path)
    ctx.restore()

    // Crisp outline.
    ctx.lineWidth = Math.max(0.75, s * 0.008)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.stroke(path)

    out.push({ canvas, hitPath: path })

    // Yield occasionally so large puzzles don't block the main thread.
    if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0))
  }
  return out
}
