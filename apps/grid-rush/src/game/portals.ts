import { DIRECTIONS, inBounds, key, samePoint, step } from './grid';
import type { Point, Portal } from './types';

/** Where the player ends up after stepping onto `cell`: the twin endpoint, or null if it isn't a portal. */
export function warpExit(portals: readonly Portal[], cell: Point): Point | null {
  for (const portal of portals) {
    if (samePoint(portal.a, cell)) return portal.b;
    if (samePoint(portal.b, cell)) return portal.a;
  }
  return null;
}

export function portalCells(portals: readonly Portal[]): Set<string> {
  return new Set(portals.flatMap((p) => [key(p.a), key(p.b)]));
}

/**
 * Breadth-first search over the cells the player can actually stand on,
 * following warp portals. Stepping into a portal lands you on its twin, so
 * the entry cell itself is only reachable by coming through the other end.
 */
export function playerReachable(
  from: Point,
  walls: Set<string>,
  portals: readonly Portal[],
): Set<string> {
  const seen = new Set([key(from)]);
  const queue: Point[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head] as Point;
    for (const dir of DIRECTIONS) {
      const n = step(current, dir);
      if (!inBounds(n) || walls.has(key(n))) continue;
      const landing = warpExit(portals, n) ?? n;
      const k = key(landing);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(landing);
    }
  }
  return seen;
}
