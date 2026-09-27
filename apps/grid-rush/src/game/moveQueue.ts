import type { Direction } from './types';

/** Minimum time between two executed steps. */
export const MOVE_INTERVAL_MS = 70;
/** Taps beyond this many pending moves are ignored so the player never runs away from the input. */
export const MAX_BUFFERED_MOVES = 3;

/**
 * Input buffer for player movement. Every deliberate press is kept (up to a
 * small cap) and released at a steady pace, so quick taps chain cleanly
 * instead of being dropped. Auto-repeat from a held key or held pad button
 * only tops up an empty buffer, which means the runner stops the moment the
 * key is released rather than coasting through stale repeats.
 */
export class MoveQueue {
  private pending: Direction[] = [];
  private lastStepAt = -Infinity;

  push(direction: Direction, isRepeat = false): void {
    if (isRepeat && this.pending.length > 0) return;
    if (this.pending.length >= MAX_BUFFERED_MOVES) return;
    this.pending.push(direction);
  }

  /** Milliseconds until the next move may run; 0 when one is ready now, Infinity when empty. */
  waitMs(now: number): number {
    if (this.pending.length === 0) return Infinity;
    return Math.max(0, this.lastStepAt + MOVE_INTERVAL_MS - now);
  }

  /** Remove and return the next move if its turn has come. */
  take(now: number): Direction | null {
    if (this.waitMs(now) !== 0) return null;
    this.lastStepAt = now;
    return this.pending.shift() ?? null;
  }

  clear(): void {
    this.pending = [];
  }

  get size(): number {
    return this.pending.length;
  }
}
