import { addReinforcement, draftOffers, type OwnedReinforcement } from './reinforcements';

export type RunPhase = 'round' | 'playing' | 'reward' | 'over';

export interface RunState {
  id: string;
  round: number;
  playerElo: number;
  /** legacy per-run ELO jitter; new runs use 0 so the ladder is exactly 400, 500, … */
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

/** Displayed computer ELO for a round: 400 in round 1, +100 per round up to 2200 (round 19), then +250 per round. */
export const START_ELO = 400;
export const ELO_STEP = 100;
export const LADDER_TOP = 2200;
const LADDER_ROUNDS = (LADDER_TOP - START_ELO) / ELO_STEP + 1;
export function baseEloForRound(round: number): number {
  if (round <= LADDER_ROUNDS) return START_ELO + (round - 1) * ELO_STEP;
  return LADDER_TOP + (round - LADDER_ROUNDS) * 250;
}

export function computerElo(run: Pick<RunState, 'round' | 'eloOffset'>): number {
  return Math.max(START_ELO, baseEloForRound(run.round) + run.eloOffset);
}

export function newRun(rand: () => number = Math.random): RunState {
  return {
    id: Math.floor(rand() * 1e9).toString(36),
    round: 1,
    playerElo: 1200,
    eloOffset: 0,
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
