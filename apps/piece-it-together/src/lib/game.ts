import { clampShift, homeOf, scatter } from './layout'
import type { Layout, PieceState, PuzzleSpec } from './types'

export type Status = 'playing' | 'paused' | 'complete'

export type FeedbackKind = 'snap' | 'join' | 'drop' | 'rotate'

export const HINT_PENALTY_MS = 10_000

export interface GameState {
  spec: PuzzleSpec
  layout: Layout
  pieces: PieceState[]
  moves: number
  status: Status
  /** Time banked before `runningSince` (includes hint penalties). */
  elapsedMs: number
  runningSince: number | null
  hintsUsed: number
  hint: { id: number; nonce: number } | null
  feedback: { kind: FeedbackKind; ids: number[]; nonce: number } | null
  rotation: boolean
  /** True only if rotation stayed on for the whole game (for records). */
  rotationThroughout: boolean
  zTop: number
  finalMs: number | null
}

export type GameAction =
  | { type: 'drop'; id: number; dx: number; dy: number; now: number }
  | { type: 'rotate'; id: number; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'shuffle' }
  | { type: 'restart'; now: number }
  | { type: 'hint'; pick: number }
  | { type: 'clearHint' }
  | { type: 'setRotation'; enabled: boolean }
  | { type: 'relayout'; layout: Layout; rescatter: boolean }

export function elapsedAt(state: GameState, now: number): number {
  if (state.finalMs !== null) return state.finalMs
  return state.elapsedMs + (state.runningSince !== null ? now - state.runningSince : 0)
}

export function snapDistance(spec: PuzzleSpec): number {
  return Math.min(spec.pw, spec.ph) * 0.3
}

/** Rotate a vector by `turns` quarter turns clockwise (screen coordinates). */
export function rotateVec(x: number, y: number, turns: number): { x: number; y: number } {
  switch (((turns % 4) + 4) % 4) {
    case 1:
      return { x: -y, y: x }
    case 2:
      return { x: -x, y: -y }
    case 3:
      return { x: y, y: -x }
    default:
      return { x, y }
  }
}

function freshPieces(spec: PuzzleSpec, layout: Layout): PieceState[] {
  return spec.pieces.map((d) => {
    const home = homeOf(spec, layout, d.row, d.col)
    return { id: d.id, x: home.x, y: home.y, rot: 0, group: d.id, locked: false, z: 10 }
  })
}

export function createGame(spec: PuzzleSpec, layout: Layout, rotation: boolean, now: number): GameState {
  const pieces = scatter(spec, layout, freshPieces(spec, layout), Math.random, rotation)
  return {
    spec,
    layout,
    pieces,
    moves: 0,
    status: 'playing',
    elapsedMs: 0,
    runningSince: now,
    hintsUsed: 0,
    hint: null,
    feedback: null,
    rotation,
    rotationThroughout: rotation,
    zTop: pieces.length + 10,
    finalMs: null,
  }
}

function membersOf(pieces: PieceState[], group: number): PieceState[] {
  return pieces.filter((p) => p.group === group)
}

let nonce = 0
const nextNonce = () => ++nonce

/**
 * After a group has moved, try (1) snapping it onto the board if any member
 * is near its home, then (2) joining correctly-aligned loose neighbours.
 * `pieces` is mutated (the caller passes a fresh copy).
 */
export function resolveSnaps(
  spec: PuzzleSpec,
  layout: Layout,
  pieces: PieceState[],
  group: number,
): { kind: 'snap' | 'join' | null; ids: number[] } {
  const dist = snapDistance(spec)
  let kind: 'snap' | 'join' | null = null
  const joined = new Set<number>()

  for (let pass = 0; pass < 8; pass++) {
    const members = membersOf(pieces, group)
    const rot = members[0].rot

    // 1. Board snap (only when upright).
    if (rot === 0) {
      let best = Infinity
      for (const m of members) {
        const def = spec.pieces[m.id]
        const home = homeOf(spec, layout, def.row, def.col)
        best = Math.min(best, Math.hypot(home.x - m.x, home.y - m.y))
      }
      if (best <= dist) {
        for (const m of members) {
          const def = spec.pieces[m.id]
          const home = homeOf(spec, layout, def.row, def.col)
          m.x = home.x
          m.y = home.y
          m.locked = true
          m.z = 1
        }
        return { kind: 'snap', ids: members.map((m) => m.id) }
      }
    }

    // 2. Join a loose neighbour that lines up with a member of this group.
    let merged = false
    for (const m of members) {
      const md = spec.pieces[m.id]
      const around: [number, number][] = [
        [md.row - 1, md.col],
        [md.row + 1, md.col],
        [md.row, md.col - 1],
        [md.row, md.col + 1],
      ]
      for (const [r, c] of around) {
        if (r < 0 || c < 0 || r >= spec.rows || c >= spec.cols) continue
        const n = pieces[r * spec.cols + c]
        if (n.group === group || n.locked || n.rot !== rot) continue
        const off = rotateVec((c - md.col) * spec.pw, (r - md.row) * spec.ph, rot)
        const ex = m.x + off.x
        const ey = m.y + off.y
        if (Math.hypot(n.x - ex, n.y - ey) > dist) continue
        // Move this group onto the stationary neighbour, then merge.
        const sx = n.x - ex
        const sy = n.y - ey
        for (const p of members) {
          p.x += sx
          p.y += sy
        }
        const otherGroup = n.group
        const topZ = Math.max(...members.map((p) => p.z))
        for (const p of pieces) {
          if (p.group === otherGroup) {
            p.group = group
            p.z = topZ
            joined.add(p.id)
          }
        }
        for (const p of members) joined.add(p.id)
        kind = 'join'
        merged = true
        break
      }
      if (merged) break
    }
    if (!merged) break
  }
  return { kind, ids: [...joined] }
}

function samePiece(a: PieceState, b: PieceState): boolean {
  return a.x === b.x && a.y === b.y && a.rot === b.rot && a.group === b.group && a.locked === b.locked && a.z === b.z
}

/** Reuse previous objects for untouched pieces so memoised views skip work. */
function keepUnchanged(prev: PieceState[], next: PieceState[]): PieceState[] {
  return next.map((p, i) => (samePiece(p, prev[i]) ? prev[i] : p))
}

function withCompletion(state: GameState, now: number): GameState {
  if (state.status === 'complete') return state
  if (!state.pieces.every((p) => p.locked)) return state
  const finalMs = elapsedAt(state, now)
  return { ...state, status: 'complete', finalMs, runningSince: null, hint: null }
}

function rotateMembers(members: PieceState[], pivotX: number, pivotY: number, turns: number) {
  for (const p of members) {
    const v = rotateVec(p.x - pivotX, p.y - pivotY, turns)
    p.x = pivotX + v.x
    p.y = pivotY + v.y
    p.rot = (((p.rot + turns) % 4) + 4) % 4
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'drop':
    case 'rotate': {
      if (state.status !== 'playing') return state
      const target = state.pieces[action.id]
      if (!target || target.locked) return state
      const pieces = state.pieces.map((p) => ({ ...p }))
      const members = membersOf(pieces, target.group)
      const z = state.zTop + 1
      let feedbackKind: FeedbackKind
      if (action.type === 'drop') {
        const { dx, dy } = clampShift(state.spec, state.layout, members, action.dx, action.dy)
        for (const p of members) {
          p.x += dx
          p.y += dy
          p.z = z
        }
        feedbackKind = 'drop'
      } else {
        if (!state.rotation) return state
        const pivot = pieces[action.id]
        rotateMembers(members, pivot.x, pivot.y, 1)
        const { dx, dy } = clampShift(state.spec, state.layout, members, 0, 0)
        for (const p of members) {
          p.x += dx
          p.y += dy
          p.z = z
        }
        feedbackKind = 'rotate'
      }
      const result = resolveSnaps(state.spec, state.layout, pieces, target.group)
      const ids = result.kind ? result.ids : members.map((m) => m.id)
      const next: GameState = {
        ...state,
        pieces: keepUnchanged(state.pieces, pieces),
        moves: state.moves + 1,
        zTop: z,
        hint: result.kind === 'snap' && state.hint && ids.includes(state.hint.id) ? null : state.hint,
        feedback: { kind: result.kind ?? feedbackKind, ids, nonce: nextNonce() },
      }
      return withCompletion(next, action.now)
    }
    case 'pause':
      if (state.status !== 'playing') return state
      return {
        ...state,
        status: 'paused',
        elapsedMs: elapsedAt(state, action.now),
        runningSince: null,
        hint: null,
      }
    case 'resume':
      if (state.status !== 'paused') return state
      return { ...state, status: 'playing', runningSince: action.now }
    case 'shuffle': {
      if (state.status !== 'playing') return state
      return {
        ...state,
        pieces: scatter(state.spec, state.layout, state.pieces, Math.random, state.rotation),
        feedback: null,
      }
    }
    case 'restart': {
      const fresh = createGame(state.spec, state.layout, state.rotation, action.now)
      return fresh
    }
    case 'hint': {
      if (state.status !== 'playing') return state
      const loose = state.pieces.filter((p) => !p.locked)
      if (loose.length === 0) return state
      const pick = loose[Math.floor(action.pick * loose.length) % loose.length]
      return {
        ...state,
        hintsUsed: state.hintsUsed + 1,
        elapsedMs: state.elapsedMs + HINT_PENALTY_MS,
        hint: { id: pick.id, nonce: nextNonce() },
      }
    }
    case 'clearHint':
      return state.hint ? { ...state, hint: null } : state
    case 'setRotation': {
      if (action.enabled === state.rotation) return state
      const pieces = state.pieces.map((p) => ({ ...p }))
      const groups = new Map<number, PieceState[]>()
      for (const p of pieces) {
        if (p.locked) continue
        const g = groups.get(p.group)
        if (g) g.push(p)
        else groups.set(p.group, [p])
      }
      for (const members of groups.values()) {
        const pivot = members[0]
        const turns = action.enabled ? (members.length === 1 ? Math.floor(Math.random() * 4) : 0) : -pivot.rot
        if (turns !== 0) rotateMembers(members, pivot.x, pivot.y, turns)
        const { dx, dy } = clampShift(state.spec, state.layout, members, 0, 0)
        for (const p of members) {
          p.x += dx
          p.y += dy
        }
      }
      return {
        ...state,
        pieces: keepUnchanged(state.pieces, pieces),
        rotation: action.enabled,
        rotationThroughout: state.rotationThroughout && action.enabled,
      }
    }
    case 'relayout': {
      const { layout } = action
      const sx = layout.boardX - state.layout.boardX
      const sy = layout.boardY - state.layout.boardY
      if (layout.worldW === state.layout.worldW && layout.worldH === state.layout.worldH && !sx && !sy) {
        return state
      }
      if (action.rescatter && state.pieces.every((p) => !p.locked && p.group === p.id)) {
        const moved = state.pieces.map((p) => ({ ...p, x: p.x + sx, y: p.y + sy }))
        return { ...state, layout, pieces: scatter(state.spec, layout, moved, Math.random, false) }
      }
      const pieces = state.pieces.map((p) => ({ ...p, x: p.x + sx, y: p.y + sy }))
      const seen = new Set<number>()
      for (const p of pieces) {
        if (p.locked || seen.has(p.group)) continue
        seen.add(p.group)
        const members = membersOf(pieces, p.group)
        const { dx, dy } = clampShift(state.spec, layout, members, 0, 0)
        for (const m of members) {
          m.x += dx
          m.y += dy
        }
      }
      return { ...state, layout, pieces }
    }
  }
}

/** Count of pieces locked on the board. */
export function placedCount(state: GameState): number {
  let n = 0
  for (const p of state.pieces) if (p.locked) n++
  return n
}
