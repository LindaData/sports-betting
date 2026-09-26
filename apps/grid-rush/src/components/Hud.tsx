import type { ReactNode } from 'react';
import { STARTING_LIVES } from '../game/engine';
import type { GameState } from '../game/types';
import { formatTime } from './format';

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}

function Stat({ label, value, sub, accent }: StatProps) {
  return (
    <div className={`stat${accent ? ` stat--${accent}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}

export function Hud({ state }: { state: GameState }) {
  const seconds = state.levelElapsedMs / 1000;
  const overPar = seconds > state.level.parSeconds;
  const hearts = Array.from({ length: Math.max(STARTING_LIVES, state.lives) }, (_, i) => (
    <span key={i} className={`heart${i < state.lives ? '' : ' heart--empty'}`} aria-hidden="true">
      ♥
    </span>
  ));

  return (
    <section className="hud" aria-label="Game status">
      <Stat label="Score" value={<span className="tabular">{state.score.toLocaleString()}</span>} accent="score" />
      <Stat label="Level" value={state.level.number} accent="level" />
      <Stat
        label="Lives"
        value={
          <span className="hearts" aria-label={`${state.lives} lives`}>
            {hearts}
          </span>
        }
        accent="lives"
      />
      <Stat
        label="Time"
        value={<span className={`tabular${overPar ? ' over-par' : ''}`}>{formatTime(seconds)}</span>}
        sub={overPar ? 'past par' : `par ${state.level.parSeconds}s`}
        accent="time"
      />
      <Stat label="Best" value={<span className="tabular">{state.highScore.toLocaleString()}</span>} accent="best" />
    </section>
  );
}
