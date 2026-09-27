import { useState } from 'react';
import { ReinforcementCard } from '../components/ReinforcementCard';
import { REINFORCEMENT_BY_ID } from '../game/reinforcements';
import { computerElo, type RunState } from '../game/run';

export function RewardScreen({ run, onChoose }: { run: RunState; onChoose: (id: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="reward screen-enter">
      <p className="eyebrow">Round {run.round} complete</p>
      <h1 className="reward__title">Victory</h1>
      <p className="reward__sub">
        You beat a {computerElo(run)} ELO opponent. Choose 1 of 3 Reinforcements — it lasts for the rest of the run.
      </p>
      <div className="reward__cards">
        {run.offers.map((id, i) => {
          const def = REINFORCEMENT_BY_ID[id];
          if (!def) return null;
          const owned = run.reinforcements.find((o) => o.id === id)?.stacks ?? 0;
          return <ReinforcementCard key={id} def={def} ownedStacks={owned} selected={picked === id} onSelect={() => setPicked(id)} index={i} />;
        })}
      </div>
      <button type="button" className="btn btn--primary btn--lg" disabled={!picked} onClick={() => picked && onChoose(picked)}>
        {picked ? `Take ${REINFORCEMENT_BY_ID[picked].name} & Continue` : 'Select a Reinforcement'}
      </button>
    </div>
  );
}
