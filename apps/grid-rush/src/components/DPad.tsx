import { useEffect, useRef, type PointerEvent } from 'react';
import type { Direction } from '../game/types';

const REPEAT_DELAY_MS = 260;
const REPEAT_INTERVAL_MS = 140;

const ARROWS: Record<Direction, string> = {
  up: 'M12 6 L19 16 H5 Z',
  down: 'M12 18 L5 8 H19 Z',
  left: 'M6 12 L16 5 V19 Z',
  right: 'M18 12 L8 19 V5 Z',
};

interface DPadProps {
  onMove: (direction: Direction) => void;
  disabled?: boolean;
}

/** On-screen controls: tap to step, hold to keep moving. */
export function DPad({ onMove, disabled }: DPadProps) {
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  });

  const stop = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  };

  useEffect(() => stop, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  const press = (direction: Direction) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (disabled) return;
    stop();
    onMoveRef.current(direction);
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => onMoveRef.current(direction), REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  const button = (direction: Direction) => (
    <button
      type="button"
      className={`dpad__btn dpad__btn--${direction}`}
      aria-label={`Move ${direction}`}
      disabled={disabled}
      onPointerDown={press(direction)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // Keyboard users activating the focused pad button.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!disabled) onMoveRef.current(direction);
        }
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={ARROWS[direction]} />
      </svg>
    </button>
  );

  return (
    <div className="dpad" role="group" aria-label="Direction controls">
      {button('up')}
      {button('left')}
      <span className="dpad__hub" aria-hidden="true" />
      {button('right')}
      {button('down')}
    </div>
  );
}
