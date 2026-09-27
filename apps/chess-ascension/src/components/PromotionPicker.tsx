import { PIECE_NAME, WHITE } from '../engine/constants';
import { ChessPiece } from './ChessPiece';

export function PromotionPicker({ options, onPick, onCancel }: { options: number[]; onPick: (type: number) => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion">
      <div className="modal promo">
        <h2 className="modal__title">Promote your pawn</h2>
        <div className="promo__grid">
          {options.map((t) => (
            <button key={t} type="button" className="promo__opt" onClick={() => onPick(t)} data-promo={PIECE_NAME[t]}>
              <ChessPiece type={t} color={WHITE} className="promo__svg" />
              <span>{PIECE_NAME[t]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
