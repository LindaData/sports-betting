import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { SoundEngine } from '../audio/sfx';
import { createInitialState, gameReducer } from '../game/engine';
import { MoveQueue } from '../game/moveQueue';
import { randomSeed } from '../game/random';
import { loadHighScore, loadMuted, saveHighScore, saveMuted } from '../game/storage';
import type { Direction } from '../game/types';

const TICK_MS = 50;
export const LEVEL_ADVANCE_MS = 3200;

/**
 * Owns the game state machine plus every side effect around it: the fixed
 * timestep loop, audio playback, persistence and auto-pause.
 */
export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState(randomSeed(), loadHighScore()),
  );
  const [muted, setMuted] = useState(loadMuted);
  const soundRef = useRef<SoundEngine | null>(null);
  const lastSoundId = useRef(0);
  const moves = useRef(new MoveQueue());
  const moveTimer = useRef<number | undefined>(undefined);

  const sound = useCallback(() => {
    if (!soundRef.current) soundRef.current = new SoundEngine();
    return soundRef.current;
  }, []);

  // Game loop: a steady tick that feeds real elapsed time into the reducer.
  useEffect(() => {
    if (state.phase !== 'playing') return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'TICK', dtMs: now - last });
      last = now;
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // Play any sounds the reducer queued since the last render.
  useEffect(() => {
    const engine = sound();
    engine.muted = muted;
    for (const event of state.sounds) {
      if (event.id <= lastSoundId.current) continue;
      lastSoundId.current = event.id;
      engine.play(event.kind);
    }
  }, [state.sounds, muted, sound]);

  useEffect(() => {
    saveHighScore(state.highScore);
  }, [state.highScore]);

  useEffect(() => {
    saveMuted(muted);
  }, [muted]);

  // Auto-pause when the tab is hidden so nobody dies while away.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Buffered moves never carry over into a pause, level change or game over.
  useEffect(() => {
    if (state.phase === 'playing') return;
    moves.current.clear();
    window.clearTimeout(moveTimer.current);
  }, [state.phase]);

  useEffect(() => () => window.clearTimeout(moveTimer.current), []);

  // Level-complete screen advances on its own after a short celebration.
  useEffect(() => {
    if (state.phase !== 'levelComplete') return;
    const id = window.setTimeout(() => dispatch({ type: 'NEXT_LEVEL' }), LEVEL_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [state.phase]);

  const start = useCallback(() => {
    sound().unlock();
    dispatch({ type: 'START', seed: randomSeed() });
  }, [sound]);

  // Drain the move buffer at a steady pace: run what is due now, then wake
  // up exactly when the next buffered step is allowed.
  const pump = useCallback(() => {
    const run = () => {
      window.clearTimeout(moveTimer.current);
      const queue = moves.current;
      const now = performance.now();
      const direction = queue.take(now);
      if (direction) dispatch({ type: 'MOVE', direction });
      const wait = queue.waitMs(now);
      if (Number.isFinite(wait)) moveTimer.current = window.setTimeout(run, wait);
    };
    run();
  }, []);

  const move = useCallback(
    (direction: Direction, isRepeat = false) => {
      moves.current.push(direction, isRepeat);
      pump();
    },
    [pump],
  );

  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const resume = useCallback(() => {
    sound().unlock();
    dispatch({ type: 'RESUME' });
  }, [sound]);
  const nextLevel = useCallback(() => dispatch({ type: 'NEXT_LEVEL' }), []);
  const toggleMute = useCallback(() => {
    sound().unlock();
    setMuted((m) => !m);
  }, [sound]);

  return { state, muted, start, move, pause, resume, nextLevel, toggleMute };
}
