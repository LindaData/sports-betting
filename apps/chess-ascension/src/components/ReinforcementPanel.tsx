import { useState } from 'react';
import { REINFORCEMENT_BY_ID, RARITY_LABEL, type OwnedReinforcement } from '../game/reinforcements';
import { ReinforcementIcon } from './ReinforcementIcon';

export function ReinforcementPanel({ owned, title = 'Your Reinforcements' }: { owned: OwnedReinforcement[]; title?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="panel rpanel" aria-label={title}>
      <h2 className="panel__title">{title}</h2>
      {owned.length === 0 ? (
        <p className="muted small">None yet. Win a round to choose your first Reinforcement.</p>
      ) : (
        <ul className="rpanel__list">
          {owned.map((o) => {
            const def = REINFORCEMENT_BY_ID[o.id];
            if (!def) return null;
            const isOpen = open === o.id;
            return (
              <li key={o.id} className={`rpanel__item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="rpanel__row"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : o.id)}
                >
                  <ReinforcementIcon def={def} size="sm" />
                  <span className="rpanel__name">{def.name}</span>
                  {o.stacks > 1 ? <span className="rpanel__stacks">×{o.stacks}</span> : null}
                  <span className={`dot dot--${def.rarity}`} title={RARITY_LABEL[def.rarity]} />
                </button>
                {isOpen ? (
                  <div className="rpanel__desc">
                    <p>{def.description}</p>
                    <p className="muted">{def.impact}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
