import { useState } from 'react';
import { ReinforcementCard } from '../components/ReinforcementCard';
import { RunStats } from '../components/RunStats';
import { REINFORCEMENTS } from '../game/reinforcements';
import { computerElo, type RunState } from '../game/run';
import type { Stats } from '../game/storage';
import { ChessPiece } from '../components/ChessPiece';
import { KNIGHT, QUEEN, WHITE, BLACK, KING } from '../engine/constants';

export interface TitleScreenProps {
  stats: Stats;
  savedRun: RunState | null;
  onStart: () => void;
  onContinue: () => void;
  onAbandon: () => void;
  onResetStats: () => void;
}

export function TitleScreen({ stats, savedRun, onStart, onContinue, onAbandon, onResetStats }: TitleScreenProps) {
  const [codex, setCodex] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  return (
    <div className="title screen-enter">
      <div className="title__hero">
        <div className="title__pieces" aria-hidden="true">
          <ChessPiece type={KNIGHT} color={BLACK} className="title__piece title__piece--l" />
          <ChessPiece type={QUEEN} color={WHITE} empowered className="title__piece title__piece--c" />
          <ChessPiece type={KING} color={BLACK} className="title__piece title__piece--r" />
        </div>
        <p className="eyebrow">A chess roguelike</p>
        <h1 className="logo">
          Chess <span>Ascension</span>
        </h1>
        <p className="title__tag">Beat the machine. Choose a Reinforcement. Bend the rules. Climb until you fall.</p>
        <div className="title__actions">
          {savedRun ? (
            <>
              <button type="button" className="btn btn--primary btn--lg" onClick={onContinue}>
                Continue Run · Round {savedRun.round}
              </button>
              {confirmAbandon ? (
                <div className="confirm">
                  <span className="small">Abandon Round {savedRun.round} run ({computerElo(savedRun)} ELO)?</span>
                  <button type="button" className="btn btn--danger btn--small" onClick={onAbandon}>
                    Abandon &amp; start new
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmAbandon(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmAbandon(true)}>
                  New Run
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn btn--primary btn--lg" onClick={onStart}>
              Start Run
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => setCodex(true)}>
            Reinforcement Codex
          </button>
        </div>
      </div>

      <div className="title__info">
        <section className="panel howto">
          <h2 className="panel__title">How a run works</h2>
          <ol className="howto__list">
            <li>
              <strong>Play real chess</strong> as the cream pieces against a computer that starts at 400 ELO.
            </li>
            <li>
              <strong>Win to ascend.</strong> Pick 1 of 3 Reinforcements that permanently rewrite how your pieces move.
            </li>
            <li>
              <strong>The computer grows stronger</strong> every round — deeper search, fewer mistakes.
            </li>
            <li>
              <strong>One loss ends the run.</strong> Draws replay the round. How high can you climb?
            </li>
          </ol>
        </section>
        <RunStats stats={stats} />
        {stats.games > 0 ? (
          <div className="title__reset">
            {confirmReset ? (
              <>
                <span className="small">Erase all statistics?</span>
                <button
                  type="button"
                  className="btn btn--danger btn--small"
                  onClick={() => {
                    onResetStats();
                    setConfirmReset(false);
                  }}
                >
                  Erase
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="linkbtn small" onClick={() => setConfirmReset(true)}>
                Reset statistics
              </button>
            )}
          </div>
        ) : null}
      </div>

      {codex ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Reinforcement Codex" onClick={() => setCodex(false)}>
          <div className="modal codex" onClick={(e) => e.stopPropagation()}>
            <div className="codex__head">
              <h2 className="modal__title">Reinforcement Codex</h2>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setCodex(false)}>
                Close
              </button>
            </div>
            <p className="muted small">Every power you can be offered. Reinforcements stack and combine — find the absurd ones.</p>
            <div className="codex__grid">
              {REINFORCEMENTS.map((r) => (
                <ReinforcementCard key={r.id} def={r} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
