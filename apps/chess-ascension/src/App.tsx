import { useEffect, useState } from 'react';
import { PieceDefs } from './components/ChessPiece';
import type { EndReason } from './game/match';
import { chooseReward, computerElo, newRun, recordDraw, recordLoss, recordWin, type RunState } from './game/run';
import { EMPTY_STATS, loadRun, loadStats, recordGame, recordRunEnd, saveRun, saveStats, type Stats } from './game/storage';
import { GameOverScreen } from './screens/GameOverScreen';
import { GameScreen, type GameOutcome } from './screens/GameScreen';
import { RewardScreen } from './screens/RewardScreen';
import { RoundScreen } from './screens/RoundScreen';
import { TitleScreen } from './screens/TitleScreen';

const REASON_LABEL: Record<EndReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefold: 'Threefold repetition',
  'fifty-move': 'the fifty-move rule',
  insufficient: 'insufficient material',
  resign: 'Resignation',
};

export default function App() {
  const [stats, setStats] = useState<Stats>(loadStats);
  const [run, setRun] = useState<RunState | null>(loadRun);
  const [view, setView] = useState<'title' | 'run'>('title');
  const [gameKey, setGameKey] = useState(0);
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => saveStats(stats), [stats]);
  useEffect(() => saveRun(run && run.phase !== 'over' ? run : null), [run]);

  const startNewRun = () => {
    setRun(newRun());
    setNotice(undefined);
    setView('run');
  };

  const abandonAndStart = () => {
    if (run && run.phase !== 'over') setStats((s) => recordRunEnd(s, run, computerElo(run)));
    startNewRun();
  };

  const startGame = () => {
    if (!run) return;
    setRun({ ...run, phase: 'playing' });
    setGameKey((k) => k + 1);
  };

  const onGameEnd = (outcome: GameOutcome, reason: EndReason) => {
    if (!run) return;
    const elo = computerElo(run);
    let nextStats = recordGame(stats, outcome, run, elo);
    if (outcome === 'win') {
      setRun(recordWin(run));
      setNotice(undefined);
    } else if (outcome === 'draw') {
      setRun(recordDraw(run));
      setNotice(`Draw by ${REASON_LABEL[reason].toLowerCase()} — replay Round ${run.round}.`);
    } else {
      const over = recordLoss(run, REASON_LABEL[reason]);
      nextStats = recordRunEnd(nextStats, over, elo);
      setRun(over);
    }
    setStats(nextStats);
  };

  const quitToMenu = () => {
    if (run && run.phase === 'playing') setRun({ ...run, phase: 'round' });
    setView('title');
  };

  let screen;
  if (view === 'title' || !run) {
    screen = (
      <TitleScreen
        stats={stats}
        savedRun={run && run.phase !== 'over' ? run : null}
        onStart={startNewRun}
        onContinue={() => setView('run')}
        onAbandon={abandonAndStart}
        onResetStats={() => setStats(EMPTY_STATS)}
      />
    );
  } else if (run.phase === 'round') {
    screen = <RoundScreen run={run} notice={notice} onStart={startGame} onMenu={quitToMenu} />;
  } else if (run.phase === 'playing') {
    screen = <GameScreen key={gameKey} run={run} onGameEnd={onGameEnd} onQuit={quitToMenu} />;
  } else if (run.phase === 'reward') {
    screen = (
      <RewardScreen
        run={run}
        onChoose={(id) => {
          setRun(chooseReward(run, id));
          setNotice(undefined);
        }}
      />
    );
  } else {
    screen = (
      <GameOverScreen
        run={run}
        stats={stats}
        onNewRun={startNewRun}
        onMenu={() => {
          setRun(null);
          setView('title');
        }}
      />
    );
  }

  return (
    <div className="app">
      <PieceDefs />
      <main className="app__main">{screen}</main>
    </div>
  );
}
