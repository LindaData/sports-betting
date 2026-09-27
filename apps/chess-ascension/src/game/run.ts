import { addReinforcement, draftOffers, type OwnedReinforcement } from './reinforcements';

export type RunPhase = 'round' | 'playing' | 'reward' | 'over';

export interface RunState {
  id: string;
  round: number;
  playerElo: number;
  /** per-run difficulty jitter so each run starts a little differently */
  eloOffset: number;
  reinforcements: OwnedReinforcement[];
  phase: RunPhase;
  offers: string[];
  wins: number;
  draws: number;
  /** computer ELO the run ended against (set when phase === 'over') */
  finalElo?: number;
  endReason?: string;
  startedAt: number;
}

/** Displayed computer ELO for a round. Rounds 1–10 follow the design table; after that it climbs faster. */
const ELO_TABLE = [800, 950, 1100, 1250, 1400, 1550, 1700, 1850, 2000, 2200];
export function baseEloForRound(round: number): number {
  if (round <= ELO_TABLE.length) return ELO_TABLE[round - 1];
  return 2200 + (round - 10) * 250;
}

export function computerElo(run: Pick<RunState, 'round' | 'eloOffset'>): number {
  return Math.max(600, baseEloForRound(run.round) + run.eloOffset);
}

export function newRun(rand: () => number = Math.random): RunState {
  return {
    id: Math.floor(rand() * 1e9).toString(36),
    round: 1,
    playerElo: 1200,
    eloOffset: Math.round((rand() * 100 - 50) / 10) * 10,
    reinforcements: [],
    phase: 'round',
    offers: [],
    wins: 0,
    draws: 0,
    startedAt: Date.now(),
  };
}

/** Rating change shown after a game (a progression flourish, not a real rating system). */
export function eloGain(playerElo: number, oppElo: number, score: 1 | 0.5 | 0): number {
  const expected = 1 / (1 + 10 ** ((oppElo - playerElo) / 400));
  return Math.round(32 * (score - expected));
}

export function recordWin(run: RunState, rand: () => number = Math.random): RunState {
  const gain = eloGain(run.playerElo, computerElo(run), 1);
  return {
    ...run,
    wins: run.wins + 1,
    playerElo: run.playerElo + Math.max(gain, 4),
    phase: 'reward',
    offers: draftOffers(run.reinforcements, run.round, rand),
  };
}

export function chooseReward(run: RunState, id: string): RunState {
  return {
    ...run,
    reinforcements: addReinforcement(run.reinforcements, id, run.round),
    round: run.round + 1,
    phase: 'round',
    offers: [],
  };
}

export function recordDraw(run: RunState): RunState {
  return { ...run, draws: run.draws + 1, playerElo: run.playerElo + eloGain(run.playerElo, computerElo(run), 0.5), phase: 'round' };
}

export function recordLoss(run: RunState, reason: string): RunState {
  return {
    ...run,
    playerElo: run.playerElo + eloGain(run.playerElo, computerElo(run), 0),
    phase: 'over',
    finalElo: computerElo(run),
    endReason: reason,
  };
}
