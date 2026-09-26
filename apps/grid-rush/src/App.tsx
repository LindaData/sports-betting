import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { DPad } from './components/DPad';
import { Hud } from './components/Hud';
import { Instructions } from './components/Instructions';
import { Overlay } from './components/Overlay';
import { useGame } from './hooks/useGame';
import { useKeyboard } from './hooks/useKeyboard';

export default function App() {
  const { state, muted, start, move, pause, resume, nextLevel, toggleMute } = useGame();

  useKeyboard({
    onMove: move,
    onPrimary: () => {
      if (state.phase === 'menu' || state.phase === 'gameOver') start();
      else if (state.phase === 'paused') resume();
      else if (state.phase === 'levelComplete') nextLevel();
    },
    onTogglePause: () => {
      if (state.phase === 'playing') pause();
      else if (state.phase === 'paused') resume();
    },
    onRestart: () => {
      if (state.phase !== 'menu') start();
    },
    onToggleMute: toggleMute,
  });

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="logo">
          <span className="logo__grid">Grid</span>
          <span className="logo__rush">Rush</span>
        </h1>
      </header>

      <main className="stage">
        <Hud state={state} />
        <div className="board-wrap">
          <Board state={state}>
            <Overlay state={state} onStart={start} onResume={resume} onNextLevel={nextLevel} />
          </Board>
        </div>
        <Controls
          phase={state.phase}
          muted={muted}
          onStart={start}
          onPause={pause}
          onResume={resume}
          onRestart={start}
          onToggleMute={toggleMute}
        />
        <DPad onMove={move} disabled={state.phase !== 'playing'} />
        <Instructions />
      </main>

      <footer className="footer">Grid Rush · a tiny arcade game · built with React + Vite</footer>
    </div>
  );
}
