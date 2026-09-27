import { REINFORCEMENT_BY_ID } from '../game/reinforcements';
import type { Stats } from '../game/storage';
import { ReinforcementIcon } from './ReinforcementIcon';

export function RunStats({ stats }: { stats: Stats }) {
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  const items: [string, string | number][] = [
    ['Games', stats.games],
    ['Wins', stats.wins],
    ['Win rate', `${winRate}%`],
    ['Runs', stats.runs],
    ['Best Round', stats.bestRound || '—'],
    ['Highest ELO beaten', stats.highestElo || '—'],
  ];
  return (
    <section className="panel stats" aria-label="Statistics">
      <h2 className="panel__title">Statistics</h2>
      <dl className="stats__grid">
        {items.map(([k, v]) => (
          <div key={k} className="stats__item">
            <dt>{k}</dt>
            <dd data-stat={k}>{v}</dd>
          </div>
        ))}
      </dl>
      {stats.bestRun ? (
        <div className="stats__best">
          <h3 className="stats__besttitle">
            Best run · Round {stats.bestRun.round} · {stats.bestRun.computerElo} ELO
          </h3>
          <div className="icon-row">
            {stats.bestRun.reinforcements.map((r) => {
              const def = REINFORCEMENT_BY_ID[r.id];
              return def ? (
                <span key={r.id} className="icon-row__item" title={`${def.name}${r.stacks > 1 ? ` ×${r.stacks}` : ''}`}>
                  <ReinforcementIcon def={def} size="sm" />
                </span>
              ) : null;
            })}
            {stats.bestRun.reinforcements.length === 0 ? <span className="muted small">No reinforcements collected.</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
