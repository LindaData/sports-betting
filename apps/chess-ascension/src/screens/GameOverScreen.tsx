import { ReinforcementCard } from '../components/ReinforcementCard';
import { REINFORCEMENT_BY_ID } from '../game/reinforcements';
import type { RunState } from '../game/run';
import type { Stats } from '../game/storage';

export function GameOverScreen({ run, stats, onNewRun, onMenu }: { run: RunState; stats: Stats; onNewRun: () => void; onMenu: () => void }) {
  const collected = run.reinforcements.reduce((a, r) => a + r.stacks, 0);
  const isBest = stats.bestRun?.round === run.round && run.round >= (stats.bestRound || 0);
  return (
    <div className="over screen-enter">
      <h1 className="over__title">Run Over</h1>
      {isBest && run.round > 1 ? <p className="over__best">New best run!</p> : null}
      <dl className="over__facts">
        <div>
          <dt>Round</dt>
          <dd data-over-round={run.round}>{run.round}</dd>
        </div>
        <div>
          <dt>Computer</dt>
          <dd>{run.finalElo} ELO</dd>
        </div>
        <div>
          <dt>Reinforcements collected</dt>
          <dd>{collected}</dd>
        </div>
        <div>
          <dt>Your rating</dt>
          <dd>{run.playerElo}</dd>
        </div>
      </dl>
      {run.endReason ? <p className="muted">Fell to {run.endReason.toLowerCase()}.</p> : null}
      {run.reinforcements.length ? (
        <div className="over__cards">
          {run.reinforcements.map((o) => {
            const def = REINFORCEMENT_BY_ID[o.id];
            return def ? (
              <div key={o.id} className="over__card">
                <ReinforcementCard def={def} />
                {o.stacks > 1 ? <span className="over__stack">×{o.stacks}</span> : null}
              </div>
            ) : null;
          })}
        </div>
      ) : (
        <p className="muted">No Reinforcements collected this time.</p>
      )}
      <div className="over__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={onNewRun} autoFocus>
          Start New Run
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMenu}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
