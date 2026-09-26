import { DIRECTIONS, distanceMap, inBounds, key, opposite, step } from './grid';
import type { Rng } from './random';
import type { Direction, Enemy, Level, Point } from './types';

/**
 * Advance every enemy by one step. Enemies never enter walls, the goal, the
 * start square, or each other. Each one either hunts the player (following
 * the BFS gradient) or wanders, depending on the level's chase chance.
 */
export function moveEnemies(level: Level, enemies: Enemy[], player: Point, rng: Rng): Enemy[] {
  const walls = new Set(level.walls.map(key));
  const forbidden = new Set([...walls, key(level.goal), key(level.start)]);
  const towardPlayer = distanceMap(player, walls);
  const occupied = new Set(enemies.map(key));

  return enemies.map((enemy) => {
    occupied.delete(key(enemy));
    const options = DIRECTIONS.map((dir) => ({ dir, cell: step(enemy, dir) })).filter(
      ({ cell }) => inBounds(cell) && !forbidden.has(key(cell)) && !occupied.has(key(cell)),
    );

    let choice: { dir: Direction; cell: Point } | undefined;
    if (options.length > 0) {
      if (rng.next() < level.chaseChance) {
        const here = towardPlayer.get(key(enemy)) ?? Infinity;
        const best = options
          .map((o) => ({ ...o, d: towardPlayer.get(key(o.cell)) ?? Infinity }))
          .filter((o) => o.d < here)
          .sort((a, b) => a.d - b.d);
        choice = best[0];
      }
      if (!choice) {
        const ahead = options.find((o) => o.dir === enemy.heading);
        const forward = options.filter((o) => o.dir !== opposite(enemy.heading));
        if (ahead && rng.next() < 0.6) choice = ahead;
        else choice = forward.length > 0 ? rng.pick(forward) : rng.pick(options);
      }
    }

    const moved: Enemy = choice
      ? { ...enemy, x: choice.cell.x, y: choice.cell.y, heading: choice.dir }
      : { ...enemy, heading: opposite(enemy.heading) };
    occupied.add(key(moved));
    return moved;
  });
}
