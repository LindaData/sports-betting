import type { GameState } from '../game/types';
import { LEVEL_ADVANCE_MS } from '../hooks/useGame';
import { formatTime } from './format';

interface OverlayProps {
  state: GameState;
  onStart: () => void;
  onResume: () => void;
  onNextLevel: () => void;
}

export function Overlay({ state, onStart, onResume, onNextLevel }: OverlayProps) {
  if (state.phase === 'playing') return null;

  return (
    <div className={`overlay overlay--${state.phase}`} role="dialog" aria-modal="false" aria-live="polite">
      <div className="overlay__card">{renderContent(state, onStart, onResume, onNextLevel)}</div>
    </div>
  );
}

function renderContent(
  state: GameState,
  onStart: () => void,
  onResume: () => void,
  onNextLevel: () => void,
) {
  switch (state.phase) {
    case 'menu':
      return (
        <>
          <h2 className="overlay__title overlay__title--brand">Grid Rush</h2>
          <p className="overlay__text">
            Grab the coins, dodge the hunters, and dash for the portal. Every level gets a little meaner.
          </p>
          {state.highScore > 0 && (
            <p className="overlay__meta">
              Best score <strong>{state.highScore.toLocaleString()}</strong>
            </p>
          )}
          <button type="button" className="btn btn--primary btn--big" onClick={onStart} autoFocus>
            Start Game
          </button>
          <p className="overlay__hint">Press Enter to start</p>
        </>
      );

    case 'paused':
      return (
        <>
          <h2 className="overlay__title">Paused</h2>
          <p className="overlay__text">
            Level {state.level.number} · {formatTime(state.levelElapsedMs / 1000)} on the clock
          </p>
          <button type="button" className="btn btn--primary btn--big" onClick={onResume} autoFocus>
            Resume
          </button>
          <p className="overlay__hint">Press P or Esc to resume</p>
        </>
      );

    case 'levelComplete': {
      const s = state.lastSummary;
      return (
        <>
          <h2 className="overlay__title overlay__title--win">Level {s?.level ?? state.level.number} clear!</h2>
          {s && (
            <dl className="tally">
              <dt>Goal reached</dt>
              <dd>+{s.goalPoints}</dd>
              <dt>
                Coins {s.coinsCollected}/{s.coinsTotal}
              </dt>
              <dd>+{s.coinPoints}</dd>
              <dt>
                Speed bonus <span className="tally__sub">({formatTime(s.seconds)} vs par {state.level.parSeconds}s)</span>
              </dt>
              <dd className={s.speedBonus > 0 ? 'tally__bonus' : ''}>+{s.speedBonus}</dd>
              <dt className="tally__total">Score</dt>
              <dd className="tally__total">{state.score.toLocaleString()}</dd>
            </dl>
          )}
          <button type="button" className="btn btn--primary btn--big" onClick={onNextLevel} autoFocus>
            Next Level
          </button>
          <div className="advance-bar" style={{ animationDuration: `${LEVEL_ADVANCE_MS}ms` }} />
        </>
      );
    }

    case 'gameOver':
      return (
        <>
          <h2 className="overlay__title overlay__title--lose">Game Over</h2>
          <p className="overlay__text">You reached level {state.level.number}.</p>
          <div className="final-score">
            <span className="final-score__label">Final score</span>
            <span className="final-score__value">{state.score.toLocaleString()}</span>
          </div>
          {state.isNewHighScore ? (
            <p className="new-best">★ New high score! ★</p>
          ) : (
            <p className="overlay__meta">
              Best score <strong>{state.highScore.toLocaleString()}</strong>
            </p>
          )}
          <button type="button" className="btn btn--primary btn--big" onClick={onStart} autoFocus>
            Play Again
          </button>
          <p className="overlay__hint">Press Enter to play again</p>
        </>
      );

    default:
      return null;
  }
}
