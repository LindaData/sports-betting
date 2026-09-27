import { RARITY_LABEL, type Reinforcement } from '../game/reinforcements';
import { ReinforcementIcon } from './ReinforcementIcon';

export interface ReinforcementCardProps {
  def: Reinforcement;
  ownedStacks?: number;
  selected?: boolean;
  onSelect?: () => void;
  index?: number;
}

export function ReinforcementCard({ def, ownedStacks = 0, selected, onSelect, index = 0 }: ReinforcementCardProps) {
  const body = (
    <>
      <div className="card__glow" />
      <div className="card__top">
        <span className={`rarity rarity--${def.rarity}`}>{RARITY_LABEL[def.rarity]}</span>
        <span className="card__kind">{def.kind}</span>
      </div>
      <ReinforcementIcon def={def} size="lg" />
      <h3 className="card__name">{def.name}</h3>
      <p className="card__desc">{def.description}</p>
      <p className="card__impact">{def.impact}</p>
      {def.stackable ? (
        <p className="card__stack">
          {ownedStacks > 0 ? `Owned ×${ownedStacks} → ×${ownedStacks + 1}. ` : 'Stacks. '}
          {def.stackText}
        </p>
      ) : null}
    </>
  );
  if (!onSelect) return <div className={`card card--${def.rarity} card--static`}>{body}</div>;
  return (
    <button
      type="button"
      className={`card card--${def.rarity} ${selected ? 'card--selected' : ''}`}
      style={{ animationDelay: `${index * 90}ms` }}
      onClick={onSelect}
      aria-pressed={selected}
      data-reinforcement={def.id}
    >
      {body}
    </button>
  );
}
