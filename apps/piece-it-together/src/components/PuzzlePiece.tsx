import { memo, useLayoutEffect, useRef, useState } from 'react'
import { pieceTransform } from '../lib/transform'
import type { PieceState } from '../lib/types'

interface Props {
  piece: PieceState
  canvas: HTMLCanvasElement
  width: number
  height: number
  hinted: boolean
  /** Changes whenever this piece should play its snap/join flash. */
  flashNonce: number
  flashKind: string
  registerEl: (id: number, el: HTMLDivElement | null) => void
}

/**
 * One jigsaw piece: a pre-rendered bitmap positioned with a GPU transform.
 * Dragging is handled by the board, which moves the element directly and
 * commits the final position through the game reducer.
 */
export const PuzzlePiece = memo(function PuzzlePiece({
  piece,
  canvas,
  width,
  height,
  hinted,
  flashNonce,
  flashKind,
  registerEl,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  // Accumulate quarter turns so CSS animates 270° → 360° instead of spinning back.
  const [turns, setTurns] = useState({ rot: piece.rot, total: piece.rot })
  let total = turns.total
  if (turns.rot !== piece.rot) {
    let delta = (((piece.rot - turns.rot) % 4) + 4) % 4
    if (delta === 3) delta = -1
    total += delta
    setTurns({ rot: piece.rot, total })
  }
  const angle = total * 90

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.appendChild(canvas)
    return () => {
      if (canvas.parentNode === host) host.removeChild(canvas)
    }
  }, [canvas])

  useLayoutEffect(() => {
    registerEl(piece.id, elRef.current)
    return () => registerEl(piece.id, null)
  }, [piece.id, registerEl])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !flashNonce) return
    const cls = `flash-${flashKind}`
    host.classList.remove('flash-snap', 'flash-join')
    void host.offsetWidth
    host.classList.add(cls)
    const t = window.setTimeout(() => host.classList.remove(cls), 700)
    return () => window.clearTimeout(t)
  }, [flashNonce, flashKind])

  return (
    <div
      ref={elRef}
      className={`piece${piece.locked ? ' locked' : ''}${hinted ? ' hinted' : ''}`}
      data-id={piece.id}
      data-z={piece.z}
      data-rot={piece.rot}
      data-locked={piece.locked ? 'true' : 'false'}
      data-angle={angle}
      style={{
        width,
        height,
        zIndex: piece.locked ? 1 : piece.z,
        transform: pieceTransform(piece.x, piece.y, width, height, angle),
      }}
    >
      <div ref={hostRef} className="piece-art" />
    </div>
  )
})
