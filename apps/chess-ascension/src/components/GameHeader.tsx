import { tierForElo } from '../ai/search';

export interface GameHeaderProps {
  round: number;
  playerElo: number;
  computerElo: number;
  reinforcementCount: number;
  status: string;
  statusTone: 'neutral' | 'good' | 'warn' | 'bad';
  materialDiff: number;
  thinking: boolean;
}

export function GameHeader({ round, playerElo, computerElo, reinforcementCount, status, statusTone, materialDiff, thinking }: GameHeaderProps) {
  return (
    <header className="ghead">
      <div className="ghead__side ghead__side--you">
        <span className="ghead__label">You</span>
        <span className="ghead__elo">{playerElo}</span>
        <span className="ghead__sub">
          {reinforcementCount} Reinforcement{reinforcementCount === 1 ? '' : 's'}
          {materialDiff > 0 ? <em className="ghead__mat"> +{materialDiff}</em> : null}
        </span>
      </div>
      <div className="ghead__center">
        <span className="ghead__round">Round {round}</span>
        <span className={`ghead__status tone--${statusTone}`} role="status" aria-live="polite">
          {thinking ? <span className="spinner" aria-hidden="true" /> : null}
          {status}
        </span>
      </div>
      <div className="ghead__side ghead__side--ai">
        <span className="ghead__label">Computer</span>
        <span className="ghead__elo">{computerElo}</span>
        <span className="ghead__sub">
          {tierForElo(computerElo)}
          {materialDiff < 0 ? <em className="ghead__mat"> +{-materialDiff}</em> : null}
        </span>
      </div>
    </header>
  );
}
