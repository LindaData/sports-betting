import { useEffect, useRef } from 'react'
import type { CompletionInfo } from '../hooks/usePuzzleGame'
import { formatTime } from '../lib/format'
import { Confetti } from './Confetti'
import { Icon } from './Icon'

interface Props {
  imageUrl: string
  imageAspect: number
  pieceCount: number
  hintsUsed: number
  info: CompletionInfo
  onPlayAgain: () => void
  onNewImage: () => void
}

export function CompletionScreen({ imageUrl, imageAspect, pieceCount, hintsUsed, info, onPlayAgain, onNewImage }: Props) {
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => primary.current?.focus(), [])

  return (
    <div className="overlay complete-overlay" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <Confetti />
      <div className="card complete-card">
        <h2 id="complete-title">Puzzle Complete!</h2>
        {info.isNewBest && (
          <p className="new-best">
            <Icon name="trophy" size={18} /> New personal best!
          </p>
        )}
        <img className="complete-image" src={imageUrl} alt="Your completed puzzle" style={{ aspectRatio: imageAspect }} />
        <dl className="stats">
          <div>
            <dt>Time</dt>
            <dd data-testid="final-time">{formatTime(info.timeMs)}</dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd data-testid="final-moves">{info.moves}</dd>
          </div>
          <div>
            <dt>Pieces</dt>
            <dd>{pieceCount}</dd>
          </div>
          <div>
            <dt>Personal best</dt>
            <dd data-testid="personal-best">{info.best ? formatTime(info.best.timeMs) : '—'}</dd>
          </div>
        </dl>
        {hintsUsed > 0 && (
          <p className="muted small center">
            Includes {hintsUsed} hint{hintsUsed === 1 ? '' : 's'} (+{hintsUsed * 10}s)
          </p>
        )}
        <div className="complete-actions">
          <button ref={primary} type="button" className="btn btn-primary btn-lg" onClick={onPlayAgain}>
            <Icon name="restart" size={20} />
            Play Again
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={onNewImage}>
            <Icon name="image" size={20} />
            New Image
          </button>
        </div>
      </div>
    </div>
  )
}
