import {
  ALL_SQUARES,
  AMAZON,
  ARCHBISHOP,
  BISHOP,
  BLACK,
  CHANCELLOR,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  colorOf,
  fileOf,
  rankOf,
  typeOf,
} from '../engine/constants';
import type { Position } from '../engine/position';
import type { CompiledRules } from '../engine/rules';

// Piece-square tables (White's view, index 0 = a8 ... 63 = h1), from the classic "simplified evaluation function".
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0,
  20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15,
  5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30,
  -30, -40, -50,
];
const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10,
  -20,
];
const PST_ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0,
  -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
];
const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5,
  5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
];
const PST_KING_MG = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40,
  -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0,
  20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
];
const PST_KING_EG = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40,
  40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50,
  -30, -30, -30, -30, -30, -30, -50,
];

const PST: number[][] = [];
PST[PAWN] = PST_PAWN;
PST[KNIGHT] = PST_KNIGHT;
PST[BISHOP] = PST_BISHOP;
PST[ROOK] = PST_ROOK;
PST[QUEEN] = PST_QUEEN;
PST[ARCHBISHOP] = PST_KNIGHT;
PST[CHANCELLOR] = PST_ROOK;
PST[AMAZON] = PST_QUEEN;

export const BASE_VALUE = [0, 100, 320, 330, 500, 900, 0, 850, 920, 1250];
const PHASE_WEIGHT = [0, 0, 1, 1, 2, 4, 0, 3, 4, 5];

/** Piece values per side, raised by reinforcements so the AI respects (and fears) upgraded pieces. */
export function pieceValues(rules: CompiledRules): number[][] {
  return rules.sides.map((side) =>
    BASE_VALUE.map((v, t) => {
      if (t === 0 || t === KING) return v;
      if (t === PAWN) return v + (side.pawnDoubleAnywhere ? 15 : 0) + (side.pawnSidestep ? 10 : 0) + (side.momentum ? 15 : 0);
      const prof = side.profiles[t];
      const extraLeaps = prof.leaps.filter((c) => c.special).length;
      const extraSlides = prof.slides.filter((c) => c.special).length;
      return v + extraLeaps * 18 + extraSlides * 60 + (t === QUEEN && side.queensGuard ? 60 : 0);
    }),
  );
}

const valueCache = new WeakMap<CompiledRules, number[][]>();
export function valuesFor(rules: CompiledRules): number[][] {
  let v = valueCache.get(rules);
  if (!v) {
    v = pieceValues(rules);
    valueCache.set(rules, v);
  }
  return v;
}

const centerDist = (sq: number) => {
  const f = fileOf(sq);
  const r = rankOf(sq);
  return Math.max(3 - f, f - 4) + Math.max(3 - r, r - 4);
};

/** Static evaluation in centipawns from the side-to-move's perspective. */
export function evaluate(pos: Position): number {
  const values = valuesFor(pos.rules);
  const b = pos.board;
  let mg = 0;
  let eg = 0;
  let phase = 0;
  const material = [0, 0];
  const bishops = [0, 0];
  for (const sq of ALL_SQUARES) {
    const p = b[sq];
    if (!p) continue;
    const c = colorOf(p);
    const t = typeOf(p);
    const idx = c === WHITE ? (7 - rankOf(sq)) * 8 + fileOf(sq) : rankOf(sq) * 8 + fileOf(sq);
    const sign = c === WHITE ? 1 : -1;
    phase += PHASE_WEIGHT[t];
    if (t === KING) {
      mg += sign * PST_KING_MG[idx];
      eg += sign * PST_KING_EG[idx];
      continue;
    }
    const v = values[c][t] + (t === PAWN ? pos.armor[sq] * 35 : 0);
    material[c] += v;
    if (t === BISHOP) bishops[c]++;
    const pst = PST[t][idx];
    mg += sign * (v + pst);
    // pawns become more valuable as they approach promotion in the endgame
    eg += sign * (v + (t === PAWN ? pst + (c === WHITE ? rankOf(sq) : 7 - rankOf(sq)) * 8 : pst));
  }
  if (bishops[WHITE] >= 2) {
    mg += 30;
    eg += 40;
  }
  if (bishops[BLACK] >= 2) {
    mg -= 30;
    eg -= 40;
  }
  const ph = Math.min(phase, 24);
  let score = (mg * ph + eg * (24 - ph)) / 24;

  // Mop-up: when clearly winning in the endgame, drive the enemy king to the edge and bring our king closer.
  const diff = material[WHITE] - material[BLACK];
  if (ph < 10 && Math.abs(diff) > 300) {
    const winner = diff > 0 ? WHITE : BLACK;
    const loserKing = pos.kings[1 - winner];
    const winnerKing = pos.kings[winner];
    if (loserKing >= 0 && winnerKing >= 0) {
      const kd = Math.abs(fileOf(loserKing) - fileOf(winnerKing)) + Math.abs(rankOf(loserKing) - rankOf(winnerKing));
      const bonus = centerDist(loserKing) * 12 + (14 - kd) * 5;
      score += winner === WHITE ? bonus : -bonus;
    }
  }
  return Math.round(pos.turn === WHITE ? score : -score);
}
