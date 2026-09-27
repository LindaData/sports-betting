import type { OwnedReinforcement } from './reinforcements';
import type { RunState } from './run';

export interface BestRun {
  round: number;
  computerElo: number;
  reinforcements: OwnedReinforcement[];
  date: number;
}

export interface Stats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  runs: number;
  bestRound: number;
  highestElo: number;
  reinforcementsCollected: number;
  bestRun: BestRun | null;
}

const STATS_KEY = 'chess-ascension:stats:v1';
const RUN_KEY = 'chess-ascension:run:v1';

export const EMPTY_STATS: Stats = {
  games: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  runs: 0,
  bestRound: 0,
  highestElo: 0,
  reinforcementsCollected: 0,
  bestRun: null,
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode / quota): the game still works, it just won't persist
  }
}

export function loadStats(): Stats {
  return { ...EMPTY_STATS, ...(read<Partial<Stats>>(STATS_KEY) ?? {}) };
}

export function saveStats(stats: Stats): void {
  write(STATS_KEY, stats);
}

export function loadRun(): RunState | null {
  const run = read<RunState>(RUN_KEY);
  if (!run || typeof run.round !== 'number' || !Array.isArray(run.reinforcements)) return null;
  // A game in progress is not saved move-by-move; resume at the round screen.
  return run.phase === 'playing' ? { ...run, phase: 'round' } : run;
}

export function saveRun(run: RunState | null): void {
  write(RUN_KEY, run);
}

export type GameOutcome = 'win' | 'loss' | 'draw';

/** Fold a finished game into the lifetime statistics. */
export function recordGame(stats: Stats, outcome: GameOutcome, run: RunState, computerElo: number): Stats {
  const next: Stats = {
    ...stats,
    games: stats.games + 1,
    wins: stats.wins + (outcome === 'win' ? 1 : 0),
    losses: stats.losses + (outcome === 'loss' ? 1 : 0),
    draws: stats.draws + (outcome === 'draw' ? 1 : 0),
    highestElo: outcome === 'win' ? Math.max(stats.highestElo, computerElo) : stats.highestElo,
    bestRound: Math.max(stats.bestRound, run.round),
  };
  return next;
}

/** Fold a finished run (lost or abandoned) into the lifetime statistics. */
export function recordRunEnd(stats: Stats, run: RunState, computerElo: number): Stats {
  const next: Stats = {
    ...stats,
    runs: stats.runs + 1,
    reinforcementsCollected: stats.reinforcementsCollected + run.reinforcements.reduce((a, r) => a + r.stacks, 0),
    bestRound: Math.max(stats.bestRound, run.round),
  };
  if (!stats.bestRun || run.round > stats.bestRun.round) {
    next.bestRun = { round: run.round, computerElo, reinforcements: run.reinforcements, date: Date.now() };
  }
  return next;
}
