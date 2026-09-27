import { F_CAPTURE, F_PASS, F_PROMO, KING, typeOf } from '../engine/constants';
import type { Move, Position } from '../engine/position';
import { BASE_VALUE, evaluate } from './evaluate';

/** Difficulty knobs. ELO is a progression label; these settings are what actually make the AI stronger. */
export interface AiSettings {
  /** maximum iterative-deepening depth (plies) */
  depth: number;
  /** hard time budget per move */
  timeMs: number;
  /** std-dev (centipawns) of random noise added to root move scores */
  noise: number;
  /** probability of deliberately picking a weaker move */
  blunder: number;
  /** how much worse (centipawns) a deliberate mistake may be */
  blunderMargin: number;
}

export type Tier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Grandmaster';

const LEVELS: { elo: number; s: AiSettings }[] = [
  { elo: 850, s: { depth: 1, timeMs: 600, noise: 90, blunder: 0.3, blunderMargin: 350 } },
  { elo: 1000, s: { depth: 2, timeMs: 700, noise: 65, blunder: 0.2, blunderMargin: 280 } },
  { elo: 1150, s: { depth: 2, timeMs: 800, noise: 45, blunder: 0.12, blunderMargin: 220 } },
  { elo: 1300, s: { depth: 3, timeMs: 900, noise: 35, blunder: 0.08, blunderMargin: 180 } },
  { elo: 1450, s: { depth: 3, timeMs: 1000, noise: 22, blunder: 0.05, blunderMargin: 140 } },
  { elo: 1600, s: { depth: 4, timeMs: 1100, noise: 15, blunder: 0.03, blunderMargin: 110 } },
  { elo: 1750, s: { depth: 4, timeMs: 1300, noise: 8, blunder: 0.015, blunderMargin: 80 } },
  { elo: 1900, s: { depth: 5, timeMs: 1500, noise: 4, blunder: 0, blunderMargin: 0 } },
  { elo: 2050, s: { depth: 6, timeMs: 1800, noise: 0, blunder: 0, blunderMargin: 0 } },
  { elo: 2250, s: { depth: 7, timeMs: 2200, noise: 0, blunder: 0, blunderMargin: 0 } },
  { elo: 2500, s: { depth: 8, timeMs: 2600, noise: 0, blunder: 0, blunderMargin: 0 } },
  { elo: Infinity, s: { depth: 12, timeMs: 3200, noise: 0, blunder: 0, blunderMargin: 0 } },
];

export function settingsForElo(elo: number): AiSettings {
  return { ...(LEVELS.find((l) => elo <= l.elo) ?? LEVELS[LEVELS.length - 1]).s };
}

export function tierForElo(elo: number): Tier {
  if (elo < 1250) return 'Beginner';
  if (elo < 1700) return 'Intermediate';
  if (elo < 2300) return 'Advanced';
  if (elo < 2700) return 'Expert';
  return 'Grandmaster';
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
}

const INF = 1_000_000_000;
export const MATE = 1_000_000;
const ABORT = Symbol('abort');
const TT_BITS = 18;
const TT_SIZE = 1 << TT_BITS;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;
const MAX_PLY = 96;

const moveKey = (m: Move) => (m.from + 2) | ((m.to + 2) << 8) | (m.promo << 16);

export class Searcher {
  private pos: Position;
  private nodes = 0;
  private deadline = 0;
  private ttLo = new Int32Array(TT_SIZE);
  private ttHi = new Int32Array(TT_SIZE);
  private ttDepth = new Int8Array(TT_SIZE);
  private ttFlag = new Uint8Array(TT_SIZE);
  private ttScore = new Int32Array(TT_SIZE);
  private ttMove = new Int32Array(TT_SIZE);
  private killers = new Int32Array(MAX_PLY * 2);
  private history = new Int32Array(1 << 16);
  private rand: () => number;

  constructor(pos: Position, rand: () => number = Math.random) {
    this.pos = pos;
    this.rand = rand;
  }

  private checkTime() {
    if ((++this.nodes & 1023) === 0 && performance.now() > this.deadline) throw ABORT;
  }

  private orderScore(m: Move, ttMove: number, ply: number): number {
    const k = moveKey(m);
    if (k === ttMove) return 10_000_000;
    if (m.flags & F_CAPTURE) return 1_000_000 + BASE_VALUE[typeOf(m.captured)] * 10 - BASE_VALUE[typeOf(m.piece)] / 10;
    if (m.flags & F_PROMO) return 900_000 + BASE_VALUE[m.promo];
    if (m.flags & F_PASS) return 1000;
    if (this.killers[ply * 2] === k) return 800_000;
    if (this.killers[ply * 2 + 1] === k) return 790_000;
    return this.history[((m.from & 0x77) << 7) | (m.to & 0x7f)] ?? 0;
  }

  private sortMoves(moves: Move[], ttMove: number, ply: number): Move[] {
    const scored = moves.map((m) => ({ m, s: this.orderScore(m, ttMove, ply) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.m);
  }

  private qsearch(alpha: number, beta: number, ply: number, qd: number): number {
    this.checkTime();
    const pos = this.pos;
    // evasions are searched only near the quiescence root; deeper it just stands pat
    const inCheck = qd <= 1 && pos.inCheck();
    let stand = -INF;
    if (!inCheck) {
      stand = evaluate(pos);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (qd >= 8 || ply >= MAX_PLY - 1) return stand;
    } else if (ply >= MAX_PLY - 1) {
      return evaluate(pos);
    }
    const moves = this.sortMoves(pos.generatePseudo(!inCheck), 0, ply);
    let legal = 0;
    for (const m of moves) {
      if (m.flags & F_PASS) continue;
      // delta pruning: a capture that cannot lift the score near alpha is not worth searching
      if (!inCheck && !m.promo && stand + BASE_VALUE[typeOf(m.captured)] + 200 < alpha) continue;
      const us = pos.turn;
      pos.make(m);
      if (!pos.isLegalAfterMake(m, us)) {
        pos.unmake();
        continue;
      }
      legal++;
      const score = pos.turn === us ? this.qsearch(alpha, beta, ply + 1, qd + 1) : -this.qsearch(-beta, -alpha, ply + 1, qd + 1);
      pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return alpha;
  }

  private search(depth: number, alpha: number, beta: number, ply: number): number {
    this.checkTime();
    const pos = this.pos;
    if (ply > 0 && (pos.halfmove >= 100 || pos.isRepeat())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck && ply < MAX_PLY / 2) depth++;
    if (depth <= 0 || ply >= MAX_PLY - 1) return this.qsearch(alpha, beta, ply, 0);

    const idx = pos.hashLo & (TT_SIZE - 1);
    let ttMove = 0;
    if (this.ttLo[idx] === pos.hashLo && this.ttHi[idx] === pos.hashHi) {
      ttMove = this.ttMove[idx];
      if (ply > 0 && this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s > MATE - 1000) s -= ply;
        else if (s < -MATE + 1000) s += ply;
        const f = this.ttFlag[idx];
        if (f === TT_EXACT) return s;
        if (f === TT_LOWER && s >= beta) return s;
        if (f === TT_UPPER && s <= alpha) return s;
      }
    }

    const moves = this.sortMoves(pos.generatePseudo(), ttMove, ply);
    const origAlpha = alpha;
    let best = -INF;
    let bestKey = 0;
    let legal = 0;
    for (const m of moves) {
      const us = pos.turn;
      pos.make(m);
      if (!(m.flags & F_PASS) && !pos.isLegalAfterMake(m, us)) {
        pos.unmake();
        continue;
      }
      legal++;
      let score: number;
      if (pos.turn === us) {
        // bonus move: same side moves again, no sign flip
        score = this.search(depth - 1, alpha, beta, ply + 1);
      } else if (legal === 1) {
        score = -this.search(depth - 1, -beta, -alpha, ply + 1);
      } else {
        // principal variation search with late-move reductions for quiet moves
        const quiet = !(m.flags & (F_CAPTURE | F_PROMO | F_PASS));
        const r = depth >= 3 && legal > 3 && quiet && !inCheck && !pos.inCheck() ? (legal > 10 ? 2 : 1) : 0;
        score = -this.search(depth - 1 - r, -alpha - 1, -alpha, ply + 1);
        if (score > alpha && r > 0) score = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1);
        if (score > alpha && score < beta) score = -this.search(depth - 1, -beta, -alpha, ply + 1);
      }
      pos.unmake();
      if (score > best) {
        best = score;
        bestKey = moveKey(m);
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!(m.flags & (F_CAPTURE | F_PROMO | F_PASS))) {
          const k = moveKey(m);
          if (this.killers[ply * 2] !== k) {
            this.killers[ply * 2 + 1] = this.killers[ply * 2];
            this.killers[ply * 2] = k;
          }
          const h = ((m.from & 0x77) << 7) | (m.to & 0x7f);
          this.history[h] = Math.min(this.history[h] + depth * depth, 700_000);
        }
        break;
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;

    let stored = best;
    if (stored > MATE - 1000) stored += ply;
    else if (stored < -MATE + 1000) stored -= ply;
    this.ttLo[idx] = pos.hashLo;
    this.ttHi[idx] = pos.hashHi;
    this.ttDepth[idx] = depth;
    this.ttScore[idx] = stored;
    this.ttMove[idx] = bestKey;
    this.ttFlag[idx] = best <= origAlpha ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT;
    return best;
  }

  private gaussian(): number {
    const u = Math.max(1e-9, this.rand());
    const v = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Pick a move for the side to move. */
  think(settings: AiSettings): SearchResult {
    const pos = this.pos;
    const start = performance.now();
    this.deadline = start + settings.timeMs;
    this.nodes = 0;
    let root = pos.legalMoves();
    // The AI never captures a king; kings are never capturable in legal positions.
    root = root.filter((m) => typeOf(m.captured) !== KING);
    if (root.length === 0) return { move: null, score: 0, depth: 0, nodes: 0 };
    if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };

    // With noise/blunders enabled, every move within `margin` of the best needs a real score,
    // so the root keeps its window open that far below the best move found so far.
    const margin = settings.noise > 0 || settings.blunder > 0 ? Math.max(settings.noise * 3, settings.blunderMargin, 60) : 0;
    let completed: { m: Move; s: number }[] = [];
    let reached = 0;
    for (let depth = 1; depth <= settings.depth; depth++) {
      const scores: { m: Move; s: number }[] = [];
      try {
        let alpha = -INF;
        for (const m of root) {
          const us = pos.turn;
          pos.make(m);
          let s: number;
          const floor = alpha === -INF ? -INF : alpha - margin;
          if (pos.turn === us) s = this.search(depth - 1, floor, INF, 1);
          else s = -this.search(depth - 1, -INF, -floor, 1);
          pos.unmake();
          scores.push({ m, s });
          if (s > alpha) alpha = s;
        }
      } catch (e) {
        if (e !== ABORT) throw e;
        // keep the partially searched best move if it beats the previous iteration's choice
        if (scores.length && completed.length) {
          const bestPartial = scores.reduce((a, b) => (b.s > a.s ? b : a));
          if (bestPartial.m === completed[0].m || bestPartial.s > completed[0].s) {
            completed = [bestPartial, ...completed.filter((x) => x.m !== bestPartial.m)];
          }
        }
        // unwind any moves left made by the aborted search
        while (pos.histLo.length > this.baseHistory) pos.unmake();
        break;
      }
      scores.sort((a, b) => b.s - a.s);
      completed = scores;
      reached = depth;
      root = scores.map((x) => x.m);
      if (Math.abs(scores[0].s) > MATE - 1000) break; // forced mate found
      if (performance.now() - start > settings.timeMs * 0.45) break; // next iteration would not finish
    }
    if (!completed.length) completed = root.map((m) => ({ m, s: 0 }));

    // Human-like imperfection at lower levels.
    let choice = completed[0];
    if (settings.noise > 0 && Math.abs(choice.s) < MATE - 1000) {
      let bestAdj = -INF;
      for (const c of completed) {
        if (c.s < -MATE + 1000) continue;
        const adj = c.s + this.gaussian() * settings.noise;
        if (adj > bestAdj) {
          bestAdj = adj;
          choice = c;
        }
      }
    }
    if (settings.blunder > 0 && this.rand() < settings.blunder && Math.abs(completed[0].s) < MATE - 1000) {
      const floor = completed[0].s - settings.blunderMargin;
      const pool = completed.filter((c) => c !== completed[0] && c.s >= floor && c.s > -MATE + 1000);
      if (pool.length) choice = pool[Math.floor(this.rand() * pool.length)];
    }
    return { move: choice.m, score: choice.s, depth: reached, nodes: this.nodes };
  }

  private baseHistory = 0;

  /** Entry point that records the history length so aborted searches can unwind cleanly. */
  run(settings: AiSettings): SearchResult {
    this.baseHistory = this.pos.histLo.length;
    return this.think(settings);
  }
}

export function findBestMove(pos: Position, settings: AiSettings, rand?: () => number): SearchResult {
  const work = pos.clone();
  const result = new Searcher(work, rand).run(settings);
  if (!result.move) return result;
  // map back to an equivalent move object generated from the caller's position
  const m = result.move;
  const match = pos.legalMoves().find((x) => x.from === m.from && x.to === m.to && x.promo === m.promo && x.flags === m.flags);
  return { ...result, move: match ?? m };
}
