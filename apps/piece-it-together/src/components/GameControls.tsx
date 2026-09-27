import { Icon, type IconName } from './Icon'

interface ControlProps {
  icon: IconName
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  badge?: string
  testId?: string
}

function Control({ icon, label, onClick, active, disabled, badge, testId }: ControlProps) {
  return (
    <button
      type="button"
      className={`control${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      data-testid={testId}
    >
      <span className="control-icon">
        <Icon name={icon} size={22} />
        {badge && <span className="control-badge">{badge}</span>}
      </span>
      <span className="control-label">{label}</span>
    </button>
  )
}

interface Props {
  paused: boolean
  disabled: boolean
  showGuide: boolean
  hintsUsed: number
  onHint: () => void
  onShuffle: () => void
  onGuide: () => void
  onPause: () => void
  onRestart: () => void
}

export function GameControls({ paused, disabled, showGuide, hintsUsed, onHint, onShuffle, onGuide, onPause, onRestart }: Props) {
  return (
    <nav className="controls" aria-label="Game controls">
      <Control
        icon="hint"
        label="Hint +10s"
        onClick={onHint}
        disabled={disabled}
        badge={hintsUsed ? String(hintsUsed) : undefined}
        testId="hint"
      />
      <Control icon="shuffle" label="Shuffle" onClick={onShuffle} disabled={disabled} testId="shuffle" />
      <Control icon="eye" label="Guide" onClick={onGuide} active={showGuide} disabled={disabled} testId="guide" />
      <Control
        icon={paused ? 'play' : 'pause'}
        label={paused ? 'Resume' : 'Pause'}
        onClick={onPause}
        disabled={disabled && !paused}
        testId="pause"
      />
      <Control icon="restart" label="Restart" onClick={onRestart} testId="restart" />
    </nav>
  )
}
