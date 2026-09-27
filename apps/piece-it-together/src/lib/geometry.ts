import type { EdgeShape, PieceDef, PuzzleSpec } from './types'

/** Tab size as a fraction of the shorter core side. */
const TAB = 0.1
const JITTER = 0.04

type Rand = () => number

/** Deterministic PRNG so a puzzle can be re-cut identically from a seed. */
export function mulberry32(seed: number): Rand {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function randomEdge(rand: Rand): EdgeShape {
  const j = () => (rand() * 2 - 1) * JITTER
  return { flip: rand() < 0.5 ? 1 : -1, a: j(), b: j(), c: j(), d: j(), e: j() }
}

interface V {
  x: number
  y: number
}

/**
 * Ten control points of a classic jigsaw edge from `start` to `end`.
 * `u` runs along the edge, `v` across it. The tab region (u in 0.2..0.8)
 * is scaled by `s` (the shorter piece side) so tabs keep the same shape on
 * non-square pieces.
 */
function edgePoints(start: V, end: V, s: number, shape: EdgeShape): V[] {
  const len = Math.hypot(end.x - start.x, end.y - start.y)
  const ux = (end.x - start.x) / len
  const uy = (end.y - start.y) / len
  // Fixed normal per orientation: +y for horizontal edges, +x for vertical
  // ones, so both neighbours derive the same curve from the same EdgeShape.
  const nx = Math.abs(uy) > 0.5 ? 1 : 0
  const ny = Math.abs(uy) > 0.5 ? 0 : 1
  const { a, b, c, d, e, flip } = shape
  const t = TAB
  const along = (u: number, tab: boolean) => (tab ? len / 2 + (u - 0.5) * s : u * len)
  const at = (u: number, v: number, tab = true): V => {
    const du = along(u, tab)
    const dv = v * s * flip
    return { x: start.x + ux * du + nx * dv, y: start.y + uy * du + ny * dv }
  }
  return [
    at(0, 0, false),
    at(0.2, a, false),
    at(0.5 + b + d, -t + c),
    at(0.5 - t + b, t + c),
    at(0.5 - 2 * t + b - d, 3 * t + c),
    at(0.5 + 2 * t + b - d, 3 * t + c),
    at(0.5 + t + b, t + c),
    at(0.5 + b + d, -t + c),
    at(0.8, e, false),
    at(1, 0, false),
  ]
}

const f = (n: number) => (Math.round(n * 100) / 100).toString()

function curveSegments(points: V[], ox: number, oy: number): string {
  const p = points.map((q) => `${f(q.x - ox)} ${f(q.y - oy)}`)
  return `C ${p[1]} ${p[2]} ${p[3]} C ${p[4]} ${p[5]} ${p[6]} C ${p[7]} ${p[8]} ${p[9]}`
}

/**
 * Cut an image into a rows × cols jigsaw. Returns SVG paths for every piece
 * in core-local coordinates; neighbouring pieces share exactly the same
 * curve so they interlock perfectly.
 */
export function generatePuzzle(
  rows: number,
  cols: number,
  imageW: number,
  imageH: number,
  seed: number,
): PuzzleSpec {
  const rand = mulberry32(seed)
  const pw = imageW / cols
  const ph = imageH / rows
  const s = Math.min(pw, ph)

  // hEdges[r][c]: edge on top of row r (r = 1..rows-1), column c.
  const hEdges: EdgeShape[][] = []
  for (let r = 0; r <= rows; r++) {
    hEdges.push(Array.from({ length: cols }, () => randomEdge(rand)))
  }
  // vEdges[r][c]: edge on the left of column c (c = 1..cols-1), row r.
  const vEdges: EdgeShape[][] = []
  for (let r = 0; r < rows; r++) {
    vEdges.push(Array.from({ length: cols + 1 }, () => randomEdge(rand)))
  }

  const pieces: PieceDef[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * pw
      const oy = r * ph
      const tl = { x: ox, y: oy }
      const tr = { x: ox + pw, y: oy }
      const br = { x: ox + pw, y: oy + ph }
      const bl = { x: ox, y: oy + ph }
      const L = (q: V) => `L ${f(q.x - ox)} ${f(q.y - oy)}`
      let d = `M 0 0 `
      // Top: canonical direction (left→right).
      d += r === 0 ? L(tr) : curveSegments(edgePoints(tl, tr, s, hEdges[r][c]), ox, oy)
      d += ' '
      // Right: canonical top→bottom.
      d += c === cols - 1 ? L(br) : curveSegments(edgePoints(tr, br, s, vEdges[r][c + 1]), ox, oy)
      d += ' '
      // Bottom: canonical is left→right for the edge below, traverse reversed.
      d +=
        r === rows - 1
          ? L(bl)
          : curveSegments(edgePoints(bl, br, s, hEdges[r + 1][c]).reverse(), ox, oy)
      d += ' '
      // Left: canonical top→bottom for this column's left edge, reversed.
      d += c === 0 ? L(tl) : curveSegments(edgePoints(tl, bl, s, vEdges[r][c]).reverse(), ox, oy)
      d += ' Z'
      pieces.push({ id: r * cols + c, row: r, col: c, path: d })
    }
  }

  // Tabs reach ~0.34·s beyond the core; leave room for the drop shadow too.
  const pad = Math.ceil(s * 0.42)
  return { rows, cols, pw, ph, pad, imageW, imageH, pieces }
}
