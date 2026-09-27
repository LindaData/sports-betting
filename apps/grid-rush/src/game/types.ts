export const GRID_SIZE = 10;

export interface Point {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface Coin extends Point {
  id: number;
}

export interface Enemy extends Point {
  id: number;
  /** Last movement direction, used to make wandering look purposeful. */
  heading: Direction;
}

/** A linked pair of warp portals: stepping into one endpoint exits at the other. */
export interface Portal {
  id: number;
  a: Point;
  b: Point;
}

export interface Level {
  number: number;
  walls: Point[];
  coins: Coin[];
  enemies: Enemy[];
  portals: Portal[];
  start: Point;
  goal: Point;
  /** Milliseconds between enemy steps. */
  enemyStepMs: number;
  /** Probability (0–1) that an enemy steps toward the player instead of wandering. */
  chaseChance: number;
  /** Seconds under which the speed bonus is paid out. */
  parSeconds: number;
}

export type Phase = 'menu' | 'playing' | 'paused' | 'levelComplete' | 'gameOver';

export type SoundKind = 'coin' | 'hit' | 'level' | 'gameOver' | 'step' | 'start' | 'warp';

export interface SoundEvent {
  id: number;
  kind: SoundKind;
}

export interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'coin' | 'hit' | 'goal' | 'warp';
  ttlMs: number;
}

export interface LevelSummary {
  level: number;
  seconds: number;
  coinsCollected: number;
  coinsTotal: number;
  goalPoints: number;
  coinPoints: number;
  speedBonus: number;
}

export interface GameState {
  phase: Phase;
  /** Seeded RNG state so the reducer stays pure. */
  seed: number;
  level: Level;
  player: Point;
  score: number;
  lives: number;
  highScore: number;
  isNewHighScore: boolean;
  levelElapsedMs: number;
  enemyClockMs: number;
  invulnerableMs: number;
  hitFlashMs: number;
  coinsCollected: number;
  /** Increments on every teleport so the player sprite re-mounts instead of sliding across the board. */
  warps: number;
  lastSummary: LevelSummary | null;
  sounds: SoundEvent[];
  popups: Popup[];
  nextEventId: number;
}
