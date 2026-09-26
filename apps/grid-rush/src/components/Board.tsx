import type { CSSProperties, ReactNode } from 'react';
import { GRID_SIZE, type GameState, type Point } from '../game/types';

const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);

function place(p: Point): CSSProperties {
  return { transform: `translate(${p.x * 100}%, ${p.y * 100}%)` };
}

function Sprite({ at, className, children }: { at: Point; className: string; children?: ReactNode }) {
  return (
    <div className={`sprite ${className}`} style={place(at)}>
      {children}
    </div>
  );
}

function EnemyShape() {
  return (
    <svg viewBox="0 0 40 40" className="enemy-svg" aria-hidden="true">
      <path
        d="M20 4 L25 11 L34 9 L31 18 L37 24 L28 27 L27 36 L20 31 L13 36 L12 27 L3 24 L9 18 L6 9 L15 11 Z"
        className="enemy-body"
      />
      <circle cx="15.5" cy="20" r="3.4" className="enemy-eye" />
      <circle cx="24.5" cy="20" r="3.4" className="enemy-eye" />
      <circle cx="16.2" cy="20.6" r="1.5" className="enemy-pupil" />
      <circle cx="25.2" cy="20.6" r="1.5" className="enemy-pupil" />
    </svg>
  );
}

interface BoardProps {
  state: GameState;
  children?: ReactNode;
}

export function Board({ state, children }: BoardProps) {
  const { level, player } = state;
  const shielded = state.invulnerableMs > 0;
  const classes = ['board'];
  if (state.hitFlashMs > 0) classes.push('board--hit');
  if (state.phase === 'paused') classes.push('board--paused');

  return (
    <div
      className={classes.join(' ')}
      role="region"
      aria-label={`Level ${level.number} board. Player at column ${player.x + 1}, row ${player.y + 1}.`}
    >
      <div className="board__cells" aria-hidden="true">
        {CELLS.map((i) => (
          <div key={i} className={(Math.floor(i / GRID_SIZE) + i) % 2 ? 'cell cell--alt' : 'cell'} />
        ))}
      </div>

      <div className="board__layer" aria-hidden="true">
        {level.walls.map((w) => (
          <Sprite key={`w${level.number}-${w.x},${w.y}`} at={w} className="wall" />
        ))}
        <Sprite at={level.start} className="start-pad" />
        <Sprite at={level.goal} className="goal">
          <span className="goal__ring" />
          <span className="goal__core" />
        </Sprite>
        {level.coins.map((c) => (
          <Sprite key={`c${level.number}-${c.id}`} at={c} className="coin">
            <span className="coin__face" />
          </Sprite>
        ))}
        {level.enemies.map((e) => (
          <Sprite key={`e${level.number}-${e.id}`} at={e} className="enemy">
            <EnemyShape />
          </Sprite>
        ))}
        <Sprite
          key={`p${level.number}-${state.lives}`}
          at={player}
          className={`player${shielded ? ' player--shielded' : ''}`}
        >
          <span className="player__core" />
        </Sprite>
        {state.popups.map((p) => (
          <Sprite key={`pop${p.id}`} at={p} className={`popup popup--${p.tone}`}>
            <span>{p.text}</span>
          </Sprite>
        ))}
      </div>

      {children}
    </div>
  );
}
