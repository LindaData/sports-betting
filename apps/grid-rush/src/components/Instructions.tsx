import { POINTS_COIN, POINTS_GOAL, STARTING_LIVES } from '../game/engine';

const LEGEND = [
  { swatch: 'player', label: 'You' },
  { swatch: 'coin', label: `Coin +${POINTS_COIN}` },
  { swatch: 'enemy', label: 'Hunter' },
  { swatch: 'wall', label: 'Wall' },
  { swatch: 'goal', label: `Exit +${POINTS_GOAL}` },
  { swatch: 'warp', label: 'Warp' },
];

export function Instructions() {
  return (
    <section className="instructions" aria-label="How to play">
      <ul className="legend">
        {LEGEND.map((item) => (
          <li key={item.swatch}>
            <span className={`swatch swatch--${item.swatch}`} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
      <div className="howto">
        <h3>How to play</h3>
        <ul>
          <li>
            Move with <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>←</kbd>
            <kbd>→</kbd> or <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>. On touch screens, use the pad.
          </li>
          <li>Reach the purple exit in the top-right to clear the level. Beat the par time for a speed bonus.</li>
          <li>
            From level 3, matching warp portals appear. Step into one to pop out of its twin. Hunters can't use
            them, but they can wait at the other end.
          </li>
          <li>
            A hunter touching you costs a life. You have {STARTING_LIVES}, and you get a moment of shield after
            respawning.
          </li>
          <li>Every level adds walls, coins and faster, smarter hunters. There is always a way through.</li>
          <li>
            <kbd>P</kbd>/<kbd>Esc</kbd> pause · <kbd>R</kbd> restart · <kbd>M</kbd> mute · <kbd>Enter</kbd> start or continue
          </li>
        </ul>
      </div>
    </section>
  );
}
