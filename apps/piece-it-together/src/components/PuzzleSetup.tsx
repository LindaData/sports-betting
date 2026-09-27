import { DIFFICULTY, chooseGrid } from '../lib/grid'
import { formatTime } from '../lib/format'
import { getBest } from '../lib/storage'
import { PIECE_PRESETS, type PiecePreset, type SourceImage } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  image: SourceImage
  preset: PiecePreset
  rotation: boolean
  onPreset: (p: PiecePreset) => void
  onRotation: (on: boolean) => void
  onStart: () => void
  onChangeImage: () => void
}

export function DifficultyMeter({ level }: { level: number }) {
  return (
    <span className="meter" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= level ? 'on' : ''} />
      ))}
    </span>
  )
}

export function PuzzleSetup({ image, preset, rotation, onPreset, onRotation, onStart, onChangeImage }: Props) {
  const grid = chooseGrid(preset, image.width, image.height)
  const diff = DIFFICULTY[preset]
  const best = getBest(preset, rotation)

  return (
    <section className="screen setup">
      <div className="setup-preview card">
        <img src={image.previewUrl} alt="Your puzzle image" style={{ aspectRatio: `${image.width} / ${image.height}` }} />
        <button type="button" className="btn btn-chip change-photo" onClick={onChangeImage}>
          <Icon name="image" size={16} />
          Change photo
        </button>
      </div>

      <div className="setup-panel card">
        <h2>How many pieces?</h2>
        <div className="preset-grid" role="radiogroup" aria-label="Piece count">
          {PIECE_PRESETS.map((p) => {
            const g = chooseGrid(p, image.width, image.height)
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={p === preset}
                aria-label={`${p} pieces, ${DIFFICULTY[p].label}`}
                className={`preset${p === preset ? ' is-active' : ''}`}
                onClick={() => onPreset(p)}
              >
                <span className="preset-count">{p}</span>
                <span className="preset-label">{DIFFICULTY[p].label}</span>
                <span className="preset-grid-size">
                  {g.cols}×{g.rows}
                </span>
              </button>
            )
          })}
        </div>

        <div className="difficulty">
          <DifficultyMeter level={diff.level} />
          <div>
            <strong>{diff.label}</strong>
            <span className="muted">
              {' '}
              · {grid.cols * grid.rows} pieces ({grid.cols}×{grid.rows}) · {diff.blurb}
            </span>
          </div>
        </div>

        <label className="toggle-row">
          <span>
            <strong>Rotate pieces</strong>
            <span className="muted small block">Pieces start turned; tap a piece to rotate it.</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={rotation}
            onChange={(e) => onRotation(e.target.checked)}
          />
        </label>

        <p className="best-line">
          <Icon name="trophy" size={18} />
          {best ? (
            <span>
              Personal best: <strong>{formatTime(best.timeMs)}</strong>
              <span className="muted"> · {best.moves} moves</span>
            </span>
          ) : (
            <span className="muted">No personal best yet at this level</span>
          )}
        </p>

        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onStart}>
          <Icon name="play" size={20} />
          Start Puzzle
        </button>
      </div>
    </section>
  )
}
