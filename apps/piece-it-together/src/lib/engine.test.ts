import { describe, expect, it } from 'vitest'
import { createGame, gameReducer, resolveSnaps, type GameState } from './game'
import { generatePuzzle } from './geometry'
import { chooseGrid } from './grid'
import { computeLayout, homeOf, scatterSlots } from './layout'
import type { PieceState } from './types'

describe('chooseGrid', () => {
  it('matches the documented presets for square-ish images', () => {
    expect(chooseGrid(25, 1000, 1000)).toEqual({ rows: 5, cols: 5 })
    expect(chooseGrid(100, 1000, 1000)).toEqual({ rows: 10, cols: 10 })
  })

  it('keeps pieces close to square and near the target count', () => {
    for (const [w, h] of [
      [4000, 3000],
      [3000, 4000],
      [1920, 1080],
      [1080, 1920],
      [1000, 1000],
    ]) {
      for (const n of [10, 25, 50, 100]) {
        const g = chooseGrid(n, w, h)
        const count = g.rows * g.cols
        expect(Math.abs(count - n)).toBeLessThanOrEqual(Math.round(n * 0.2))
        const aspect = w / g.cols / (h / g.rows)
        expect(aspect).toBeGreaterThan(0.5)
        expect(aspect).toBeLessThan(2)
      }
    }
  })

  it('gives 5×10 for 50 pieces on a 2:1 image', () => {
    expect(chooseGrid(50, 2000, 1000)).toEqual({ rows: 5, cols: 10 })
  })
})

describe('generatePuzzle', () => {
  it('creates one closed path per piece', () => {
    const spec = generatePuzzle(4, 6, 1200, 800, 42)
    expect(spec.pieces).toHaveLength(24)
    for (const p of spec.pieces) {
      expect(p.path.startsWith('M 0 0')).toBe(true)
      expect(p.path.endsWith('Z')).toBe(true)
    }
  })

  it('uses straight outer edges and curved inner edges', () => {
    const spec = generatePuzzle(3, 3, 900, 900, 1)
    const corner = spec.pieces[0].path
    // Top-left corner: top and left edges are straight lines.
    expect(corner).toMatch(/^M 0 0 L 300 0 /)
    expect(corner).toMatch(/L 0 0 Z$/)
    // Centre piece has four curved edges (3 cubic segments each).
    expect(spec.pieces[4].path.match(/C /g)).toHaveLength(12)
  })

  it('is deterministic for a seed', () => {
    expect(generatePuzzle(5, 5, 500, 500, 9)).toEqual(generatePuzzle(5, 5, 500, 500, 9))
  })
})

describe('layout', () => {
  it('provides a scatter slot for every piece and keeps the board in the world', () => {
    for (const n of [10, 25, 50, 100]) {
      const g = chooseGrid(n, 1800, 1350)
      const spec = generatePuzzle(g.rows, g.cols, 1800, 1350, 3)
      for (const [vw, vh] of [
        [390, 640],
        [1440, 800],
      ]) {
        const layout = computeLayout(spec, vw, vh)
        expect(scatterSlots(spec, layout).length).toBeGreaterThanOrEqual(spec.pieces.length)
        expect(layout.boardX).toBeGreaterThanOrEqual(0)
        expect(layout.boardY).toBeGreaterThanOrEqual(0)
        expect(layout.boardX + spec.imageW).toBeLessThanOrEqual(layout.worldW)
        expect(layout.boardY + spec.imageH).toBeLessThanOrEqual(layout.worldH)
      }
    }
  })
})

function setup(rows = 3, cols = 3, rotation = false): GameState {
  const spec = generatePuzzle(rows, cols, 900, 600, 5)
  const layout = computeLayout(spec, 1200, 800)
  return createGame(spec, layout, rotation, 0)
}

function moveTo(state: GameState, id: number, x: number, y: number, now = 1000): GameState {
  const p = state.pieces[id]
  return gameReducer(state, { type: 'drop', id, dx: x - p.x, dy: y - p.y, now })
}

describe('game', () => {
  it('scatters every piece off the board at start', () => {
    const s = setup()
    for (const p of s.pieces) {
      const d = s.spec.pieces[p.id]
      const home = homeOf(s.spec, s.layout, d.row, d.col)
      expect(Math.hypot(home.x - p.x, home.y - p.y)).toBeGreaterThan(5)
      expect(p.locked).toBe(false)
    }
  })

  it('snaps and locks a piece dropped near its home, and counts moves', () => {
    let s = setup()
    const home = homeOf(s.spec, s.layout, 0, 0)
    s = moveTo(s, 0, home.x + 12, home.y - 9)
    expect(s.pieces[0].locked).toBe(true)
    expect(s.pieces[0].x).toBe(home.x)
    expect(s.moves).toBe(1)
    expect(s.feedback?.kind).toBe('snap')
  })

  it('does not snap a piece dropped far away', () => {
    let s = setup()
    const home = homeOf(s.spec, s.layout, 0, 0)
    s = moveTo(s, 0, home.x + s.spec.pw, home.y)
    expect(s.pieces[0].locked).toBe(false)
  })

  it('joins neighbours off the board and moves them as a group', () => {
    let s = setup()
    s = moveTo(s, 0, s.spec.pw * 0.8, s.layout.worldH / 2)
    const a = s.pieces[0]
    // Place piece 1 (to the right of 0) roughly where it belongs relative to piece 0.
    s = moveTo(s, 1, a.x + s.spec.pw + 6, a.y - 4)
    expect(s.pieces[1].group).toBe(s.pieces[0].group)
    expect(s.pieces[1].x - s.pieces[0].x).toBeCloseTo(s.spec.pw)
    const before = s.pieces.map((p) => ({ ...p }))
    s = gameReducer(s, { type: 'drop', id: 0, dx: 30, dy: 20, now: 2000 })
    expect(s.pieces[0].x - before[0].x).toBeCloseTo(s.pieces[1].x - before[1].x)
  })

  it('completes when every piece is placed and freezes the time', () => {
    let s = setup(2, 3)
    for (const d of s.spec.pieces) {
      if (s.pieces[d.id].locked) continue
      const home = homeOf(s.spec, s.layout, d.row, d.col)
      s = moveTo(s, d.id, home.x, home.y, 5000)
    }
    expect(s.status).toBe('complete')
    expect(s.finalMs).toBe(5000)
    const later = gameReducer(s, { type: 'pause', now: 9000 })
    expect(later.finalMs).toBe(5000)
  })

  it('pauses and resumes the clock', () => {
    let s = setup()
    s = gameReducer(s, { type: 'pause', now: 3000 })
    expect(s.status).toBe('paused')
    expect(s.elapsedMs).toBe(3000)
    const ignored = gameReducer(s, { type: 'drop', id: 0, dx: 10, dy: 10, now: 3500 })
    expect(ignored).toBe(s)
    s = gameReducer(s, { type: 'resume', now: 10_000 })
    expect(s.runningSince).toBe(10_000)
  })

  it('hints add a time penalty', () => {
    let s = setup()
    s = gameReducer(s, { type: 'hint', pick: 0.5 })
    expect(s.hint).not.toBeNull()
    expect(s.elapsedMs).toBe(10_000)
    expect(s.hintsUsed).toBe(1)
  })

  it('rotated pieces only snap once upright', () => {
    let s = setup(3, 3, true)
    s = { ...s, pieces: s.pieces.map((p) => (p.id === 0 ? { ...p, rot: 1 } : p)) }
    const home = homeOf(s.spec, s.layout, 0, 0)
    s = moveTo(s, 0, home.x, home.y)
    expect(s.pieces[0].locked).toBe(false)
    for (let i = 0; i < 3; i++) s = gameReducer(s, { type: 'rotate', id: 0, now: 1 })
    expect(s.pieces[0].rot).toBe(0)
    expect(s.pieces[0].locked).toBe(true)
  })

  it('restart resets moves, time and placement', () => {
    let s = setup()
    const home = homeOf(s.spec, s.layout, 0, 0)
    s = moveTo(s, 0, home.x, home.y)
    s = gameReducer(s, { type: 'restart', now: 50 })
    expect(s.moves).toBe(0)
    expect(s.pieces.some((p) => p.locked)).toBe(false)
    expect(s.runningSince).toBe(50)
  })

  it('resolveSnaps ignores already-grouped pieces', () => {
    const s = setup()
    const pieces: PieceState[] = s.pieces.map((p) => ({ ...p }))
    const res = resolveSnaps(s.spec, s.layout, pieces, pieces[4].group)
    expect(res.kind === null || res.ids.length > 0).toBe(true)
  })
})
