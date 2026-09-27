import { ALL_SQUARES, F_BOUNCE, F_CAPTURE, PIECE_NAME, WHITE, colorOf, fileOf, rankOf, squareName, typeOf } from '../engine/constants';
import type { Move, Position } from '../engine/position';
import type { CaptureFx } from '../game/match';
import { ChessPiece } from './ChessPiece';

export interface ChessBoardProps {
  pos: Position;
  selected: number | null;
  targets: Move[];
  lastMove: { from: number; to: number } | null;
  checkSquare: number | null;
  bonusSquare: number | null;
  captureFx: CaptureFx[];
  /** piece types (player side) that have reinforcement-granted movement */
  empowered: Set<number>;
  interactive: boolean;
  onSquareClick: (square: number) => void;
}

const place = (sq: number) => ({ transform: `translate(${fileOf(sq) * 100}%, ${(7 - rankOf(sq)) * 100}%)` });

export function ChessBoard({
  pos,
  selected,
  targets,
  lastMove,
  checkSquare,
  bonusSquare,
  captureFx,
  empowered,
  interactive,
  onSquareClick,
}: ChessBoardProps) {
  const targetBySquare = new Map<number, Move>();
  for (const m of targets) {
    const prev = targetBySquare.get(m.to);
    // prefer showing a normal move when a normal and a special move reach the same square
    if (!prev || (prev.special && !m.special)) targetBySquare.set(m.to, m);
  }
  const squares = [];
  for (let row = 7; row >= 0; row--) {
    for (let file = 0; file < 8; file++) {
      const sq = row * 16 + file;
      const piece = pos.board[sq];
      const light = (file + row) % 2 === 1;
      const t = targetBySquare.get(sq);
      const classes = ['sq', light ? 'sq--light' : 'sq--dark'];
      if (lastMove && (lastMove.from === sq || lastMove.to === sq)) classes.push('sq--last');
      if (selected === sq) classes.push('sq--selected');
      if (checkSquare === sq) classes.push('sq--check');
      if (t) classes.push('sq--target');
      const label = `${squareName(sq)}${piece ? `, ${colorOf(piece) === WHITE ? 'your' : 'computer'} ${PIECE_NAME[typeOf(piece)].toLowerCase()}` : ''}${t ? ', legal move' : ''}`;
      squares.push(
        <button
          key={sq}
          type="button"
          className={classes.join(' ')}
          data-square={squareName(sq)}
          aria-label={label}
          disabled={!interactive}
          onClick={() => onSquareClick(sq)}
        >
          {file === 0 ? <span className="coord coord--rank">{row + 1}</span> : null}
          {row === 0 ? <span className="coord coord--file">{'abcdefgh'[file]}</span> : null}
          {t ? (
            <span
              className={[
                'hint',
                t.flags & (F_CAPTURE | F_BOUNCE) ? 'hint--capture' : 'hint--move',
                t.special ? 'hint--special' : '',
              ].join(' ')}
            />
          ) : null}
        </button>,
      );
    }
  }

  const pieces = ALL_SQUARES.filter((sq) => pos.board[sq]).map((sq) => {
    const p = pos.board[sq];
    const color = colorOf(p);
    const type = typeOf(p);
    const id = pos.ids[sq] || 1000 + sq;
    const classes = ['piece', color === WHITE ? 'piece--player' : 'piece--ai'];
    if (sq === selected) classes.push('piece--selected');
    if (sq === bonusSquare) classes.push('piece--bonus');
    return (
      <div key={id} className={classes.join(' ')} style={place(sq)} data-piece={`${color === WHITE ? 'w' : 'b'}${'PNBRQKACZ'[type - 1]}`}>
        <ChessPiece
          type={type}
          color={color}
          empowered={color === WHITE && empowered.has(type)}
          armor={color === WHITE ? pos.armor[sq] : 0}
          className="piece__svg"
        />
      </div>
    );
  });

  return (
    <div className="board" data-fen={pos.fen()} data-turn={pos.turn === WHITE ? 'w' : 'b'} data-bonus={pos.bonusSq}>
      <div className="board__squares">{squares}</div>
      <div className="board__pieces" aria-hidden="true">
        {pieces}
        {captureFx.map((fx) => (
          <div key={`fx-${fx.key}`} className="piece piece--captured" style={place(fx.square)}>
            <ChessPiece type={typeOf(fx.piece)} color={colorOf(fx.piece)} className="piece__svg" />
          </div>
        ))}
      </div>
    </div>
  );
}
