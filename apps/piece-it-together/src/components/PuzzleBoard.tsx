import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { play, unlockAudio } from '../lib/audio'
import { rotateVec, type GameState } from '../lib/game'
import type { RenderedPiece } from '../lib/pieceRenderer'
import type { PieceState } from '../lib/types'
import { Icon } from './Icon'
import { pieceTransform } from '../lib/transform'
import { PuzzlePiece } from './PuzzlePiece'

interface Props {
  state: GameState
  rendered: RenderedPiece[]
  imageUrl: string
  viewW: number
  viewH: number
  showGuide: boolean
  onDrop: (id: number, dx: number, dy: number) => void
  onRotate: (id: number) => void
}

interface View {
  scale: number
  tx: number
  ty: number
}

interface DragMember {
  id: number
  el: HTMLDivElement
  x: number
  y: number
  angle: number
  base: string
}

type Gesture =
  | { kind: 'none' }
  | {
      kind: 'drag'
      id: number
      pointerId: number
      startX: number
      startY: number
      startTime: number
      members: DragMember[]
      moved: boolean
      dx: number
      dy: number
      bounds: { minDx: number; maxDx: number; minDy: number; maxDy: number }
    }
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; view: View }
  | { kind: 'pinch'; startDist: number; startMid: { x: number; y: number }; view: View }

const MAX_ZOOM = 5
const TAP_SLOP_PX = 7
const TAP_MS = 450

let hitCtx: CanvasRenderingContext2D | null = null
function hitContext(): CanvasRenderingContext2D {
  if (!hitCtx) hitCtx = document.createElement('canvas').getContext('2d')!
  return hitCtx
}

export function PuzzleBoard({ state, rendered, imageUrl, viewW, viewH, showGuide, onDrop, onRotate }: Props) {
  const { spec, layout, pieces } = state
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const elements = useRef(new Map<number, HTMLDivElement>())
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture>({ kind: 'none' })
  const stateRef = useRef(state)
  const frame = useRef(0)
  const fitBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pieceW = rendered[0]?.canvas.width ?? 0
  const pieceH = rendered[0]?.canvas.height ?? 0

  // ---- View (fit, zoom, pan) -------------------------------------------
  const fitScale = Math.min(viewW / layout.worldW, viewH / layout.worldH)
  const view = useRef<View>({ scale: fitScale, tx: 0, ty: 0 })

  const clampView = useCallback(
    (v: View): View => {
      const scale = Math.min(Math.max(v.scale, fitScale), fitScale * MAX_ZOOM)
      const w = layout.worldW * scale
      const h = layout.worldH * scale
      const tx = w <= viewW ? (viewW - w) / 2 : Math.min(0, Math.max(viewW - w, v.tx))
      const ty = h <= viewH ? (viewH - h) / 2 : Math.min(0, Math.max(viewH - h, v.ty))
      return { scale, tx, ty }
    },
    [fitScale, layout.worldW, layout.worldH, viewW, viewH],
  )

  const applyView = useCallback(
    (v: View) => {
      const next = clampView(v)
      view.current = next
      const world = worldRef.current
      if (world) {
        world.style.transform = `translate3d(${next.tx}px, ${next.ty}px, 0) scale(${next.scale})`
        world.style.setProperty('--inv', String(1 / next.scale))
      }
      if (fitBtnRef.current) fitBtnRef.current.hidden = next.scale <= fitScale * 1.01
    },
    [clampView, fitScale],
  )

  const resetView = useCallback(() => applyView({ scale: fitScale, tx: 0, ty: 0 }), [applyView, fitScale])

  useLayoutEffect(() => {
    resetView()
  }, [resetView])

  const toWorld = (clientX: number, clientY: number) => {
    const rect = viewportRef.current!.getBoundingClientRect()
    const v = view.current
    return { x: (clientX - rect.left - v.tx) / v.scale, y: (clientY - rect.top - v.ty) / v.scale }
  }

  // Wheel / trackpad zoom needs a non-passive listener.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      const v = view.current
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const scale = Math.min(Math.max(v.scale * factor, fitScale), fitScale * MAX_ZOOM)
      const wx = (px - v.tx) / v.scale
      const wy = (py - v.ty) / v.scale
      applyView({ scale, tx: px - wx * scale, ty: py - wy * scale })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyView, fitScale])

  // ---- Hit testing -----------------------------------------------------
  const hitTest = (wx: number, wy: number): PieceState | null => {
    const s = stateRef.current
    const loose = s.pieces.filter((p) => !p.locked).sort((a, b) => b.z - a.z || b.id - a.id)
    const ctx = hitContext()
    for (const p of loose) {
      const local = rotateVec(wx - p.x, wy - p.y, -p.rot)
      const lx = local.x + s.spec.pw / 2
      const ly = local.y + s.spec.ph / 2
      if (Math.abs(local.x) > pieceW || Math.abs(local.y) > pieceH) continue
      if (ctx.isPointInPath(rendered[p.id].hitPath, lx, ly)) return p
    }
    // Forgiving fallback for fingers: nearest piece centre within reach.
    const reach = Math.max(Math.max(s.spec.pw, s.spec.ph) * 0.6, 26 / view.current.scale)
    let best: PieceState | null = null
    let bestD = reach
    for (const p of loose) {
      const d = Math.hypot(wx - p.x, wy - p.y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best
  }

  // ---- Drag rendering ---------------------------------------------------
  const paintDrag = () => {
    frame.current = 0
    const g = gesture.current
    if (g.kind !== 'drag') return
    for (const m of g.members) {
      m.el.style.transform = pieceTransform(m.x + g.dx, m.y + g.dy, pieceW, pieceH, m.angle, true)
    }
  }

  const endDrag = (commit: boolean) => {
    const g = gesture.current
    if (g.kind !== 'drag') return
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
    for (const m of g.members) {
      m.el.classList.remove('dragging')
      m.el.style.transform = m.base
    }
    gesture.current = { kind: 'none' }
    if (!commit) return
    if (g.moved) {
      onDrop(g.id, g.dx, g.dy)
    } else if (performance.now() - g.startTime < TAP_MS && stateRef.current.rotation) {
      onRotate(g.id)
    }
  }

  const startPinch = () => {
    const pts = [...pointers.current.values()]
    if (pts.length < 2) return
    const [a, b] = pts
    gesture.current = {
      kind: 'pinch',
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      view: { ...view.current },
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    unlockAudio()
    if (stateRef.current.status !== 'playing') return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Some synthetic pointers can't be captured; dragging still works.
    }

    const g = gesture.current
    if (pointers.current.size >= 2) {
      if (g.kind === 'drag') return // a second finger during a drag is ignored
      startPinch()
      return
    }

    const w = toWorld(e.clientX, e.clientY)
    const hit = hitTest(w.x, w.y)
    if (!hit) {
      gesture.current = { kind: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, view: { ...view.current } }
      return
    }
    const s = stateRef.current
    const group = s.pieces.filter((p) => p.group === hit.group)
    const members: DragMember[] = []
    for (const p of group) {
      const el = elements.current.get(p.id)
      if (!el) continue
      members.push({ id: p.id, el, x: p.x, y: p.y, angle: Number(el.dataset.angle ?? 0), base: el.style.transform })
    }
    // Keep piece centres inside the world while dragging.
    const lo = Math.max(s.spec.pw, s.spec.ph) * 0.3
    const xs = group.map((p) => p.x)
    const ys = group.map((p) => p.y)
    gesture.current = {
      kind: 'drag',
      id: hit.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      members,
      moved: false,
      dx: 0,
      dy: 0,
      bounds: {
        minDx: lo - Math.min(...xs),
        maxDx: s.layout.worldW - lo - Math.max(...xs),
        minDy: lo - Math.min(...ys),
        maxDy: s.layout.worldH - lo - Math.max(...ys),
      },
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (g.kind === 'drag' && e.pointerId === g.pointerId) {
      const sx = e.clientX - g.startX
      const sy = e.clientY - g.startY
      if (!g.moved && Math.hypot(sx, sy) > TAP_SLOP_PX) {
        g.moved = true
        for (const m of g.members) m.el.classList.add('dragging')
        play('pick')
      }
      if (!g.moved) return
      const scale = view.current.scale
      g.dx = Math.min(Math.max(sx / scale, g.bounds.minDx), g.bounds.maxDx)
      g.dy = Math.min(Math.max(sy / scale, g.bounds.minDy), g.bounds.maxDy)
      if (!frame.current) frame.current = requestAnimationFrame(paintDrag)
    } else if (g.kind === 'pan' && e.pointerId === g.pointerId) {
      applyView({ ...g.view, tx: g.view.tx + e.clientX - g.startX, ty: g.view.ty + e.clientY - g.startY })
    } else if (g.kind === 'pinch') {
      const pts = [...pointers.current.values()]
      if (pts.length < 2) return
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const rect = viewportRef.current!.getBoundingClientRect()
      const scale = Math.min(Math.max((g.view.scale * dist) / g.startDist, fitScale), fitScale * MAX_ZOOM)
      const wx = (g.startMid.x - rect.left - g.view.tx) / g.view.scale
      const wy = (g.startMid.y - rect.top - g.view.ty) / g.view.scale
      applyView({ scale, tx: mid.x - rect.left - wx * scale, ty: mid.y - rect.top - wy * scale })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g.kind === 'drag' && e.pointerId === g.pointerId) {
      endDrag(!cancelled)
    } else if (g.kind === 'pinch') {
      // Continue as a pan with the remaining finger, if any.
      const rest = [...pointers.current.entries()][0]
      gesture.current = rest
        ? { kind: 'pan', pointerId: rest[0], startX: rest[1].x, startY: rest[1].y, view: { ...view.current } }
        : { kind: 'none' }
    } else if (g.kind === 'pan' && e.pointerId === g.pointerId) {
      gesture.current = { kind: 'none' }
    }
  }

  // Abandon an in-flight drag if the game pauses underneath it.
  useEffect(() => {
    if (state.status !== 'playing' && gesture.current.kind === 'drag') {
      const g = gesture.current
      for (const m of g.members) {
        m.el.classList.remove('dragging')
        m.el.style.transform = m.base
      }
      gesture.current = { kind: 'none' }
      pointers.current.clear()
    }
  }, [state.status])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const registerEl = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) elements.current.set(id, el)
    else elements.current.delete(id)
  }, [])

  // ---- Render ------------------------------------------------------------
  const hintDef = state.hint ? spec.pieces[state.hint.id] : null
  const feedback = state.feedback
  const flashIds = feedback && (feedback.kind === 'snap' || feedback.kind === 'join') ? new Set(feedback.ids) : null

  return (
    <div
      ref={viewportRef}
      className="viewport"
      data-testid="viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerUp(e)}
      onPointerCancel={(e) => onPointerUp(e, true)}
      onLostPointerCapture={(e) => onPointerUp(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={worldRef} className="world" style={{ width: layout.worldW, height: layout.worldH }}>
        <div
          className="board"
          data-testid="board"
          data-rows={spec.rows}
          data-cols={spec.cols}
          style={{ left: layout.boardX, top: layout.boardY, width: spec.imageW, height: spec.imageH }}
        >
          {showGuide && <img className="board-ghost" src={imageUrl} alt="" draggable={false} />}
          {showGuide && (
            <svg className="board-guide" viewBox={`0 0 ${spec.imageW} ${spec.imageH}`} aria-hidden="true">
              {spec.pieces.map((d) => (
                <path key={d.id} d={d.path} transform={`translate(${d.col * spec.pw} ${d.row * spec.ph})`} />
              ))}
            </svg>
          )}
        </div>

        {hintDef && (
          <svg
            key={state.hint!.nonce}
            className="hint-target"
            style={{ left: layout.boardX, top: layout.boardY, width: spec.imageW, height: spec.imageH }}
            viewBox={`0 0 ${spec.imageW} ${spec.imageH}`}
            data-testid="hint-target"
            aria-hidden="true"
          >
            <path d={hintDef.path} transform={`translate(${hintDef.col * spec.pw} ${hintDef.row * spec.ph})`} />
          </svg>
        )}

        {pieces.map((p) => (
          <PuzzlePiece
            key={p.id}
            piece={p}
            canvas={rendered[p.id].canvas}
            width={pieceW}
            height={pieceH}
            hinted={state.hint?.id === p.id}
            flashNonce={flashIds?.has(p.id) ? feedback!.nonce : 0}
            flashKind={flashIds?.has(p.id) ? feedback!.kind : ''}
            registerEl={registerEl}
          />
        ))}
      </div>

      <button
        ref={fitBtnRef}
        type="button"
        className="fab fit-btn"
        onClick={resetView}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Fit puzzle to screen"
        hidden
      >
        <Icon name="fit" size={20} />
      </button>
    </div>
  )
}
