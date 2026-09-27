import { moveEnemies } from './enemies';
import { inBounds, samePoint, step } from './grid';
import { generateLevel } from './level';
import { warpExit } from './portals';
import { createRng } from './random';
import type { Direction, GameState, LevelSummary, Popup, SoundKind } from './types';

export const STARTING_LIVES = 3;
export const POINTS_GOAL = 100;
export const POINTS_COIN = 25;
export const SPEED_BONUS_PER_SECOND = 10;
export const INVULNERABLE_MS = 1600;
export const HIT_FLASH_MS = 450;
const POPUP_MS = 900;
const MAX_SOUND_QUEUE = 12;

export type GameAction =
  | { type: 'START'; seed: number }
  | { type: 'MOVE'; direction: Direction }
  | { type: 'TICK'; dtMs: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'NEXT_LEVEL' };

export function speedBonus(seconds: number, parSeconds: number): number {
  return Math.max(0, Math.round((parSeconds - seconds) * SPEED_BONUS_PER_SECOND));
}

export function createInitialState(seed: number, highScore: number): GameState {
  const rng = createRng(seed);
  const level = generateLevel(1, rng);
  return {
    phase: 'menu',
    seed: rng.seed(),
    level,
    player: { ...level.start },
    score: 0,
    lives: STARTING_LIVES,
    highScore,
    isNewHighScore: false,
    levelElapsedMs: 0,
    enemyClockMs: 0,
    invulnerableMs: 0,
    hitFlashMs: 0,
    coinsCollected: 0,
    warps: 0,
    lastSummary: null,
    sounds: [],
    popups: [],
    nextEventId: 1,
  };
}

function withSound(state: GameState, kind: SoundKind): GameState {
  const sounds = [...state.sounds, { id: state.nextEventId, kind }].slice(-MAX_SOUND_QUEUE);
  return { ...state, sounds, nextEventId: state.nextEventId + 1 };
}

function withPopup(state: GameState, popup: Omit<Popup, 'id' | 'ttlMs'>): GameState {
  return {
    ...state,
    popups: [...state.popups, { ...popup, id: state.nextEventId, ttlMs: POPUP_MS }],
    nextEventId: state.nextEventId + 1,
  };
}

/** Lose a life if an enemy shares the player's square (and the player isn't shielded). */
function resolveCollision(state: GameState): GameState {
  if (state.invulnerableMs > 0) return state;
  if (!state.level.enemies.some((e) => samePoint(e, state.player))) return state;

  const lives = state.lives - 1;
  let next = withPopup(state, { ...state.player, text: '-1 ♥', tone: 'hit' });
  next = { ...next, lives, hitFlashMs: HIT_FLASH_MS };

  if (lives <= 0) {
    const isNewHighScore = next.score > next.highScore;
    next = {
      ...next,
      phase: 'gameOver',
      isNewHighScore,
      highScore: Math.max(next.highScore, next.score),
    };
    return withSound(next, 'gameOver');
  }

  next = { ...next, player: { ...next.level.start }, invulnerableMs: INVULNERABLE_MS };
  return withSound(next, 'hit');
}

function completeLevel(state: GameState): GameState {
  const seconds = state.levelElapsedMs / 1000;
  const bonus = speedBonus(seconds, state.level.parSeconds);
  const coinsTotal = state.coinsCollected + state.level.coins.length;
  const summary: LevelSummary = {
    level: state.level.number,
    seconds,
    coinsCollected: state.coinsCollected,
    coinsTotal,
    goalPoints: POINTS_GOAL,
    coinPoints: state.coinsCollected * POINTS_COIN,
    speedBonus: bonus,
  };
  const next = withPopup(
    { ...state, phase: 'levelComplete', score: state.score + POINTS_GOAL + bonus, lastSummary: summary },
    { ...state.level.goal, text: `+${POINTS_GOAL + bonus}`, tone: 'goal' },
  );
  return withSound(next, 'level');
}

function movePlayer(state: GameState, direction: Direction): GameState {
  const target = step(state.player, direction);
  if (!inBounds(target)) return state;
  if (state.level.walls.some((w) => samePoint(w, target))) return state;

  // Warp portals: step in, come out of the twin. Endpoints never hold coins
  // or the goal, so the only thing left to check is a hunter at the exit.
  const exit = warpExit(state.level.portals, target);
  if (exit) {
    let warped: GameState = { ...state, player: { ...exit }, warps: state.warps + 1 };
    warped = withPopup(warped, { ...target, text: '', tone: 'warp' });
    warped = withPopup(warped, { ...exit, text: '', tone: 'warp' });
    return resolveCollision(withSound(warped, 'warp'));
  }

  let next: GameState = { ...state, player: target };

  const coin = next.level.coins.find((c) => samePoint(c, target));
  if (coin) {
    next = {
      ...next,
      score: next.score + POINTS_COIN,
      coinsCollected: next.coinsCollected + 1,
      level: { ...next.level, coins: next.level.coins.filter((c) => c.id !== coin.id) },
    };
    next = withPopup(next, { ...target, text: `+${POINTS_COIN}`, tone: 'coin' });
    next = withSound(next, 'coin');
  } else {
    next = withSound(next, 'step');
  }

  if (samePoint(target, next.level.goal)) return completeLevel(next);
  return resolveCollision(next);
}

function tick(state: GameState, dtMs: number): GameState {
  // Clamp large gaps (e.g. a backgrounded tab) so enemies don't teleport.
  const dt = Math.min(Math.max(dtMs, 0), 250);
  let next: GameState = {
    ...state,
    levelElapsedMs: state.levelElapsedMs + dt,
    invulnerableMs: Math.max(0, state.invulnerableMs - dt),
    hitFlashMs: Math.max(0, state.hitFlashMs - dt),
    popups: state.popups
      .map((p) => ({ ...p, ttlMs: p.ttlMs - dt }))
      .filter((p) => p.ttlMs > 0),
    enemyClockMs: state.enemyClockMs + dt,
  };

  while (next.phase === 'playing' && next.enemyClockMs >= next.level.enemyStepMs) {
    const rng = createRng(next.seed);
    const enemies = moveEnemies(next.level, next.level.enemies, next.player, rng);
    next = {
      ...next,
      seed: rng.seed(),
      enemyClockMs: next.enemyClockMs - next.level.enemyStepMs,
      level: { ...next.level, enemies },
    };
    next = resolveCollision(next);
  }
  return next;
}

function startLevel(state: GameState, levelNumber: number): GameState {
  const rng = createRng(state.seed);
  const level = generateLevel(levelNumber, rng);
  return {
    ...state,
    phase: 'playing',
    seed: rng.seed(),
    level,
    player: { ...level.start },
    levelElapsedMs: 0,
    enemyClockMs: 0,
    invulnerableMs: 0,
    hitFlashMs: 0,
    coinsCollected: 0,
    popups: [],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START': {
      // Starting over mid-run still banks a new best score.
      const highScore = Math.max(state.highScore, state.score);
      const fresh = createInitialState(action.seed, highScore);
      return withSound(
        {
          ...fresh,
          phase: 'playing',
          sounds: state.sounds,
          nextEventId: state.nextEventId,
        },
        'start',
      );
    }
    case 'MOVE':
      return state.phase === 'playing' ? movePlayer(state, action.direction) : state;
    case 'TICK':
      return state.phase === 'playing' ? tick(state, action.dtMs) : state;
    case 'PAUSE':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state;
    case 'RESUME':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state;
    case 'NEXT_LEVEL':
      return state.phase === 'levelComplete' ? startLevel(state, state.level.number + 1) : state;
    default:
      return state;
  }
}
