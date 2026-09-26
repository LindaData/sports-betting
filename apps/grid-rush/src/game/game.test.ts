import { describe, expect, it } from 'vitest';
import { moveEnemies } from './enemies';
import {
  POINTS_COIN,
  POINTS_GOAL,
  STARTING_LIVES,
  createInitialState,
  gameReducer,
  speedBonus,
  type GameAction,
} from './engine';
import { distanceMap, findPath, key, manhattan, samePoint } from './grid';
import { START, difficultyFor, generateLevel } from './level';
import { createRng } from './random';
import { GRID_SIZE, type Direction, type GameState, type Point } from './types';

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

function playing(seed = 42): GameState {
  return run(createInitialState(seed, 0), { type: 'START', seed });
}

/** Replace the level with a hand-built board for precise scenarios. */
function withBoard(state: GameState, patch: Partial<GameState['level']>): GameState {
  return { ...state, level: { ...state.level, walls: [], coins: [], enemies: [], ...patch } };
}

function directionTo(from: Point, to: Point): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  return 'up';
}

describe('level generation', () => {
  it('always yields a solvable board across many seeds and levels', () => {
    for (let levelNumber = 1; levelNumber <= 30; levelNumber++) {
      for (let seed = 0; seed < 60; seed++) {
        const level = generateLevel(levelNumber, createRng(seed * 7919 + levelNumber));
        const walls = new Set(level.walls.map(key));
        expect(samePoint(level.start, START)).toBe(true);
        // Never falls back to the empty emergency board.
        expect(level.enemies).toHaveLength(difficultyFor(levelNumber).enemies);
        expect(level.coins.length).toBeGreaterThanOrEqual(3);
        expect(level.goal.x).toBeGreaterThanOrEqual(GRID_SIZE - 3);
        expect(level.goal.y).toBeLessThanOrEqual(2);
        expect(walls.has(key(level.goal))).toBe(false);
        expect(findPath(level.start, level.goal, walls)).not.toBeNull();

        const reachable = distanceMap(level.start, walls);
        for (const coin of level.coins) expect(reachable.has(key(coin))).toBe(true);
        for (const enemy of level.enemies) {
          expect(walls.has(key(enemy))).toBe(false);
          expect(manhattan(enemy, level.start)).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it('ramps difficulty up with the level number', () => {
    const l1 = difficultyFor(1);
    const l8 = difficultyFor(8);
    expect(l8.walls).toBeGreaterThan(l1.walls);
    expect(l8.enemies).toBeGreaterThan(l1.enemies);
    expect(l8.coins).toBeGreaterThan(l1.coins);
    expect(l8.enemyStepMs).toBeLessThan(l1.enemyStepMs);
    expect(l8.chaseChance).toBeGreaterThan(l1.chaseChance);
    // Plateaus keep late levels fair.
    expect(difficultyFor(500).enemies).toBeLessThanOrEqual(6);
    expect(difficultyFor(500).enemyStepMs).toBeGreaterThanOrEqual(300);
  });

  it('is deterministic for a given seed', () => {
    expect(generateLevel(3, createRng(99))).toEqual(generateLevel(3, createRng(99)));
  });
});

describe('player movement', () => {
  it('moves one square and respects walls and edges', () => {
    let s = withBoard(playing(), { walls: [{ x: 1, y: GRID_SIZE - 1 }] });
    s = run(s, { type: 'MOVE', direction: 'left' });
    expect(s.player).toEqual(START); // edge
    s = run(s, { type: 'MOVE', direction: 'right' });
    expect(s.player).toEqual(START); // wall
    s = run(s, { type: 'MOVE', direction: 'up' });
    expect(s.player).toEqual({ x: 0, y: GRID_SIZE - 2 });
  });

  it('ignores input unless playing', () => {
    const menu = createInitialState(1, 0);
    expect(run(menu, { type: 'MOVE', direction: 'up' }).player).toEqual(menu.player);
    const paused = run(playing(), { type: 'PAUSE' });
    expect(run(paused, { type: 'MOVE', direction: 'up' }).player).toEqual(paused.player);
  });
});

describe('scoring', () => {
  it('awards coin points and removes the coin', () => {
    let s = withBoard(playing(), { coins: [{ id: 1, x: 0, y: GRID_SIZE - 2 }] });
    s = run(s, { type: 'MOVE', direction: 'up' });
    expect(s.score).toBe(POINTS_COIN);
    expect(s.level.coins).toHaveLength(0);
    expect(s.coinsCollected).toBe(1);
    expect(s.sounds.at(-1)?.kind).toBe('coin');
  });

  it('completes the level with goal points and a speed bonus', () => {
    let s = withBoard(playing(), { goal: { x: 1, y: GRID_SIZE - 1 }, parSeconds: 10 });
    s = run(s, { type: 'TICK', dtMs: 200 }, { type: 'MOVE', direction: 'right' });
    expect(s.phase).toBe('levelComplete');
    const bonus = speedBonus(0.2, 10);
    expect(bonus).toBeGreaterThan(0);
    expect(s.score).toBe(POINTS_GOAL + bonus);
    expect(s.lastSummary?.speedBonus).toBe(bonus);
    expect(s.sounds.at(-1)?.kind).toBe('level');
  });

  it('pays no speed bonus past par', () => {
    expect(speedBonus(30, 20)).toBe(0);
  });

  it('advances to a harder level', () => {
    let s = withBoard(playing(), { goal: { x: 1, y: GRID_SIZE - 1 } });
    s = run(s, { type: 'MOVE', direction: 'right' }, { type: 'NEXT_LEVEL' });
    expect(s.phase).toBe('playing');
    expect(s.level.number).toBe(2);
    expect(s.player).toEqual(START);
    expect(s.levelElapsedMs).toBe(0);
  });
});

describe('enemies and lives', () => {
  it('costs a life when the player steps onto an enemy, then respawns shielded', () => {
    let s = withBoard(playing(), {
      enemies: [{ id: 1, x: 0, y: GRID_SIZE - 2, heading: 'up' }],
      enemyStepMs: 100000,
    });
    s = run(s, { type: 'MOVE', direction: 'up' });
    expect(s.lives).toBe(STARTING_LIVES - 1);
    expect(s.player).toEqual(START);
    expect(s.invulnerableMs).toBeGreaterThan(0);
    expect(s.sounds.at(-1)?.kind).toBe('hit');
  });

  it('ends the game when the last life is lost and records the high score', () => {
    let s = withBoard(
      { ...playing(), lives: 1, score: 500, highScore: 200 },
      { enemies: [{ id: 1, x: 0, y: GRID_SIZE - 2, heading: 'up' }], enemyStepMs: 100000 },
    );
    s = run(s, { type: 'MOVE', direction: 'up' });
    expect(s.phase).toBe('gameOver');
    expect(s.isNewHighScore).toBe(true);
    expect(s.highScore).toBe(500);
    expect(s.sounds.at(-1)?.kind).toBe('gameOver');
  });

  it('enemies advance on the clock and can catch the player', () => {
    // A single hunter that always chases, one step away from the player.
    let s = withBoard(playing(), {
      enemies: [{ id: 1, x: 2, y: 5, heading: 'left' }],
      chaseChance: 1,
      enemyStepMs: 100,
    });
    s = { ...s, player: { x: 1, y: 5 } };
    s = run(s, { type: 'TICK', dtMs: 99 });
    expect(s.level.enemies[0]).toMatchObject({ x: 2, y: 5 });
    s = run(s, { type: 'TICK', dtMs: 1 });
    expect(s.lives).toBe(STARTING_LIVES - 1);
  });

  it('enemies never walk into walls, the goal, the start, or each other', () => {
    const rng = createRng(7);
    let level = generateLevel(12, rng);
    const blocked = new Set([...level.walls.map(key), key(level.goal), key(level.start)]);
    for (let i = 0; i < 400; i++) {
      const enemies = moveEnemies(level, level.enemies, { x: 5, y: 5 }, rng);
      const cells = enemies.map(key);
      expect(new Set(cells).size).toBe(cells.length);
      enemies.forEach((e, idx) => {
        expect(blocked.has(key(e))).toBe(false);
        expect(manhattan(e, level.enemies[idx] as Point)).toBeLessThanOrEqual(1);
      });
      level = { ...level, enemies };
    }
  });

  it('shield prevents repeated hits while respawning', () => {
    let s = withBoard(playing(), {
      enemies: [{ id: 1, x: 0, y: GRID_SIZE - 2, heading: 'up' }],
      enemyStepMs: 100000,
    });
    s = run(s, { type: 'MOVE', direction: 'up' }); // hit, respawn
    s = run(s, { type: 'MOVE', direction: 'up' }); // onto enemy again while shielded
    expect(s.lives).toBe(STARTING_LIVES - 1);
  });
});

describe('game flow', () => {
  it('pause freezes time and resume continues', () => {
    let s = run(playing(), { type: 'TICK', dtMs: 100 }, { type: 'PAUSE' }, { type: 'TICK', dtMs: 100 });
    expect(s.phase).toBe('paused');
    expect(s.levelElapsedMs).toBe(100);
    s = run(s, { type: 'RESUME' }, { type: 'TICK', dtMs: 100 });
    expect(s.levelElapsedMs).toBe(200);
  });

  it('restart resets the run but banks the best score', () => {
    const s = run({ ...playing(), score: 900, highScore: 100, lives: 1 }, { type: 'START', seed: 5 });
    expect(s.phase).toBe('playing');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(STARTING_LIVES);
    expect(s.level.number).toBe(1);
    expect(s.highScore).toBe(900);
  });

  it('a bot following the shortest path clears several levels', () => {
    let s = playing(2024);
    // Freeze enemies out of the way to test the full clear -> next level loop.
    for (let level = 1; level <= 5; level++) {
      s = { ...s, level: { ...s.level, enemies: [] } };
      const path = findPath(s.player, s.level.goal, new Set(s.level.walls.map(key)));
      expect(path).not.toBeNull();
      for (let i = 1; i < (path as Point[]).length; i++) {
        s = run(s, { type: 'MOVE', direction: directionTo(s.player, (path as Point[])[i] as Point) });
      }
      expect(s.phase).toBe('levelComplete');
      expect(s.level.number).toBe(level);
      s = run(s, { type: 'NEXT_LEVEL' });
    }
    expect(s.level.number).toBe(6);
    expect(s.score).toBeGreaterThanOrEqual(5 * POINTS_GOAL);
  });
});
