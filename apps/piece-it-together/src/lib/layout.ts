import type { Layout, PieceState, Point, PuzzleSpec } from './types'

type Placement = 'center' | 'top' | 'left'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function scatterCell(spec: PuzzleSpec) {
  const s = Math.min(spec.pw, spec.ph)
  // Loose pieces may overlap slightly, like a real table.
  return { w: spec.pw + s * 0.3, h: spec.ph + s * 0.3 }
}

/** Centres of non-overlapping slots in the world that avoid the board. */
export function scatterSlots(spec: PuzzleSpec, layout: Layout): Point[] {
  const cell = scatterCell(spec)
  const s = Math.min(spec.pw, spec.ph)
  const gap = s * 0.25
  const board: Rect = {
    x: layout.boardX - gap,
    y: layout.boardY - gap,
    w: spec.imageW + gap * 2,
    h: spec.imageH + gap * 2,
  }
  const margin = s * 0.3
  const halfW = spec.pw / 2 + s * 0.15
  const halfH = spec.ph / 2 + s * 0.15
  const cols = Math.floor((layout.worldW - margin * 2) / cell.w)
  const rows = Math.floor((layout.worldH - margin * 2) / cell.h)
  const offX = (layout.worldW - cols * cell.w) / 2
  const offY = (layout.worldH - rows * cell.h) / 2
  const slots: Point[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offX + (c + 0.5) * cell.w
      const y = offY + (r + 0.5) * cell.h
      const overlaps =
        x + halfW > board.x && x - halfW < board.x + board.w && y + halfH > board.y && y - halfH < board.y + board.h
      if (!overlaps) slots.push({ x, y })
    }
  }
  return slots
}

function place(spec: PuzzleSpec, worldW: number, worldH: number, placement: Placement): Layout {
  const s = Math.min(spec.pw, spec.ph)
  const m = s * 0.45
  let boardX = (worldW - spec.imageW) / 2
  let boardY = (worldH - spec.imageH) / 2
  if (placement === 'top') boardY = m
  if (placement === 'left') boardX = m
  return { worldW, worldH, boardX, boardY }
}

/**
 * Size the world (board + loose-piece area) to match the viewport aspect,
 * trying the board centred, at the top (phones) and at the left, and pick
 * the arrangement that leaves the board largest on screen.
 */
export function computeLayout(spec: PuzzleSpec, viewW: number, viewH: number): Layout {
  const aspect = Math.max(0.3, Math.min(4, viewW / Math.max(1, viewH)))
  const n = spec.pieces.length
  const s = Math.min(spec.pw, spec.ph)
  const m = s * 0.45
  const minW = spec.imageW + m * 2
  const minH = spec.imageH + m * 2

  let best: Layout | null = null
  let bestScale = 0
  for (const placement of ['center', 'top', 'left'] as Placement[]) {
    let w = Math.max(minW, minH * aspect)
    let h = w / aspect
    for (let i = 0; i < 80; i++) {
      const W = Math.max(w, minW)
      const H = Math.max(h, minH)
      const layout = place(spec, W, H, placement)
      if (scatterSlots(spec, layout).length >= n) {
        const scale = Math.min(viewW / W, viewH / H)
        if (scale > bestScale * 1.02 || !best) {
          best = layout
          bestScale = scale
        }
        break
      }
      w *= 1.04
      h *= 1.04
    }
  }
  return best ?? place(spec, minW * 3, minH * 3, 'center')
}

export function shuffleInPlace<T>(arr: T[], rand: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Keep a set of piece centres inside the world. Returns the shift applied. */
export function clampShift(spec: PuzzleSpec, layout: Layout, members: PieceState[], dx: number, dy: number) {
  const r = Math.max(spec.pw, spec.ph) / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of members) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const lo = r * 0.6
  const cx = Math.min(Math.max(dx, lo - minX), layout.worldW - lo - maxX)
  const cy = Math.min(Math.max(dy, lo - minY), layout.worldH - lo - maxY)
  return { dx: Number.isFinite(cx) ? cx : dx, dy: Number.isFinite(cy) ? cy : dy }
}

/**
 * Scatter loose groups into slots around the board. Groups keep their
 * shape; locked pieces stay put.
 */
export function scatter(
  spec: PuzzleSpec,
  layout: Layout,
  pieces: PieceState[],
  rand: () => number = Math.random,
  randomRotation = false,
): PieceState[] {
  const slots = shuffleInPlace(scatterSlots(spec, layout), rand)
  const cell = scatterCell(spec)
  const next = pieces.map((p) => ({ ...p }))
  const groups = new Map<number, PieceState[]>()
  for (const p of next) {
    if (p.locked) continue
    const list = groups.get(p.group)
    if (list) list.push(p)
    else groups.set(p.group, [p])
  }
  const groupList = shuffleInPlace([...groups.values()], rand)
  let z = 10
  groupList.forEach((members, i) => {
    const slot =
      slots.length > 0
        ? slots[i % slots.length]
        : { x: rand() * layout.worldW, y: rand() * layout.worldH }
    const jitterX = (rand() - 0.5) * cell.w * 0.14
    const jitterY = (rand() - 0.5) * cell.h * 0.14
    const anchor = members[0]
    let dx = slot.x + jitterX - anchor.x
    let dy = slot.y + jitterY - anchor.y
    ;({ dx, dy } = clampShift(spec, layout, members, dx, dy))
    const rot = randomRotation && members.length === 1 ? Math.floor(rand() * 4) : null
    for (const p of members) {
      p.x += dx
      p.y += dy
      if (rot !== null) p.rot = rot
      p.z = z
    }
    z++
  })
  return next
}

export function homeOf(spec: PuzzleSpec, layout: Layout, row: number, col: number): Point {
  return {
    x: layout.boardX + (col + 0.5) * spec.pw,
    y: layout.boardY + (row + 0.5) * spec.ph,
  }
}
