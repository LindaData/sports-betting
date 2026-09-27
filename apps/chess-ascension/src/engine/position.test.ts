import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { Position } from './position';
import { standardRules } from './rules';
import { F_PROMO, PIECE_LETTER, squareName } from './constants';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = pos.legalMoves();
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    pos.make(m);
    n += perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

// Standard perft suite (https://www.chessprogramming.org/Perft_Results)
const PERFT: [string, number[]][] = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
];

describe('standard chess rules (perft)', () => {
  for (const [fen, counts] of PERFT) {
    it(fen, () => {
      const pos = new Position(standardRules(), fen);
      counts.forEach((expected, i) => {
        expect(perft(pos, i + 1)).toBe(expected);
      });
      // make/unmake must leave the hash untouched
      const before = pos.hashLo;
      pos.recomputeHash();
      expect(pos.hashLo).toBe(before);
    });
  }
});

const uci = (m: { from: number; to: number; promo: number; flags: number }) =>
  squareName(m.from) + squareName(m.to) + (m.flags & F_PROMO ? PIECE_LETTER[m.promo].toLowerCase() : '');

describe('differential test against chess.js', () => {
  it('matches legal moves and game-end states over random games', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let game = 0; game < 60; game++) {
      const ref = new Chess();
      const pos = new Position(standardRules());
      for (let ply = 0; ply < 200; ply++) {
        const mine = pos.legalMoves().map(uci).sort();
        const theirs = ref
          .moves({ verbose: true })
          .map((m) => m.from + m.to + (m.promotion ?? ''))
          .sort();
        expect(mine).toEqual(theirs);
        expect(pos.inCheck()).toBe(ref.inCheck());
        if (mine.length === 0) break;
        if (ref.isInsufficientMaterial()) {
          expect(pos.insufficientMaterial()).toBe(true);
          break;
        }
        const pick = pos.legalMoves()[Math.floor(rand() * mine.length)];
        const u = uci(pick);
        pos.make(pick);
        ref.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        if (ref.isThreefoldRepetition()) {
          expect(pos.repetitionCount()).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
