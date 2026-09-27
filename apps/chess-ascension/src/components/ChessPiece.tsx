import { memo } from 'react';
import { AMAZON, ARCHBISHOP, BISHOP, CHANCELLOR, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, type Color } from '../engine/constants';

// Original geometric piece set drawn on a 100×100 grid.
const BASE = 'M24 84 H76 A5 5 0 0 1 81 89 V92 A3 3 0 0 1 78 95 H22 A3 3 0 0 1 19 92 V89 A5 5 0 0 1 24 84 Z';

const PATHS: Record<number, string[]> = {
  [PAWN]: ['M50 17 A13 13 0 1 1 49.9 17 Z', 'M37 45 H63 L60 52 H40 Z', 'M41 52 C41 64 35 74 30 84 H70 C65 74 59 64 59 52 Z'],
  [ROOK]: ['M28 18 H38 V27 H45 V18 H55 V27 H62 V18 H72 V37 L66 44 H34 L28 37 Z', 'M34 44 H66 L69 84 H31 Z', 'M33 76 H67 V84 H33 Z'],
  [BISHOP]: [
    'M50 5 A5 5 0 1 1 49.9 5 Z',
    'M50 14 C63 24 68 36 64 47 C62 52 38 52 36 47 C32 36 37 24 50 14 Z',
    'M36 52 H64 L61 58 H39 Z',
    'M40 58 C40 70 34 78 30 84 H70 C66 78 60 70 60 58 Z',
  ],
  [QUEEN]: [
    'M20 30 L33 57 L35 23 L44 54 L50 17 L56 54 L65 23 L67 57 L80 30 L72 71 H28 Z',
    'M20 25 A5 5 0 1 1 19.9 25 Z M35 18 A5 5 0 1 1 34.9 18 Z M50 12 A5 5 0 1 1 49.9 12 Z M65 18 A5 5 0 1 1 64.9 18 Z M80 25 A5 5 0 1 1 79.9 25 Z',
    'M28 71 H72 L74 77 H26 Z',
    'M26 77 H74 L78 84 H22 Z',
  ],
  [KING]: [
    'M46.5 4 H53.5 V12 H61 V18 H53.5 V27 H46.5 V18 H39 V12 H46.5 Z',
    'M50 28 C70 28 81 40 73 57 L68 70 H32 L27 57 C19 40 30 28 50 28 Z',
    'M31 70 H69 L71 77 H29 Z',
    'M29 77 H71 L76 84 H24 Z',
  ],
  [KNIGHT]: [
    'M30 84 C30 73 36 65 45 57 L41 51 C35 54 31 56 26 56 C21 56 17 51 20 46 L34 27 C38 21 44 17 50 15 L54 6 L59 15 C71 20 79 36 79 52 C79 66 75 76 74 84 Z',
  ],
};

const DETAILS: Record<number, string[]> = {
  [BISHOP]: ['M55 25 L45 38'],
  [KNIGHT]: ['M60 22 C68 30 72 44 71 60', 'M45 30 A2.6 2.6 0 1 1 44.9 30 Z'],
  [KING]: ['M34 57 H66'],
  [QUEEN]: ['M31 64 H69'],
  [ROOK]: ['M33 52 H67'],
};

const BASE_SHAPE: Record<number, number> = {
  [ARCHBISHOP]: BISHOP,
  [CHANCELLOR]: ROOK,
  [AMAZON]: QUEEN,
};

export interface ChessPieceProps {
  type: number;
  color: Color;
  /** piece has at least one reinforcement-granted move */
  empowered?: boolean;
  /** remaining Armored Pawn charges */
  armor?: number;
  className?: string;
  title?: string;
}

function ChessPieceImpl({ type, color, empowered, armor, className, title }: ChessPieceProps) {
  const shape = BASE_SHAPE[type] ?? type;
  const compound = shape !== type;
  const player = color === WHITE;
  const fill = player ? 'url(#ca-ivory)' : 'url(#ca-obsidian)';
  const stroke = player ? '#4a3a1e' : '#e2896b';
  const detail = player ? '#8a6d3b' : '#e2896b';
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title} focusable="false">
      {title ? <title>{title}</title> : null}
      <g fill={fill} stroke={stroke} strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round">
        <path d={BASE} />
        {PATHS[shape].map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="none" stroke={detail} strokeWidth={2.6} strokeLinecap="round">
        {(DETAILS[shape] ?? []).map((d, i) => (
          <path key={i} d={d} fill={d.includes('A') ? detail : 'none'} />
        ))}
      </g>
      {compound ? (
        <g transform="translate(58 44)">
          <circle cx="16" cy="16" r="15" fill={player ? '#2c5a45' : '#3b1f1a'} stroke="#e7c678" strokeWidth={2.5} />
          <path
            transform="translate(3 2) scale(0.27)"
            d={PATHS[KNIGHT][0]}
            fill="#e7c678"
            stroke="none"
          />
        </g>
      ) : null}
      {empowered ? (
        <path d="M86 6 L89 13 L96 16 L89 19 L86 26 L83 19 L76 16 L83 13 Z" fill="#f3cf6b" stroke="#6b4e12" strokeWidth={1.5} />
      ) : null}
      {armor ? (
        <g transform="translate(64 60)">
          <path d="M16 2 L29 7 V17 C29 26 22 31 16 34 C10 31 3 26 3 17 V7 Z" fill="#7fb4c9" stroke="#18323d" strokeWidth={2.5} />
          {armor > 1 ? (
            <text x="16" y="24" textAnchor="middle" fontSize="16" fontWeight="800" fill="#10232b">
              {armor}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}

export const ChessPiece = memo(ChessPieceImpl);

/** Shared gradients referenced by every piece. Render once near the app root. */
export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="ca-ivory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.55" stopColor="#f1e3c2" />
          <stop offset="1" stopColor="#d8bf8c" />
        </linearGradient>
        <linearGradient id="ca-obsidian" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4f55" />
          <stop offset="0.5" stopColor="#262a2e" />
          <stop offset="1" stopColor="#121416" />
        </linearGradient>
      </defs>
    </svg>
  );
}

