import { describe, expect, it } from 'vitest';
import { MAX_BUFFERED_MOVES, MOVE_INTERVAL_MS, MoveQueue } from './moveQueue';

describe('move queue', () => {
  it('runs the first press immediately', () => {
    const q = new MoveQueue();
    q.push('up');
    expect(q.take(1000)).toBe('up');
  });

  it('keeps quick taps instead of dropping them, releasing one per interval', () => {
    const q = new MoveQueue();
    q.push('up');
    q.push('right');
    q.push('right');
    expect(q.take(0)).toBe('up');
    expect(q.take(10)).toBeNull(); // too soon
    expect(q.waitMs(10)).toBe(MOVE_INTERVAL_MS - 10);
    expect(q.take(MOVE_INTERVAL_MS)).toBe('right');
    expect(q.take(MOVE_INTERVAL_MS * 2)).toBe('right');
    expect(q.waitMs(MOVE_INTERVAL_MS * 3)).toBe(Infinity);
  });

  it('caps the buffer so mashing never queues a long run', () => {
    const q = new MoveQueue();
    for (let i = 0; i < 10; i++) q.push('left');
    expect(q.size).toBe(MAX_BUFFERED_MOVES);
  });

  it('ignores key-repeat while moves are pending so the runner stops on release', () => {
    const q = new MoveQueue();
    q.push('down');
    q.push('down', true);
    q.push('down', true);
    expect(q.size).toBe(1);
    q.take(0);
    q.push('down', true);
    expect(q.size).toBe(1);
  });

  it('clear drops everything pending', () => {
    const q = new MoveQueue();
    q.push('up');
    q.push('up');
    q.clear();
    expect(q.take(10_000)).toBeNull();
  });
});
