import { useEffect, useMemo, useRef, useState } from 'react';
import { AiClient } from '../ai/client';
import { settingsForElo } from '../ai/search';
import { AbilityButton } from '../components/AbilityButton';
import { ChessBoard } from '../components/ChessBoard';
import { GameHeader } from '../components/GameHeader';
import { MoveLog } from '../components/MoveLog';
import { PromotionPicker } from '../components/PromotionPicker';
import { ReinforcementPanel } from '../components/ReinforcementPanel';
import {
  ANY_PIECE,
  BLACK,
  BONUS_MOMENTUM,
  BONUS_TWIN,
  type Color,
  F_PASS,
  F_PROMO,
  NON_PAWN_TYPES,
  NO_BONUS,
  PAWN,
  QUEEN,
  WHITE,
  colorOf,
} from '../engine/constants';
import type { Move } from '../engine/position';
import { Match, type EndReason, type MatchEvent } from '../game/match';
import { compileRules } from '../game/reinforcements';
import { computerElo, type RunState } from '../game/run';

export type GameOutcome = 'win' | 'loss' | 'draw';

interface Banner {
  key: number;
  title: string;
  text: string;
  tone: 'gold' | 'blue' | 'red' | 'violet';
}

const REASON_TEXT: Record<EndReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefold: 'Threefold repetition',
  'fifty-move': 'Fifty-move rule',
  insufficient: 'Insufficient material',
  resign: 'You resigned',
};

const MIN_THINK_MS = 450;

export interface GameScreenProps {
  run: RunState;
  onGameEnd: (outcome: GameOutcome, reason: EndReason) => void;
  onQuit: () => void;
}

export function GameScreen({ run, onGameEnd, onQuit }: GameScreenProps) {
  const rules = useMemo(() => compileRules(run.reinforcements), [run.reinforcements]);
  const [match] = useState(() => new Match(rules));
  const [, setVersion] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const aiRef = useRef<AiClient | null>(null);
  const aliveRef = useRef(true);
  const bannerTimer = useRef<number | undefined>(undefined);
  const bannerKey = useRef(1);

  const elo = computerElo(run);
  const settings = useMemo(() => settingsForElo(elo), [elo]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      aiRef.current?.dispose();
      aiRef.current = null;
      window.clearTimeout(bannerTimer.current);
    };
  }, []);

  const rerender = () => setVersion((v) => v + 1);

  const showBanner = (title: string, text: string, tone: Banner['tone'], ms = 2600) => {
    window.clearTimeout(bannerTimer.current);
    setBanner({ key: bannerKey.current++, title, text, tone });
    bannerTimer.current = window.setTimeout(() => setBanner(null), ms);
  };

  const announce = (events: MatchEvent[], mover: Color) => {
    for (const e of events) {
      if (e.kind === 'bonus') {
        if (e.source === 'momentum') showBanner('Bonus Move', 'Pawn Momentum — move that pawn again, or skip.', 'gold');
        if (e.source === 'twin') showBanner('Twin Strike', 'Strike again with the same piece.', 'violet');
        if (e.source === 'warp') showBanner('Time Warp', 'Take a second move with any piece.', 'violet');
      } else if (e.kind === 'armor') {
        showBanner('Armor Holds', mover === BLACK ? 'The capture bounced off your Armored Pawn.' : 'Your capture bounced off armor.', 'blue');
      } else if (e.kind === 'second-wind') {
        showBanner('Second Wind', 'Checkmate undone — time rewinds to before your last move.', 'gold', 3600);
      }
    }
  };

  const runAi = async () => {
    setThinking(true);
    aiRef.current ??= new AiClient();
    const move = await aiRef.current.chooseMove(match.pos, settings, MIN_THINK_MS);
    if (!aliveRef.current || match.result) return;
    if (move) announce(match.play(move), BLACK);
    setThinking(false);
    rerender();
    // the computer never has bonus moves, but keep the loop general
    if (!match.result && match.turn === BLACK && aliveRef.current) void runAi();
  };

  const commit = (move: Move) => {
    const events = match.play(move);
    setSelected(null);
    setPromo(null);
    announce(events, WHITE);
    rerender();
    if (!match.result && match.turn === BLACK) void runAi();
  };

  const pos = match.pos;
  const playerTurn = pos.turn === WHITE && !match.result && !thinking;
  const lockedSquare = pos.bonusSq >= 0 ? pos.bonusSq : null;
  const effectiveSelected = lockedSquare ?? selected;
  const legal = playerTurn ? match.legalMoves() : [];
  const targets = effectiveSelected !== null ? legal.filter((m) => m.from === effectiveSelected) : [];
  const passMove = legal.find((m) => m.flags & F_PASS);

  const onSquareClick = (sq: number) => {
    if (!playerTurn) return;
    if (effectiveSelected !== null) {
      const moves = targets.filter((m) => m.to === sq);
      if (moves.length) {
        if (moves.some((m) => m.flags & F_PROMO)) {
          setPromo(moves);
          return;
        }
        commit(moves.find((m) => !m.special) ?? moves[0]);
        return;
      }
    }
    if (lockedSquare !== null) return;
    const p = pos.board[sq];
    if (p && colorOf(p) === WHITE && legal.some((m) => m.from === sq)) setSelected(sq === selected ? null : sq);
    else setSelected(null);
  };

  // --- derived display state ---
  const player = rules.sides[WHITE];
  const empowered = useMemo(() => {
    const set = new Set<number>();
    for (const t of NON_PAWN_TYPES) {
      const prof = player.profiles[t];
      if (prof.leaps.some((c) => c.special) || prof.slides.some((c) => c.special)) set.add(t);
    }
    if (player.momentum || player.pawnSidestep || player.pawnDoubleAnywhere) set.add(PAWN);
    if (player.queensGuard) set.add(QUEEN);
    return set;
  }, [player]);

  let checkSquare: number | null = null;
  if (pos.inCheck(pos.turn)) checkSquare = pos.kings[pos.turn];
  else if (pos.inCheck((1 - pos.turn) as Color)) checkSquare = pos.kings[1 - pos.turn];

  const inBonus = pos.bonusSq !== NO_BONUS;
  const bonusName = pos.bonusKind === BONUS_MOMENTUM ? 'Pawn Momentum' : pos.bonusKind === BONUS_TWIN ? 'Twin Strike' : 'Time Warp';
  const [white, black] = match.material();

  let status = 'Your move';
  let tone: 'neutral' | 'good' | 'warn' | 'bad' = 'neutral';
  if (match.result) {
    const r = match.result;
    status = r.winner === WHITE ? 'Victory' : r.winner === BLACK ? 'Defeat' : 'Draw';
    tone = r.winner === WHITE ? 'good' : r.winner === BLACK ? 'bad' : 'warn';
  } else if (thinking) {
    status = 'Computer is thinking…';
  } else if (inBonus) {
    status = `Bonus move · ${bonusName}`;
    tone = 'good';
  } else if (pos.inCheck(WHITE)) {
    status = 'Check! Protect your king';
    tone = 'bad';
  } else if (match.armed !== 'none') {
    status = match.armed === 'twin' ? 'Twin Strike armed: move a rook or queen' : 'Time Warp armed: your next move is doubled';
    tone = 'good';
  }

  const abilityDisabled = !playerTurn || inBonus;
  const outcome: GameOutcome | null = match.result ? (match.result.winner === WHITE ? 'win' : match.result.winner === BLACK ? 'loss' : 'draw') : null;

  return (
    <div className="game screen-enter">
      <GameHeader
        round={run.round}
        playerElo={run.playerElo}
        computerElo={elo}
        reinforcementCount={run.reinforcements.reduce((a, r) => a + r.stacks, 0)}
        status={status}
        statusTone={tone}
        materialDiff={white - black}
        thinking={thinking}
      />
      <div className="game__main">
        <div className="game__boardcol">
          <div className="board-wrap">
            <ChessBoard
              pos={pos}
              selected={effectiveSelected}
              targets={targets}
              lastMove={match.lastMove}
              checkSquare={checkSquare}
              bonusSquare={lockedSquare}
              captureFx={match.captureFx}
              empowered={empowered}
              interactive={playerTurn}
              onSquareClick={onSquareClick}
            />
            {banner ? (
              <div key={banner.key} className={`banner banner--${banner.tone}`} role="alert">
                <strong>{banner.title}</strong>
                <span>{banner.text}</span>
              </div>
            ) : null}
            {match.result && outcome ? (
              <div className="result-overlay" role="dialog" aria-label="Game result">
                <div className={`result result--${outcome}`}>
                  <h2 className="result__title">{outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Defeat' : 'Draw'}</h2>
                  <p className="result__reason">{REASON_TEXT[match.result.reason]}</p>
                  <p className="result__text">
                    {outcome === 'win'
                      ? `Round ${run.round} complete. Claim your Reinforcement.`
                      : outcome === 'loss'
                        ? 'Your ascension ends here.'
                        : 'No one falls. The round will be replayed.'}
                  </p>
                  <button type="button" className="btn btn--primary" onClick={() => onGameEnd(outcome, match.result!.reason)} autoFocus>
                    {outcome === 'win' ? 'Claim Reinforcement' : outcome === 'loss' ? 'See Results' : 'Replay Round'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {inBonus && playerTurn ? (
            <div className="bonusbar" role="status">
              <div>
                <strong className="bonusbar__title">Bonus Move</strong>
                <span className="bonusbar__text">
                  {bonusName}: {pos.bonusSq === ANY_PIECE ? 'move any piece again.' : 'the glowing piece may move again.'}
                </span>
              </div>
              {passMove ? (
                <button type="button" className="btn btn--small" onClick={() => commit(passMove)}>
                  Skip bonus
                </button>
              ) : null}
            </div>
          ) : null}

          {match.startingCharges.twin + match.startingCharges.warp + match.startingCharges.secondWind > 0 ? (
            <div className="abilities" aria-label="Abilities">
              {match.startingCharges.twin > 0 ? (
                <AbilityButton
                  name="Twin Strike"
                  state={match.armed === 'twin' ? 'armed' : match.charges.twin > 0 ? 'ready' : 'used'}
                  charges={match.charges.twin}
                  hint={match.armed === 'twin' ? 'Tap to disarm' : 'Arm: next rook/queen move gets a second move'}
                  disabled={abilityDisabled}
                  onClick={() => {
                    match.arm(match.armed === 'twin' ? 'none' : 'twin');
                    rerender();
                  }}
                />
              ) : null}
              {match.startingCharges.warp > 0 ? (
                <AbilityButton
                  name="Time Warp"
                  state={match.armed === 'warp' ? 'armed' : match.charges.warp > 0 ? 'ready' : 'used'}
                  charges={match.charges.warp}
                  hint={match.armed === 'warp' ? 'Tap to disarm' : 'Arm: your next move is followed by another'}
                  disabled={abilityDisabled}
                  onClick={() => {
                    match.arm(match.armed === 'warp' ? 'none' : 'warp');
                    rerender();
                  }}
                />
              ) : null}
              {match.startingCharges.secondWind > 0 ? (
                <AbilityButton
                  name="Second Wind"
                  state={match.charges.secondWind > 0 ? 'passive' : 'used'}
                  charges={match.charges.secondWind}
                  hint="Triggers automatically if you are checkmated"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="game__side">
          <ReinforcementPanel owned={run.reinforcements} />
          <MoveLog log={match.log} />
          <div className="game__actions">
            {confirmResign ? (
              <>
                <span className="small">Resign this game? It ends the run.</span>
                <button
                  type="button"
                  className="btn btn--danger btn--small"
                  onClick={() => {
                    match.resign();
                    setConfirmResign(false);
                    rerender();
                  }}
                >
                  Yes, resign
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmResign(false)}>
                  Keep playing
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmResign(true)} disabled={!!match.result}>
                  Resign
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={onQuit}>
                  Menu
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
      {promo ? (
        <PromotionPicker
          options={promo.map((m) => m.promo)}
          onPick={(t) => {
            const m = promo.find((x) => x.promo === t);
            if (m) commit(m);
          }}
          onCancel={() => setPromo(null)}
        />
      ) : null}
    </div>
  );
}
