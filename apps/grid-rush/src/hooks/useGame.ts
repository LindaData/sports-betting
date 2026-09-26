import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { SoundEngine } from '../audio/sfx';
import { createInitialState, gameReducer } from '../game/engine';
import { randomSeed } from '../game/random';
import { loadHighScore, loadMuted, saveHighScore, saveMuted } from '../game/storage';
import type { Direction } from '../game/types';

const TICK_MS = 50;
const MIN_MOVE_GAP_MS = 75;
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
  const lastMoveAt = useRef(0);

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

  const move = useCallback((direction: Direction) => {
    const now = performance.now();
    if (now - lastMoveAt.current < MIN_MOVE_GAP_MS) return;
    lastMoveAt.current = now;
    dispatch({ type: 'MOVE', direction });
  }, []);

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
