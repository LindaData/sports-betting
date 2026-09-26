import { useEffect, useRef } from 'react';
import type { Direction } from '../game/types';

export interface KeyboardHandlers {
  onMove: (direction: Direction) => void;
  onPrimary: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
}

const MOVE_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

export function useKeyboard(handlers: KeyboardHandlers): void {
  // Keep the latest handlers without re-binding the listener every render.
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const h = ref.current;

      const direction = MOVE_KEYS[k];
      if (direction) {
        event.preventDefault();
        h.onMove(direction);
        return;
      }
      if (event.repeat) return;
      switch (k) {
        case 'Enter':
        case ' ':
          // Let focused buttons handle their own activation.
          if (document.activeElement instanceof HTMLButtonElement) return;
          event.preventDefault();
          h.onPrimary();
          break;
        case 'p':
        case 'Escape':
          event.preventDefault();
          h.onTogglePause();
          break;
        case 'r':
          h.onRestart();
          break;
        case 'm':
          h.onToggleMute();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
