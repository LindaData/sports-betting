import { DIRECTIONS, distanceMap, findPath, key, manhattan, step, inBounds } from './grid';
import { playerReachable, portalCells } from './portals';
import type { Rng } from './random';
import { GRID_SIZE, type Coin, type Enemy, type Level, type Point, type Portal } from './types';

export const START: Point = { x: 0, y: GRID_SIZE - 1 };

export interface Difficulty {
  walls: number;
  enemies: number;
  coins: number;
  enemyStepMs: number;
  chaseChance: number;
  portalPairs: number;
}

/** Difficulty curve: every stat ramps gently and then plateaus at a fair ceiling. */
export function difficultyFor(levelNumber: number): Difficulty {
  const n = Math.max(1, levelNumber) - 1;
  return {
    walls: Math.min(10 + n * 3, 34),
    enemies: Math.min(1 + Math.floor((n + 1) / 2), 6),
    coins: Math.min(4 + n, 12),
    enemyStepMs: Math.max(300, 850 - n * 55),
    chaseChance: Math.min(0.75, 0.2 + n * 0.06),
    // Levels 1–2 teach the basics; warps arrive at level 3, 6 and 10.
    portalPairs: levelNumber >= 10 ? 3 : levelNumber >= 6 ? 2 : levelNumber >= 3 ? 1 : 0,
  };
}

/** Goal lives in the top-right 3×3 corner. */
function goalCandidates(): Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = GRID_SIZE - 3; x < GRID_SIZE; x++) cells.push({ x, y });
  }
  return cells;
}

/** Cells next to the start stay open so the player is never boxed in on spawn. */
function startSafeZone(): Set<string> {
  const safe = new Set<string>();
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (manhattan({ x, y }, START) <= 1) safe.add(key({ x, y }));
    }
  }
  return safe;
}

/**
 * Walls are laid as short segments (1–3 cells) so boards read as corridors
 * rather than noise.
 */
function placeWalls(rng: Rng, count: number, reserved: Set<string>): Set<string> {
  const walls = new Set<string>();
  let guard = 0;
  while (walls.size < count && guard++ < 500) {
    let cursor: Point = { x: rng.int(GRID_SIZE), y: rng.int(GRID_SIZE) };
    const dir = rng.pick(DIRECTIONS);
    const length = 1 + rng.int(3);
    for (let i = 0; i < length && walls.size < count; i++) {
      const k = key(cursor);
      if (!inBounds(cursor) || reserved.has(k)) break;
      walls.add(k);
      cursor = step(cursor, dir);
    }
  }
  return walls;
}

const MIN_PORTAL_SPAN = 5;

/**
 * Pick endpoints for each warp pair. The two ends of a pair sit far apart so
 * each warp is a real shortcut, and no endpoint touches another portal.
 */
function placePortals(rng: Rng, pairs: number, candidates: Point[]): Portal[] {
  const pool = rng.shuffle([...candidates]);
  const used: Point[] = [];
  const clear = (p: Point) => used.every((u) => manhattan(u, p) >= 2);
  const portals: Portal[] = [];
  for (let id = 1; id <= pairs; id++) {
    const a = pool.find(clear);
    if (!a) break;
    used.push(a);
    const b = pool.find((p) => clear(p) && manhattan(a, p) >= MIN_PORTAL_SPAN);
    if (!b) break;
    used.push(b);
    portals.push({ id, a, b });
  }
  return portals;
}

function parseKey(k: string): Point {
  const [x, y] = k.split(',').map(Number);
  return { x: x as number, y: y as number };
}

export function generateLevel(levelNumber: number, rng: Rng): Level {
  const diff = difficultyFor(levelNumber);
  const safe = startSafeZone();

  for (let attempt = 0; attempt < 300; attempt++) {
    const goal = rng.pick(goalCandidates());
    const reserved = new Set([...safe, key(goal)]);
    // Relax wall density if the dice keep producing blocked boards.
    const wallCount = Math.max(0, diff.walls - Math.floor(attempt / 25) * 2);
    const walls = placeWalls(rng, wallCount, reserved);

    const path = findPath(START, goal, walls);
    if (!path) continue;

    const reachable = distanceMap(START, walls);
    const open = [...reachable.keys()]
      .filter((k) => k !== key(START) && k !== key(goal))
      .map(parseKey);

    const portals = placePortals(
      rng,
      diff.portalPairs,
      open.filter((p) => manhattan(p, START) >= 3 && manhattan(p, goal) >= 2),
    );
    if (portals.length < diff.portalPairs) continue;

    // Portals can cut corridors (you can't walk *through* a portal cell), so
    // re-check solvability with warp-following movement.
    const standable = playerReachable(START, walls, portals);
    if (!standable.has(key(goal))) continue;
    const warpCells = portalCells(portals);
    const itemCells = open.filter((p) => standable.has(key(p)) && !warpCells.has(key(p)));

    // Coins go on reachable cells, preferring a spread across the board.
    const coinCells = rng.shuffle(itemCells.filter((p) => manhattan(p, START) >= 2)).slice(0, diff.coins);
    if (coinCells.length < Math.min(diff.coins, 3)) continue;
    const coinKeys = new Set(coinCells.map(key));

    const enemyCells = rng
      .shuffle(itemCells.filter((p) => manhattan(p, START) >= 6 && !coinKeys.has(key(p))))
      .slice(0, diff.enemies);
    if (enemyCells.length < diff.enemies) continue;

    const coins: Coin[] = coinCells.map((p, i) => ({ ...p, id: i + 1 }));
    const enemies: Enemy[] = enemyCells.map((p, i) => ({
      ...p,
      id: i + 1,
      heading: rng.pick(DIRECTIONS),
    }));

    const pathLength = path.length - 1;
    return {
      number: levelNumber,
      walls: [...walls].map(parseKey),
      coins,
      enemies,
      portals,
      start: { ...START },
      goal,
      enemyStepMs: diff.enemyStepMs,
      chaseChance: diff.chaseChance,
      parSeconds: Math.ceil(8 + pathLength * 0.6 + diff.coins * 1.5),
    };
  }

  // Unreachable in practice: an empty board is always solvable.
  const goal = { x: GRID_SIZE - 1, y: 0 };
  return {
    number: levelNumber,
    walls: [],
    coins: [],
    enemies: [],
    portals: [],
    start: { ...START },
    goal,
    enemyStepMs: diff.enemyStepMs,
    chaseChance: diff.chaseChance,
    parSeconds: 20,
  };
}
