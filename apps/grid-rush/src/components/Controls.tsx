import type { Phase } from '../game/types';

interface ControlsProps {
  phase: Phase;
  muted: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
}

export function Controls({ phase, muted, onStart, onPause, onResume, onRestart, onToggleMute }: ControlsProps) {
  const inRun = phase === 'playing' || phase === 'paused' || phase === 'levelComplete';

  return (
    <div className="controls">
      {inRun ? (
        <button
          type="button"
          className="btn"
          onClick={phase === 'paused' ? onResume : onPause}
          disabled={phase === 'levelComplete'}
        >
          {phase === 'paused' ? '▶ Resume' : '❚❚ Pause'}
        </button>
      ) : (
        <button type="button" className="btn btn--primary" onClick={onStart}>
          ▶ {phase === 'gameOver' ? 'Play Again' : 'Start Game'}
        </button>
      )}
      <button type="button" className="btn" onClick={onRestart} disabled={!inRun}>
        ↻ Restart
      </button>
      <button
        type="button"
        className="btn btn--icon"
        onClick={onToggleMute}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        title={muted ? 'Unmute (M)' : 'Mute (M)'}
      >
        {muted ? <SpeakerOff /> : <SpeakerOn />}
      </button>
    </div>
  );
}

function SpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
