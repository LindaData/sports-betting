import {
  ALL_SQUARES,
  ARMED_NONE,
  ARMED_TWIN,
  ARMED_WARP,
  BLACK,
  BONUS_MOMENTUM,
  BONUS_TWIN,
  BONUS_WARP,
  type Color,
  F_BOUNCE,
  F_CAPTURE,
  F_EP,
  F_PASS,
  NO_BONUS,
  PAWN,
  WHITE,
  colorOf,
  makePiece,
  typeOf,
} from '../engine/constants';
import { toSan } from '../engine/notation';
import { START_FEN, Position, type Move, type PositionData } from '../engine/position';
import type { CompiledRules } from '../engine/rules';

export type EndReason = 'checkmate' | 'stalemate' | 'threefold' | 'fifty-move' | 'insufficient' | 'resign';

export interface MatchResult {
  winner: Color | null;
  reason: EndReason;
}

export interface LogEntry {
  san: string;
  color: Color;
  /** part of a bonus move (Pawn Momentum, Twin Strike, Time Warp) */
  bonus: boolean;
  special: boolean;
}

export type MatchEvent =
  | { kind: 'bonus'; source: 'momentum' | 'twin' | 'warp' }
  | { kind: 'armor'; square: number }
  | { kind: 'second-wind' };

export interface Charges {
  twin: number;
  warp: number;
  secondWind: number;
}

export interface CaptureFx {
  key: number;
  piece: number;
  square: number;
}

interface Snapshot {
  data: PositionData;
  logLength: number;
  charges: Charges;
  lastMove: { from: number; to: number } | null;
}

/**
 * One chess game inside a run. Wraps Position with game-level concerns:
 * move log, once-per-game ability charges, Second Wind rewinds and end-of-game detection.
 */
export class Match {
  pos: Position;
  readonly rules: CompiledRules;
  charges: Charges;
  readonly startingCharges: Charges;
  log: LogEntry[] = [];
  lastMove: { from: number; to: number } | null = null;
  captureFx: CaptureFx[] = [];
  result: MatchResult | null = null;
  private snapshots: Snapshot[] = [];
  private fxKey = 1;

  constructor(rules: CompiledRules, rand: () => number = Math.random, fen?: string) {
    this.rules = rules;
    this.pos = new Position(rules, fen ?? START_FEN);
    const player = rules.sides[WHITE];
    // Armored Pawn: every player pawn starts with armor charges.
    if (player.pawnArmor > 0) {
      for (const sq of ALL_SQUARES) if (this.pos.board[sq] === makePiece(WHITE, PAWN)) this.pos.armor[sq] = player.pawnArmor;
    }
    // Sabotage: remove random enemy pawns before the game starts.
    const enemyPawns = ALL_SQUARES.filter((sq) => this.pos.board[sq] === makePiece(BLACK, PAWN));
    for (let i = 0; i < player.sabotagePawns && enemyPawns.length; i++) {
      const [sq] = enemyPawns.splice(Math.floor(rand() * enemyPawns.length), 1);
      this.pos.board[sq] = 0;
      this.pos.ids[sq] = 0;
    }
    this.pos.recomputeHash();
    this.charges = { twin: player.twinStrikeCharges, warp: player.timeWarpCharges, secondWind: player.secondWindCharges };
    this.startingCharges = { ...this.charges };
  }

  get turn(): Color {
    return this.pos.turn;
  }

  get inBonus(): boolean {
    return this.pos.bonusSq !== NO_BONUS;
  }

  legalMoves(): Move[] {
    return this.result ? [] : this.pos.legalMoves();
  }

  movesFrom(square: number): Move[] {
    return this.legalMoves().filter((m) => m.from === square);
  }

  /** Arm Twin Strike or Time Warp for the player's next move. */
  arm(kind: 'twin' | 'warp' | 'none'): void {
    if (this.pos.turn !== WHITE || this.inBonus || this.result) return;
    if (kind === 'twin' && this.charges.twin <= 0) return;
    if (kind === 'warp' && this.charges.warp <= 0) return;
    this.pos.setArmed(kind === 'twin' ? ARMED_TWIN : kind === 'warp' ? ARMED_WARP : ARMED_NONE);
  }

  get armed(): 'twin' | 'warp' | 'none' {
    return this.pos.armed === ARMED_TWIN ? 'twin' : this.pos.armed === ARMED_WARP ? 'warp' : 'none';
  }

  /** Apply a legal move. Returns events for the UI to announce. */
  play(move: Move): MatchEvent[] {
    if (this.result) return [];
    const events: MatchEvent[] = [];
    const pos = this.pos;
    const mover = pos.turn;
    const wasBonus = this.inBonus;
    if (mover === WHITE && !wasBonus) {
      this.snapshots.push({ data: pos.toData(), logLength: this.log.length, charges: { ...this.charges }, lastMove: this.lastMove });
    }
    const san = toSan(pos, move);
    const armedBefore = pos.armed;
    const capturedPiece = move.captured;
    const captureSquare = this.captureSquare(move);
    pos.make(move);
    pos.commit();
    this.log.push({ san, color: mover, bonus: wasBonus, special: move.special });
    if (!(move.flags & F_PASS)) {
      this.lastMove = { from: move.from, to: move.to };
      if (move.flags & F_CAPTURE && !(move.flags & F_BOUNCE)) {
        this.captureFx = [...this.captureFx.slice(-4), { key: this.fxKey++, piece: capturedPiece, square: captureSquare }];
      }
    }
    if (move.flags & F_BOUNCE) events.push({ kind: 'armor', square: this.captureSquare(move) });
    if (armedBefore !== ARMED_NONE && pos.armed === ARMED_NONE) {
      if (pos.bonusKind === BONUS_TWIN) this.charges.twin--;
      if (pos.bonusKind === BONUS_WARP) this.charges.warp--;
    }
    if (pos.bonusSq !== NO_BONUS) {
      const source = pos.bonusKind === BONUS_MOMENTUM ? 'momentum' : pos.bonusKind === BONUS_TWIN ? 'twin' : 'warp';
      events.push({ kind: 'bonus', source });
    }
    this.checkEnd(events);
    return events;
  }

  private captureSquare(move: Move): number {
    return move.flags & F_EP ? move.to - (colorOf(move.piece) === WHITE ? 16 : -16) : move.to;
  }

  private checkEnd(events: MatchEvent[]): void {
    const pos = this.pos;
    const legal = pos.legalMoves();
    if (legal.length === 0) {
      if (pos.inCheck()) {
        if (pos.turn === WHITE && this.charges.secondWind > 0 && this.snapshots.length) {
          this.rewind();
          events.push({ kind: 'second-wind' });
          return;
        }
        this.result = { winner: (1 - pos.turn) as Color, reason: 'checkmate' };
      } else {
        this.result = { winner: null, reason: 'stalemate' };
      }
      return;
    }
    if (pos.bonusSq !== NO_BONUS) return; // mid-turn: draws are judged when the turn completes
    if (pos.halfmove >= 100) this.result = { winner: null, reason: 'fifty-move' };
    else if (pos.repetitionCount() >= 3) this.result = { winner: null, reason: 'threefold' };
    else if (pos.insufficientMaterial()) this.result = { winner: null, reason: 'insufficient' };
  }

  /** Second Wind: restore the position from before the player's last turn. */
  private rewind(): void {
    const snap = this.snapshots.pop();
    if (!snap) return;
    const remaining = this.charges.secondWind - 1;
    this.pos = Position.fromData(this.rules, snap.data);
    this.log = this.log.slice(0, snap.logLength);
    this.charges = { ...snap.charges, secondWind: remaining };
    this.lastMove = snap.lastMove;
    this.captureFx = [];
  }

  resign(): void {
    if (!this.result) this.result = { winner: BLACK, reason: 'resign' };
  }

  /** Material count per side (for the header). */
  material(): [number, number] {
    const v = [0, 1, 3, 3, 5, 9, 0, 7, 8, 12];
    const out: [number, number] = [0, 0];
    for (const sq of ALL_SQUARES) {
      const p = this.pos.board[sq];
      if (p) out[p >> 4] += v[typeOf(p)];
    }
    return out;
  }
}
