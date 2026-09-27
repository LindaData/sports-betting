import {
  ALL_SQUARES,
  ANY_PIECE,
  ARMED_NONE,
  ARMED_TWIN,
  ARMED_WARP,
  BISHOP,
  BLACK,
  BONUS_MOMENTUM,
  BONUS_NONE,
  BONUS_TWIN,
  BONUS_WARP,
  CASTLE_BK,
  CASTLE_BQ,
  CASTLE_WK,
  CASTLE_WQ,
  type Color,
  F_BOUNCE,
  F_CAPTURE,
  F_CASTLE,
  F_DOUBLE,
  F_EP,
  F_PASS,
  F_PROMO,
  KING,
  KNIGHT,
  NO_BONUS,
  PAWN,
  PIECE_LETTER,
  QUEEN,
  ROOK,
  WHITE,
  colorOf,
  fileOf,
  makePiece,
  onBoard,
  parseSquare,
  rankOf,
  sq0x88,
  squareName,
  typeOf,
} from './constants';
import type { CompiledRules } from './rules';

export interface Move {
  from: number;
  to: number;
  piece: number;
  /** captured piece (0 if none). For a bounce this is the armored pawn that survives. */
  captured: number;
  /** promotion piece type, 0 if none */
  promo: number;
  flags: number;
  /** true when the move exists only because of a reinforcement */
  special: boolean;
}

interface Undo {
  move: Move;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
  turn: Color;
  bonusSq: number;
  bonusLeft: number;
  bonusKind: number;
  armed: number;
  hashLo: number;
  hashHi: number;
  capSq: number;
  capId: number;
  capArmor: number;
  moverArmor: number;
}

export interface PositionData {
  board: number[];
  ids: number[];
  armor: number[];
  turn: Color;
  castling: number;
  ep: number;
  halfmove: number;
  fullmove: number;
  bonusSq: number;
  bonusLeft: number;
  bonusKind: number;
  armed: number;
  nextId: number;
  history: [number, number][];
}

// ---------- Zobrist keys (deterministic so every thread agrees) ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
}
const rnd = mulberry32(0xc4e55);
const keyTable = (n: number) => {
  const lo = new Int32Array(n);
  const hi = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    lo[i] = rnd();
    hi[i] = rnd();
  }
  return { lo, hi };
};
const Z_PIECE = keyTable(32 * 128);
const Z_ARMOR = keyTable(8 * 128);
const Z_CASTLE = keyTable(16);
const Z_EP = keyTable(128);
const Z_BONUS = keyTable(130 * 4);
const Z_ARMED = keyTable(3);
const Z_TURN = keyTable(1);
const Z_LEFT = keyTable(8);

const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[sq0x88(4, 0)] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[sq0x88(7, 0)] = 15 & ~CASTLE_WK;
CASTLE_MASK[sq0x88(0, 0)] = 15 & ~CASTLE_WQ;
CASTLE_MASK[sq0x88(4, 7)] = 15 & ~(CASTLE_BK | CASTLE_BQ);
CASTLE_MASK[sq0x88(7, 7)] = 15 & ~CASTLE_BK;
CASTLE_MASK[sq0x88(0, 7)] = 15 & ~CASTLE_BQ;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const LETTER_TO_TYPE: Record<string, number> = {};
for (const [t, l] of Object.entries(PIECE_LETTER)) LETTER_TO_TYPE[l.toLowerCase()] = Number(t);

/**
 * Chess position with full rules (check, mate, castling, en passant, promotion, draws) whose
 * move generation is driven by CompiledRules, so reinforcements change what pieces can do while
 * king safety is still enforced for every move — including reinforcement moves.
 */
export class Position {
  board = new Int8Array(128);
  ids = new Int16Array(128);
  armor = new Int8Array(128);
  turn: Color = WHITE;
  castling = 0;
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings: [number, number] = [-1, -1];
  bonusSq = NO_BONUS;
  bonusLeft = 0;
  bonusKind = BONUS_NONE;
  armed = ARMED_NONE;
  hashLo = 0;
  hashHi = 0;
  nextId = 1;
  /** hashes of earlier positions in this game, for repetition detection */
  histLo: number[] = [];
  histHi: number[] = [];
  private undos: Undo[] = [];
  rules: CompiledRules;

  constructor(rules: CompiledRules, fen: string = START_FEN) {
    this.rules = rules;
    this.loadFen(fen);
  }

  // ---------------- setup / serialization ----------------

  loadFen(fen: string): void {
    const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
    this.board.fill(0);
    this.ids.fill(0);
    this.armor.fill(0);
    this.nextId = 1;
    const rows = placement.split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) {
          f += Number(ch);
          continue;
        }
        const color = ch === ch.toUpperCase() ? WHITE : BLACK;
        const type = LETTER_TO_TYPE[ch.toLowerCase()];
        const sq = sq0x88(f, 7 - r);
        this.board[sq] = makePiece(color, type);
        this.ids[sq] = this.nextId++;
        if (type === KING) this.kings[color] = sq;
        f++;
      }
    }
    this.turn = turn === 'b' ? BLACK : WHITE;
    this.castling = 0;
    if (castling?.includes('K')) this.castling |= CASTLE_WK;
    if (castling?.includes('Q')) this.castling |= CASTLE_WQ;
    if (castling?.includes('k')) this.castling |= CASTLE_BK;
    if (castling?.includes('q')) this.castling |= CASTLE_BQ;
    this.ep = ep && ep !== '-' ? parseSquare(ep) : -1;
    this.halfmove = Number(half ?? 0) || 0;
    this.fullmove = Number(full ?? 1) || 1;
    this.bonusSq = NO_BONUS;
    this.bonusLeft = 0;
    this.bonusKind = BONUS_NONE;
    this.armed = ARMED_NONE;
    this.undos = [];
    this.histLo = [];
    this.histHi = [];
    this.recomputeHash();
  }

  fen(): string {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[sq0x88(f, r)];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) out += empty;
        empty = 0;
        const l = PIECE_LETTER[typeOf(p)];
        out += colorOf(p) === WHITE ? l : l.toLowerCase();
      }
      if (empty) out += empty;
      if (r) out += '/';
    }
    let c = '';
    if (this.castling & CASTLE_WK) c += 'K';
    if (this.castling & CASTLE_WQ) c += 'Q';
    if (this.castling & CASTLE_BK) c += 'k';
    if (this.castling & CASTLE_BQ) c += 'q';
    return `${out} ${this.turn === WHITE ? 'w' : 'b'} ${c || '-'} ${this.ep >= 0 ? squareName(this.ep) : '-'} ${this.halfmove} ${this.fullmove}`;
  }

  toData(): PositionData {
    return {
      board: Array.from(this.board),
      ids: Array.from(this.ids),
      armor: Array.from(this.armor),
      turn: this.turn,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      bonusSq: this.bonusSq,
      bonusLeft: this.bonusLeft,
      bonusKind: this.bonusKind,
      armed: this.armed,
      nextId: this.nextId,
      history: this.histLo.map((lo, i) => [lo, this.histHi[i]]),
    };
  }

  static fromData(rules: CompiledRules, d: PositionData): Position {
    const p = new Position(rules, '8/8/8/8/8/8/8/8 w - - 0 1');
    p.board.set(d.board);
    p.ids.set(d.ids);
    p.armor.set(d.armor);
    p.turn = d.turn;
    p.castling = d.castling;
    p.ep = d.ep;
    p.halfmove = d.halfmove;
    p.fullmove = d.fullmove;
    p.bonusSq = d.bonusSq;
    p.bonusLeft = d.bonusLeft;
    p.bonusKind = d.bonusKind;
    p.armed = d.armed;
    p.nextId = d.nextId;
    p.histLo = d.history.map((h) => h[0]);
    p.histHi = d.history.map((h) => h[1]);
    for (const sq of ALL_SQUARES) {
      const pc = p.board[sq];
      if (pc && typeOf(pc) === KING) p.kings[colorOf(pc)] = sq;
    }
    p.recomputeHash();
    return p;
  }

  clone(): Position {
    return Position.fromData(this.rules, this.toData());
  }

  // ---------------- hashing ----------------

  private bonusKeyIndex(): number {
    return (this.bonusSq + 2) * 4 + this.bonusKind;
  }

  recomputeHash(): void {
    let lo = 0;
    let hi = 0;
    for (const sq of ALL_SQUARES) {
      const p = this.board[sq];
      if (!p) continue;
      lo ^= Z_PIECE.lo[p * 128 + sq];
      hi ^= Z_PIECE.hi[p * 128 + sq];
      const a = this.armor[sq];
      if (a) {
        lo ^= Z_ARMOR.lo[(a & 7) * 128 + sq];
        hi ^= Z_ARMOR.hi[(a & 7) * 128 + sq];
      }
    }
    lo ^= Z_CASTLE.lo[this.castling];
    hi ^= Z_CASTLE.hi[this.castling];
    if (this.ep >= 0) {
      lo ^= Z_EP.lo[this.ep];
      hi ^= Z_EP.hi[this.ep];
    }
    lo ^= Z_BONUS.lo[this.bonusKeyIndex()] ^ Z_LEFT.lo[this.bonusLeft & 7] ^ Z_ARMED.lo[this.armed];
    hi ^= Z_BONUS.hi[this.bonusKeyIndex()] ^ Z_LEFT.hi[this.bonusLeft & 7] ^ Z_ARMED.hi[this.armed];
    if (this.turn === BLACK) {
      lo ^= Z_TURN.lo[0];
      hi ^= Z_TURN.hi[0];
    }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  private xorPiece(p: number, sq: number): void {
    this.hashLo ^= Z_PIECE.lo[p * 128 + sq];
    this.hashHi ^= Z_PIECE.hi[p * 128 + sq];
  }

  private xorArmor(a: number, sq: number): void {
    if (!a) return;
    this.hashLo ^= Z_ARMOR.lo[(a & 7) * 128 + sq];
    this.hashHi ^= Z_ARMOR.hi[(a & 7) * 128 + sq];
  }

  private xorState(): void {
    this.hashLo ^= Z_CASTLE.lo[this.castling] ^ Z_BONUS.lo[this.bonusKeyIndex()] ^ Z_LEFT.lo[this.bonusLeft & 7] ^ Z_ARMED.lo[this.armed];
    this.hashHi ^= Z_CASTLE.hi[this.castling] ^ Z_BONUS.hi[this.bonusKeyIndex()] ^ Z_LEFT.hi[this.bonusLeft & 7] ^ Z_ARMED.hi[this.armed];
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP.lo[this.ep];
      this.hashHi ^= Z_EP.hi[this.ep];
    }
  }

  // ---------------- attack detection ----------------

  /** Is `sq` attacked by any piece of color `by`, using that side's (reinforced) movement rules? */
  isAttacked(sq: number, by: Color): boolean {
    const b = this.board;
    // pawns (captures are always diagonal-forward)
    const pawn = makePiece(by, PAWN);
    if (by === WHITE) {
      if (onBoard(sq - 15) && b[sq - 15] === pawn) return true;
      if (onBoard(sq - 17) && b[sq - 17] === pawn) return true;
    } else {
      if (onBoard(sq + 15) && b[sq + 15] === pawn) return true;
      if (onBoard(sq + 17) && b[sq + 17] === pawn) return true;
    }
    const side = this.rules.sides[by];
    const byBits = by << 4;
    for (const { off, mask } of side.leapAttacks) {
      const from = sq - off;
      if (from & 0x88) continue;
      const p = b[from];
      if (p && (p & 16) === byBits && mask & (1 << (p & 15))) return true;
    }
    for (const { off, mask } of side.slideAttacks) {
      let s = sq - off;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) {
          if ((p & 16) === byBits && mask & (1 << (p & 15))) return true;
          break;
        }
        s -= off;
      }
    }
    return false;
  }

  inCheck(color: Color = this.turn): boolean {
    const k = this.kings[color];
    return k >= 0 && this.isAttacked(k, (1 - color) as Color);
  }

  // ---------------- move generation ----------------

  private push(list: Move[], from: number, to: number, piece: number, captured: number, flags: number, special: boolean, promo = 0) {
    list.push({ from, to, piece, captured, promo, flags, special });
  }

  private addPawnMove(list: Move[], from: number, to: number, piece: number, captured: number, flags: number, special: boolean, promoRank: number, capturesOnly: boolean) {
    if (rankOf(to) === promoRank) {
      const promos = this.rules.sides[colorOf(piece)].promotions;
      for (const t of promos) {
        if (capturesOnly && t !== QUEEN && !captured) continue;
        this.push(list, from, to, piece, captured, flags | F_PROMO, special, t);
      }
    } else {
      this.push(list, from, to, piece, captured, flags, special);
    }
  }

  /** Pseudo-legal moves (king safety not yet checked). */
  generatePseudo(capturesOnly = false): Move[] {
    const list: Move[] = [];
    const us = this.turn;
    const them = (1 - us) as Color;
    const side = this.rules.sides[us];
    const b = this.board;
    const bonus = this.bonusSq;
    if (bonus !== NO_BONUS) list.push({ from: -1, to: -1, piece: 0, captured: 0, promo: 0, flags: F_PASS, special: true });
    const squares = bonus >= 0 ? [bonus] : ALL_SQUARES;
    for (const from of squares) {
      const piece = b[from];
      if (!piece || colorOf(piece) !== us) continue;
      const type = typeOf(piece);
      if (type === PAWN) {
        this.genPawn(list, from, piece, capturesOnly);
        continue;
      }
      const prof = side.profiles[type];
      for (const c of prof.leaps) {
        const to = from + c.off;
        if (to & 0x88) continue;
        const target = b[to];
        if (target) {
          if (colorOf(target) === us || typeOf(target) === KING) continue;
          if (typeOf(target) === PAWN && this.armor[to] > 0) {
            if (!capturesOnly) this.push(list, from, to, piece, target, F_BOUNCE, c.special);
            continue;
          }
          this.push(list, from, to, piece, target, F_CAPTURE, c.special);
        } else if (!capturesOnly) {
          this.push(list, from, to, piece, 0, 0, c.special);
        }
      }
      for (const c of prof.slides) {
        let to = from + c.off;
        while (!(to & 0x88)) {
          const target = b[to];
          if (target) {
            if (colorOf(target) !== us && typeOf(target) !== KING) {
              if (typeOf(target) === PAWN && this.armor[to] > 0) {
                if (!capturesOnly) this.push(list, from, to, piece, target, F_BOUNCE, c.special);
              } else {
                this.push(list, from, to, piece, target, F_CAPTURE, c.special);
              }
            }
            break;
          }
          if (!capturesOnly) this.push(list, from, to, piece, 0, 0, c.special);
          to += c.off;
        }
      }
      if (type === KING && !capturesOnly && bonus === NO_BONUS) this.genCastling(list, from, piece, us, them);
    }
    return list;
  }

  private genPawn(list: Move[], from: number, piece: number, capturesOnly: boolean) {
    const us = colorOf(piece);
    const side = this.rules.sides[us];
    const b = this.board;
    const dir = us === WHITE ? 16 : -16;
    const startRank = us === WHITE ? 1 : 6;
    const promoRank = us === WHITE ? 7 : 0;
    const one = from + dir;
    if (!(one & 0x88) && !b[one]) {
      this.addPawnMove(list, from, one, piece, 0, 0, false, promoRank, capturesOnly);
      if (!capturesOnly) {
        const two = one + dir;
        const anywhere = side.pawnDoubleAnywhere;
        if ((rankOf(from) === startRank || anywhere) && !(two & 0x88) && !b[two] && rankOf(two) !== promoRank) {
          this.push(list, from, two, piece, 0, F_DOUBLE, rankOf(from) !== startRank);
        }
      }
    }
    for (const side2 of [-1, 1]) {
      const to = one + side2;
      if (to & 0x88) continue;
      const target = b[to];
      if (target) {
        if (colorOf(target) === us || typeOf(target) === KING) continue;
        if (typeOf(target) === PAWN && this.armor[to] > 0) {
          if (!capturesOnly) this.push(list, from, to, piece, target, F_BOUNCE, false);
          continue;
        }
        this.addPawnMove(list, from, to, piece, target, F_CAPTURE, false, promoRank, capturesOnly);
      } else if (to === this.ep) {
        const capSq = to - dir;
        const victim = b[capSq];
        if (victim && typeOf(victim) === PAWN && colorOf(victim) !== us) {
          if (this.armor[capSq] > 0) {
            if (!capturesOnly) this.push(list, from, to, piece, victim, F_BOUNCE | F_EP, false);
          } else {
            this.push(list, from, to, piece, victim, F_CAPTURE | F_EP, false);
          }
        }
      }
    }
    if (side.pawnSidestep && !capturesOnly) {
      for (const d of [-1, 1]) {
        const to = from + d;
        if (!(to & 0x88) && !b[to]) this.push(list, from, to, piece, 0, 0, true);
      }
    }
  }

  private genCastling(list: Move[], from: number, piece: number, us: Color, them: Color) {
    const rank = us === WHITE ? 0 : 7;
    const e = sq0x88(4, rank);
    if (from !== e) return;
    const kRight = us === WHITE ? CASTLE_WK : CASTLE_BK;
    const qRight = us === WHITE ? CASTLE_WQ : CASTLE_BQ;
    const rook = makePiece(us, ROOK);
    const b = this.board;
    if (this.castling & kRight && b[e + 3] === rook && !b[e + 1] && !b[e + 2]) {
      if (!this.isAttacked(e, them) && !this.isAttacked(e + 1, them) && !this.isAttacked(e + 2, them)) {
        this.push(list, e, e + 2, piece, 0, F_CASTLE, false);
      }
    }
    if (this.castling & qRight && b[e - 4] === rook && !b[e - 1] && !b[e - 2] && !b[e - 3]) {
      if (!this.isAttacked(e, them) && !this.isAttacked(e - 1, them) && !this.isAttacked(e - 2, them)) {
        this.push(list, e, e - 2, piece, 0, F_CASTLE, false);
      }
    }
  }

  /**
   * Final legality filter applied to every move (normal and reinforcement-granted):
   *  - the mover's king may not be left in check
   *  - Queen's Guard: an enemy queen may only be captured by a protected piece
   */
  isLegalAfterMake(move: Move, us: Color): boolean {
    if (this.isAttacked(this.kings[us], (1 - us) as Color)) return false;
    if (move.flags & F_CAPTURE && !(move.flags & F_EP)) {
      const them = (1 - us) as Color;
      if (typeOf(move.captured) === QUEEN && this.rules.sides[them].queensGuard) {
        if (!this.isAttacked(move.to, us)) return false;
      }
    }
    return true;
  }

  legalMoves(capturesOnly = false): Move[] {
    const us = this.turn;
    const out: Move[] = [];
    for (const m of this.generatePseudo(capturesOnly)) {
      if (m.flags & F_PASS) {
        out.push(m);
        continue;
      }
      this.make(m);
      const ok = this.isLegalAfterMake(m, us);
      this.unmake();
      if (ok) out.push(m);
    }
    return out;
  }

  // ---------------- make / unmake ----------------

  make(m: Move): void {
    const us = this.turn;
    const b = this.board;
    const u: Undo = {
      move: m,
      castling: this.castling,
      ep: this.ep,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      turn: us,
      bonusSq: this.bonusSq,
      bonusLeft: this.bonusLeft,
      bonusKind: this.bonusKind,
      armed: this.armed,
      hashLo: this.hashLo,
      hashHi: this.hashHi,
      capSq: -1,
      capId: 0,
      capArmor: 0,
      moverArmor: 0,
    };
    this.undos.push(u);
    this.histLo.push(this.hashLo);
    this.histHi.push(this.hashHi);

    this.xorState();
    const wasBonus = this.bonusSq !== NO_BONUS;
    const prevKind = this.bonusKind;
    const prevLeft = this.bonusLeft;
    this.ep = -1;
    let nextBonusSq = NO_BONUS;
    let nextBonusKind = BONUS_NONE;
    let nextBonusLeft = 0;

    if (m.flags & F_PASS) {
      this.halfmove++;
    } else if (m.flags & F_BOUNCE) {
      // Armored Pawn: the capture fails, the attacker stays home and the armor breaks.
      const sq = m.flags & F_EP ? m.to - (us === WHITE ? 16 : -16) : m.to;
      u.capSq = sq;
      this.xorArmor(this.armor[sq], sq);
      this.armor[sq]--;
      this.xorArmor(this.armor[sq], sq);
      this.halfmove = 0;
    } else {
      const from = m.from;
      const to = m.to;
      const piece = b[from];
      const type = typeOf(piece);
      let realCapture = false;
      if (m.flags & F_CAPTURE) {
        const capSq = m.flags & F_EP ? to - (us === WHITE ? 16 : -16) : to;
        u.capSq = capSq;
        u.capId = this.ids[capSq];
        u.capArmor = this.armor[capSq];
        this.xorPiece(b[capSq], capSq);
        this.xorArmor(this.armor[capSq], capSq);
        b[capSq] = 0;
        this.ids[capSq] = 0;
        this.armor[capSq] = 0;
        realCapture = true;
      }
      // move the piece
      const placed = m.promo ? makePiece(us, m.promo) : piece;
      u.moverArmor = this.armor[from];
      this.xorPiece(piece, from);
      this.xorArmor(this.armor[from], from);
      b[from] = 0;
      b[to] = placed;
      this.ids[to] = this.ids[from];
      this.ids[from] = 0;
      this.armor[to] = m.promo ? 0 : this.armor[from];
      this.armor[from] = 0;
      this.xorPiece(placed, to);
      this.xorArmor(this.armor[to], to);
      if (type === KING) this.kings[us] = to;
      if (m.flags & F_CASTLE) {
        const rFrom = to > from ? from + 3 : from - 4;
        const rTo = to > from ? from + 1 : from - 1;
        const rook = b[rFrom];
        this.xorPiece(rook, rFrom);
        b[rTo] = rook;
        b[rFrom] = 0;
        this.ids[rTo] = this.ids[rFrom];
        this.ids[rFrom] = 0;
        this.xorPiece(rook, rTo);
      }
      this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
      if (m.flags & F_DOUBLE) {
        const epSq = (from + to) >> 1;
        const enemyPawn = makePiece(1 - us, PAWN);
        if ((onBoard(to - 1) && b[to - 1] === enemyPawn) || (onBoard(to + 1) && b[to + 1] === enemyPawn)) this.ep = epSq;
      }
      this.halfmove = type === PAWN || realCapture ? 0 : this.halfmove + 1;

      // ---- reinforcement-driven bonus moves ----
      const side = this.rules.sides[us];
      if (!wasBonus) {
        if (this.armed === ARMED_TWIN && side.twinStrikeTypes.includes(type)) {
          nextBonusSq = to;
          nextBonusKind = BONUS_TWIN;
          this.armed = ARMED_NONE;
        } else if (this.armed === ARMED_WARP) {
          nextBonusSq = ANY_PIECE;
          nextBonusKind = BONUS_WARP;
          this.armed = ARMED_NONE;
        } else if (type === PAWN && realCapture && side.momentum > 0) {
          nextBonusSq = to;
          nextBonusKind = BONUS_MOMENTUM;
          nextBonusLeft = side.momentum - 1;
        }
      } else if (prevKind === BONUS_MOMENTUM && type === PAWN && realCapture && prevLeft > 0) {
        // stacked Pawn Momentum: another capture keeps the chain alive (bounded by stack count)
        nextBonusSq = to;
        nextBonusKind = BONUS_MOMENTUM;
        nextBonusLeft = prevLeft - 1;
      }
    }

    this.bonusSq = nextBonusSq;
    this.bonusKind = nextBonusKind;
    this.bonusLeft = nextBonusLeft;
    if (nextBonusSq === NO_BONUS) {
      if (us === BLACK) this.fullmove++;
      this.turn = (1 - us) as Color;
      this.hashLo ^= Z_TURN.lo[0];
      this.hashHi ^= Z_TURN.hi[0];
    }
    this.xorState();
  }

  unmake(): void {
    const u = this.undos.pop();
    if (!u) throw new Error('unmake with empty history');
    this.histLo.pop();
    this.histHi.pop();
    const m = u.move;
    const b = this.board;
    const us = u.turn;
    if (m.flags & F_BOUNCE) {
      this.armor[u.capSq]++;
    } else if (!(m.flags & F_PASS)) {
      const from = m.from;
      const to = m.to;
      b[from] = m.piece;
      this.ids[from] = this.ids[to];
      this.armor[from] = u.moverArmor;
      b[to] = 0;
      this.ids[to] = 0;
      this.armor[to] = 0;
      if (typeOf(m.piece) === KING) this.kings[us] = from;
      if (m.flags & F_CASTLE) {
        const rFrom = to > from ? from + 3 : from - 4;
        const rTo = to > from ? from + 1 : from - 1;
        b[rFrom] = b[rTo];
        this.ids[rFrom] = this.ids[rTo];
        b[rTo] = 0;
        this.ids[rTo] = 0;
      }
      if (m.flags & F_CAPTURE) {
        b[u.capSq] = m.captured;
        this.ids[u.capSq] = u.capId;
        this.armor[u.capSq] = u.capArmor;
      }
    }
    this.turn = us;
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.fullmove = u.fullmove;
    this.bonusSq = u.bonusSq;
    this.bonusLeft = u.bonusLeft;
    this.bonusKind = u.bonusKind;
    this.armed = u.armed;
    this.hashLo = u.hashLo;
    this.hashHi = u.hashHi;
  }

  /** Arm (or disarm) a once-per-game ability for the side to move. */
  setArmed(value: number): void {
    this.xorState();
    this.armed = value;
    this.xorState();
  }

  /** Forget undo information (used by the game layer after committing a move). */
  commit(): void {
    this.undos = [];
  }

  // ---------------- draws ----------------

  repetitionCount(): number {
    let count = 1;
    for (let i = this.histLo.length - 1; i >= 0; i--) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) count++;
    }
    return count;
  }

  /** Repetition seen within the searchable window (used by the AI: any repeat counts as a draw). */
  isRepeat(): boolean {
    const n = this.histLo.length;
    const limit = Math.max(0, n - this.halfmove - 1);
    for (let i = n - 2; i >= limit; i--) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) return true;
    }
    return false;
  }

  insufficientMaterial(): boolean {
    const minors: { color: Color; type: number; sq: number }[] = [];
    for (const sq of ALL_SQUARES) {
      const p = this.board[sq];
      if (!p) continue;
      const t = typeOf(p);
      if (t === KING) continue;
      if (t !== KNIGHT && t !== BISHOP) return false;
      // a reinforced minor piece might be able to force mate: do not call it a draw
      if (!this.rules.sides[colorOf(p)].standard[t]) return false;
      minors.push({ color: colorOf(p), type: t, sq });
    }
    if (minors.length <= 1) return true;
    // only bishops, all on the same square colour
    if (minors.every((m) => m.type === BISHOP)) {
      const shade = (sq: number) => (fileOf(sq) + rankOf(sq)) & 1;
      return minors.every((m) => shade(m.sq) === shade(minors[0].sq));
    }
    return false;
  }

  pieceAt(sq: number): number {
    return this.board[sq];
  }
}
