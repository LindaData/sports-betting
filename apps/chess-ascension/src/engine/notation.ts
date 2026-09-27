import { F_BOUNCE, F_CAPTURE, F_CASTLE, F_PASS, PAWN, PIECE_LETTER, type Color, fileOf, squareName, typeOf } from './constants';
import type { Move, Position } from './position';

/**
 * Standard Algebraic Notation for a move that has not been made yet.
 * Reinforcement pieces use their own letters (A = Archbishop, C = Chancellor, Z = Amazon).
 * A capture blocked by an Armored Pawn is written with a "⊘" marker.
 */
export function toSan(pos: Position, move: Move): string {
  if (move.flags & F_PASS) return '…';
  let san: string;
  if (move.flags & F_CASTLE) {
    san = move.to > move.from ? 'O-O' : 'O-O-O';
  } else {
    const type = typeOf(move.piece);
    const isCapture = (move.flags & (F_CAPTURE | F_BOUNCE)) !== 0;
    if (type === PAWN) {
      san = (isCapture ? 'abcdefgh'[fileOf(move.from)] + 'x' : '') + squareName(move.to);
      if (move.promo) san += '=' + PIECE_LETTER[move.promo];
    } else {
      const others = pos
        .legalMoves()
        .filter((m) => m !== move && m.to === move.to && m.piece === move.piece && m.from !== move.from && !(m.flags & F_PASS));
      let dis = '';
      if (others.length) {
        const sameFile = others.some((m) => fileOf(m.from) === fileOf(move.from));
        const sameRank = others.some((m) => m.from >> 4 === move.from >> 4);
        if (!sameFile) dis = squareName(move.from)[0];
        else if (!sameRank) dis = squareName(move.from)[1];
        else dis = squareName(move.from);
      }
      san = PIECE_LETTER[type] + dis + (isCapture ? 'x' : '') + squareName(move.to);
    }
    if (move.flags & F_BOUNCE) san += '⊘';
  }
  const mover = pos.turn;
  pos.make(move);
  const opp = (1 - mover) as Color;
  if (pos.isAttacked(pos.kings[opp], mover)) {
    san += pos.turn === opp && pos.legalMoves().length === 0 ? '#' : '+';
  }
  pos.unmake();
  return san;
}
