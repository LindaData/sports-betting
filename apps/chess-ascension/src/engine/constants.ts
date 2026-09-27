// Board representation: 0x88. Square index = rank * 16 + file, rank 0 is White's back rank.
// A square is on the board when (sq & 0x88) === 0.

export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;

// Piece types. Compound types (A, C, Z) only appear through promotion reinforcements.
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const ARCHBISHOP = 7; // bishop + knight
export const CHANCELLOR = 8; // rook + knight
export const AMAZON = 9; // queen + knight
export const PIECE_TYPES = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, ARCHBISHOP, CHANCELLOR, AMAZON] as const;
export const NON_PAWN_TYPES = [KNIGHT, BISHOP, ROOK, QUEEN, KING, ARCHBISHOP, CHANCELLOR, AMAZON] as const;

export const makePiece = (color: number, type: number): number => (color << 4) | type;
export const colorOf = (piece: number): Color => ((piece >> 4) & 1) as Color;
export const typeOf = (piece: number): number => piece & 15;

export const N = 16;
export const S = -16;
export const E = 1;
export const W = -1;
export const ORTHO_DIRS = [N, S, E, W];
export const DIAG_DIRS = [N + E, N + W, S + E, S + W];
export const KING_OFFSETS = [...ORTHO_DIRS, ...DIAG_DIRS];
export const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14];

// Move flags
export const F_CAPTURE = 1;
export const F_DOUBLE = 2;
export const F_EP = 4;
export const F_CASTLE = 8;
export const F_PROMO = 16;
export const F_BOUNCE = 32; // capture attempt blocked by an Armored Pawn
export const F_PASS = 64; // decline a bonus move

// Bonus-move state
export const NO_BONUS = -2;
export const ANY_PIECE = -1;
export const BONUS_NONE = 0;
export const BONUS_MOMENTUM = 1;
export const BONUS_TWIN = 2;
export const BONUS_WARP = 3;

// Armed once-per-game abilities
export const ARMED_NONE = 0;
export const ARMED_TWIN = 1;
export const ARMED_WARP = 2;

// Castling rights bits
export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

export const fileOf = (sq: number): number => sq & 7;
export const rankOf = (sq: number): number => sq >> 4;
export const sq0x88 = (file: number, rank: number): number => rank * 16 + file;
export const onBoard = (sq: number): boolean => (sq & 0x88) === 0;

export const squareName = (sq: number): string => 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1);
export const parseSquare = (name: string): number => sq0x88(name.charCodeAt(0) - 97, Number(name[1]) - 1);

export const ALL_SQUARES: number[] = [];
for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) ALL_SQUARES.push(sq0x88(f, r));

export const PIECE_LETTER: Record<number, string> = {
  [PAWN]: 'P',
  [KNIGHT]: 'N',
  [BISHOP]: 'B',
  [ROOK]: 'R',
  [QUEEN]: 'Q',
  [KING]: 'K',
  [ARCHBISHOP]: 'A',
  [CHANCELLOR]: 'C',
  [AMAZON]: 'Z',
};

export const PIECE_NAME: Record<number, string> = {
  [PAWN]: 'Pawn',
  [KNIGHT]: 'Knight',
  [BISHOP]: 'Bishop',
  [ROOK]: 'Rook',
  [QUEEN]: 'Queen',
  [KING]: 'King',
  [ARCHBISHOP]: 'Archbishop',
  [CHANCELLOR]: 'Chancellor',
  [AMAZON]: 'Amazon',
};
