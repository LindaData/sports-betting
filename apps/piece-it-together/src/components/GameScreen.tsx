import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePuzzleGame } from '../hooks/usePuzzleGame'
import { setSoundEnabled } from '../lib/audio'
import { placedCount } from '../lib/game'
import { generatePuzzle } from '../lib/geometry'
import { chooseGrid } from '../lib/grid'
import { computeLayout } from '../lib/layout'
import { renderPieces, type RenderedPiece } from '../lib/pieceRenderer'
import type { PiecePreset, PuzzleSpec, SourceImage } from '../lib/types'
import { CompletionScreen } from './CompletionScreen'
import { GameControls } from './GameControls'
import { Icon } from './Icon'
import { PuzzleBoard } from './PuzzleBoard'
import { Timer } from './Timer'

interface Props {
  image: SourceImage
  preset: PiecePreset
  rotation: boolean
  sound: boolean
  onSound: (on: boolean) => void
  onRotation: (on: boolean) => void
  onNewImage: () => void
}

interface Cut {
  spec: PuzzleSpec
  rendered: RenderedPiece[]
}

/** Cuts the puzzle (async), then hands over to the active game. */
export function GameScreen(props: Props) {
  const { image, preset } = props
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const [cut, setCut] = useState<Cut | null>(null)

  useEffect(() => {
    let cancelled = false
    const grid = chooseGrid(preset, image.width, image.height)
    const spec = generatePuzzle(grid.rows, grid.cols, image.width, image.height, seed)
    renderPieces(spec, image.canvas).then((rendered) => {
      if (!cancelled) setCut({ spec, rendered })
    })
    return () => {
      cancelled = true
    }
  }, [image, preset, seed])

  if (!cut) {
    return (
      <div className="screen loading-screen">
        <span className="spinner" aria-hidden="true" />
        <p>Cutting {preset} pieces…</p>
      </div>
    )
  }

  return (
    <ActiveGame
      key={seed}
      {...props}
      spec={cut.spec}
      rendered={cut.rendered}
      onPlayAgain={() => {
        setCut(null)
        setSeed((s) => s + 1)
      }}
    />
  )
}

interface ActiveProps extends Props {
  spec: PuzzleSpec
  rendered: RenderedPiece[]
  onPlayAgain: () => void
}

type Confirm = null | 'restart' | 'leave'

function estimateViewport() {
  const w = window.innerWidth
  const h = window.innerHeight
  const mobile = w < 720
  return { w, h: Math.max(200, h - (mobile ? 140 : 150)) }
}

function ActiveGame({ image, preset, rotation, sound, onSound, onRotation, onNewImage, spec, rendered, onPlayAgain }: ActiveProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(estimateViewport)
  const [initialLayout] = useState(() => computeLayout(spec, size.w, size.h))
  const game = usePuzzleGame(spec, initialLayout, preset, rotation)
  const { state } = game
  const [showGuide, setShowGuide] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const layoutAspect = useRef<number | null>(null)
  const pausedByDialog = useRef(false)

  // Track the real workspace size.
  useLayoutEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setSize((prev) =>
          Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5 ? prev : { w: r.width, h: r.height },
        )
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Re-arrange the table when the viewport shape changes a lot (rotation, window resize).
  const { relayout } = game
  const untouched = state.moves === 0
  useLayoutEffect(() => {
    const aspect = size.w / size.h
    const prev = layoutAspect.current
    if (prev !== null && Math.abs(Math.log(aspect / prev)) < 0.12) return
    layoutAspect.current = aspect
    relayout(computeLayout(spec, size.w, size.h), untouched)
  }, [size, spec, relayout, untouched])

  useEffect(() => setSoundEnabled(sound), [sound])

  // Keep the game's rotation setting in sync with the header toggle.
  const { setRotation } = game
  useEffect(() => setRotation(rotation), [rotation, setRotation])

  // Toast for hint penalty.
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(t)
  }, [toast])

  const playing = state.status === 'playing'
  const paused = state.status === 'paused'
  const complete = state.status === 'complete'
  const total = spec.pieces.length
  const placed = placedCount(state)

  const openConfirm = (kind: Confirm) => {
    if (playing) {
      game.pause()
      pausedByDialog.current = true
    }
    setConfirm(kind)
  }
  const closeConfirm = () => {
    setConfirm(null)
    if (pausedByDialog.current) {
      pausedByDialog.current = false
      game.resume()
    }
  }

  const onHint = () => {
    game.hint()
    setToast({ text: '+10s hint penalty', id: Date.now() })
  }
  const onRestart = () => {
    if (complete || state.moves === 0) game.restart()
    else openConfirm('restart')
  }
  const onLeave = () => {
    if (complete || state.moves === 0) onNewImage()
    else openConfirm('leave')
  }

  // Keyboard shortcuts: P pause/resume, H hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'p' || e.key === 'P') {
        if (state.status === 'playing') game.pause()
        else if (state.status === 'paused' && !confirm) game.resume()
      } else if ((e.key === 'h' || e.key === 'H') && state.status === 'playing') {
        game.hint()
        setToast({ text: '+10s hint penalty', id: Date.now() })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, state.status, confirm])

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={onLeave} aria-label="New image" title="New image">
          <Icon name="close" size={20} />
        </button>
        <span className="brand-inline">
          <Icon name="puzzle" size={20} />
          Piece It Together
        </span>
        <div className="status" role="status" aria-live="off">
          <span data-testid="piece-count">
            <strong>{total}</strong> Pieces
          </span>
          <span className="sep" aria-hidden="true" />
          <Timer getElapsed={game.getElapsed} running={playing} />
          <span className="sep" aria-hidden="true" />
          <span data-testid="moves">
            <strong>{state.moves}</strong> Moves
          </span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`icon-btn${sound ? ' is-on' : ''}`}
            onClick={() => onSound(!sound)}
            aria-pressed={sound}
            aria-label={sound ? 'Sound on' : 'Sound off'}
            title={sound ? 'Sound on' : 'Sound off'}
            data-testid="sound"
          >
            <Icon name={sound ? 'soundOn' : 'soundOff'} size={20} />
          </button>
          <button
            type="button"
            className={`icon-btn${rotation ? ' is-on' : ''}`}
            onClick={() => onRotation(!rotation)}
            aria-pressed={rotation}
            aria-label={rotation ? 'Piece rotation on' : 'Piece rotation off'}
            title={rotation ? 'Rotation on — tap a piece to turn it' : 'Rotation off'}
            data-testid="rotation"
            disabled={complete}
          >
            <Icon name="rotate" size={20} />
          </button>
        </div>
      </header>

      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${(placed / total) * 100}%` }} />
      </div>

      <main ref={workspaceRef} className={`workspace${paused ? ' is-paused' : ''}`}>
        <PuzzleBoard
          state={state}
          rendered={rendered}
          imageUrl={image.previewUrl}
          viewW={size.w}
          viewH={size.h}
          showGuide={showGuide}
          onDrop={game.drop}
          onRotate={game.rotate}
        />

        <p className="placed-count" data-testid="placed">
          {placed}/{total} placed
          {rotation && playing ? ' · tap to rotate' : ''}
        </p>

        {toast && (
          <div key={toast.id} className="toast" role="status">
            {toast.text}
          </div>
        )}

        {paused && !confirm && (
          <div className="overlay pause-overlay" data-testid="pause-overlay">
            <div className="card dialog">
              <h2>Paused</h2>
              <p className="muted">
                {placed}/{total} pieces placed · {state.moves} moves
              </p>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={game.resume} autoFocus>
                <Icon name="play" size={20} />
                Resume
              </button>
              <div className="dialog-row">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirm('restart')}>
                  <Icon name="restart" size={18} />
                  Restart
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirm('leave')}>
                  <Icon name="image" size={18} />
                  New image
                </button>
              </div>
            </div>
          </div>
        )}

        {confirm && (
          <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="card dialog">
              <h2 id="confirm-title">{confirm === 'restart' ? 'Restart puzzle?' : 'Choose a new image?'}</h2>
              <p className="muted">Your current progress and time will be lost.</p>
              <div className="dialog-row">
                <button type="button" className="btn btn-secondary" onClick={closeConfirm} autoFocus>
                  Keep playing
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="confirm"
                  onClick={() => {
                    pausedByDialog.current = false
                    setConfirm(null)
                    if (confirm === 'restart') game.restart()
                    else onNewImage()
                  }}
                >
                  {confirm === 'restart' ? 'Restart' : 'New image'}
                </button>
              </div>
            </div>
          </div>
        )}

        {complete && game.completion && (
          <CompletionScreen
            imageUrl={image.previewUrl}
            imageAspect={image.width / image.height}
            pieceCount={total}
            hintsUsed={state.hintsUsed}
            info={game.completion}
            onPlayAgain={onPlayAgain}
            onNewImage={onNewImage}
          />
        )}
      </main>

      <GameControls
        paused={paused}
        disabled={!playing}
        showGuide={showGuide}
        hintsUsed={state.hintsUsed}
        onHint={onHint}
        onShuffle={game.shuffle}
        onGuide={() => setShowGuide((v) => !v)}
        onPause={paused ? game.resume : game.pause}
        onRestart={onRestart}
      />
    </div>
  )
}
