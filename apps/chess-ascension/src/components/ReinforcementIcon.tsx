import { WHITE } from '../engine/constants';
import type { BadgeKey, Reinforcement } from '../game/reinforcements';
import { ChessPiece } from './ChessPiece';

const BADGES: Record<BadgeKey, string> = {
  bolt: 'M14 2 L5 14 H11 L9 22 L19 9 H13 Z',
  horse: 'M6 21 C6 17 8 15 11 13 L10 11 C8 12 6 12 5 11 L9 5 C10 4 12 3 13 3 L14 1 L15 3 C19 5 20 9 20 13 C20 17 19 19 19 21 Z',
  crown: 'M3 18 L5 7 L9 12 L12 4 L15 12 L19 7 L21 18 Z',
  shield: 'M12 2 L20 5 V11 C20 16 16 20 12 22 C8 20 4 16 4 11 V5 Z',
  twin: 'M4 12 L10 6 V10 H13 V14 H10 V18 Z M20 12 L14 6 V18 Z',
  plus: 'M10 3 H14 V10 H21 V14 H14 V21 H10 V14 H3 V10 H10 Z',
  star: 'M12 2 L14.8 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.2 8.6 Z',
  rewind: 'M12 4 A8 8 0 1 1 4.5 9.5 L2 8 L3 15 L9 12 L6.8 10.7 A5.5 5.5 0 1 0 12 6.5 Z',
  arrow: 'M12 2 L20 11 H15 V14 H9 V11 H4 Z M9 16 H15 V22 H9 Z',
  swap: 'M2 12 L8 6 V10 H16 V6 L22 12 L16 18 V14 H8 V18 Z',
  clock: 'M12 2 A10 10 0 1 1 11.9 2 Z M11 6 V13 L16 16 L17 14.3 L13 12 V6 Z',
  bomb: 'M10 7 A7.5 7.5 0 1 0 14 7.3 V5 H10 Z M15 4 L18 1 M17 5 L21 4',
  jump: 'M3 20 C5 10 10 5 17 5 L15 2 L22 6 L16 10 L17 7 C12 7 8 11 6 20 Z',
};

export function Badge({ badge, size = 24 }: { badge: BadgeKey; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="badge-svg">
      <path d={BADGES[badge]} fill="currentColor" stroke="currentColor" strokeWidth={badge === 'bomb' ? 1.5 : 0} strokeLinejoin="round" />
    </svg>
  );
}

export function ReinforcementIcon({ def, size = 'md' }: { def: Reinforcement; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`r-icon r-icon--${size} r-icon--${def.rarity}`} aria-hidden="true">
      {def.icon.piece ? <ChessPiece type={def.icon.piece} color={WHITE} className="r-icon__piece" /> : null}
      <span className={`r-icon__badge ${def.icon.piece ? '' : 'r-icon__badge--solo'}`}>
        <Badge badge={def.icon.badge} size={def.icon.piece ? 24 : 40} />
      </span>
    </span>
  );
}
