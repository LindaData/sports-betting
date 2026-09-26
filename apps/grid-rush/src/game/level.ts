import { DIRECTIONS, distanceMap, findPath, key, manhattan, step, inBounds } from './grid';
import type { Rng } from './random';
import { GRID_SIZE, type Coin, type Enemy, type Level, type Point } from './types';

export const START: Point = { x: 0, y: GRID_SIZE - 1 };

export interface Difficulty {
  walls: number;
  enemies: number;
  coins: number;
  enemyStepMs: number;
  chaseChance: number;
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

    // Coins go on reachable cells, preferring a spread across the board.
    const coinCells = rng.shuffle(open.filter((p) => manhattan(p, START) >= 2)).slice(0, diff.coins);
    if (coinCells.length < Math.min(diff.coins, 3)) continue;
    const coinKeys = new Set(coinCells.map(key));

    const enemyCells = rng
      .shuffle(open.filter((p) => manhattan(p, START) >= 6 && !coinKeys.has(key(p))))
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
    start: { ...START },
    goal,
    enemyStepMs: diff.enemyStepMs,
    chaseChance: diff.chaseChance,
    parSeconds: 20,
  };
}
