import { DIRECTION_VECTORS, GRID_SIZE, type Direction, type Point } from './types';

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export const key = (p: Point): string => `${p.x},${p.y}`;

export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export const inBounds = (p: Point): boolean =>
  p.x >= 0 && p.y >= 0 && p.x < GRID_SIZE && p.y < GRID_SIZE;

export const step = (p: Point, dir: Direction): Point => {
  const v = DIRECTION_VECTORS[dir];
  return { x: p.x + v.x, y: p.y + v.y };
};

export const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const opposite = (dir: Direction): Direction =>
  dir === 'up' ? 'down' : dir === 'down' ? 'up' : dir === 'left' ? 'right' : 'left';

/**
 * Breadth-first search over open cells. Returns distance from `from` to every
 * reachable cell, keyed by `key()`.
 */
export function distanceMap(from: Point, blocked: Set<string>): Map<string, number> {
  const dist = new Map<string, number>([[key(from), 0]]);
  const queue: Point[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head] as Point;
    const d = dist.get(key(current)) as number;
    for (const dir of DIRECTIONS) {
      const n = step(current, dir);
      const k = key(n);
      if (!inBounds(n) || blocked.has(k) || dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Shortest path (inclusive of both ends), or null when unreachable. */
export function findPath(from: Point, to: Point, blocked: Set<string>): Point[] | null {
  if (blocked.has(key(to))) return null;
  const dist = distanceMap(to, blocked);
  if (!dist.has(key(from))) return null;
  const path: Point[] = [from];
  let current = from;
  while (!samePoint(current, to)) {
    const d = dist.get(key(current)) as number;
    const nextCell = DIRECTIONS.map((dir) => step(current, dir)).find(
      (n) => dist.get(key(n)) === d - 1,
    );
    if (!nextCell) return null;
    path.push(nextCell);
    current = nextCell;
  }
  return path;
}
