import { tierForElo } from '../ai/search';
import { ReinforcementIcon } from '../components/ReinforcementIcon';
import { REINFORCEMENT_BY_ID } from '../game/reinforcements';
import { computerElo, type RunState } from '../game/run';

export function RoundScreen({ run, notice, onStart, onMenu }: { run: RunState; notice?: string; onStart: () => void; onMenu: () => void }) {
  const elo = computerElo(run);
  const count = run.reinforcements.reduce((a, r) => a + r.stacks, 0);
  return (
    <div className="round screen-enter">
      <p className="eyebrow">Chess Ascension</p>
      <h1 className="round__title" data-round={run.round}>
        Round {run.round}
      </h1>
      {notice ? <p className="round__notice">{notice}</p> : null}
      <div className="versus">
        <div className="versus__side versus__side--you">
          <span className="versus__label">You</span>
          <span className="versus__elo">{run.playerElo} ELO</span>
          <span className="versus__sub">
            {count} Reinforcement{count === 1 ? '' : 's'}
          </span>
          <div className="icon-row icon-row--center">
            {run.reinforcements.map((r) => {
              const def = REINFORCEMENT_BY_ID[r.id];
              return def ? (
                <span key={r.id} className="icon-row__item" title={def.name}>
                  <ReinforcementIcon def={def} size="sm" />
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div className="versus__vs" aria-hidden="true">
          VS
        </div>
        <div className="versus__side versus__side--ai">
          <span className="versus__label">Computer</span>
          <span className="versus__elo" data-computer-elo={elo}>
            {elo} ELO
          </span>
          <span className={`tier tier--${tierForElo(elo).toLowerCase()}`}>{tierForElo(elo)}</span>
        </div>
      </div>
      <div className="round__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={onStart} autoFocus>
          Start Game
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMenu}>
          Menu
        </button>
      </div>
    </div>
  );
}
