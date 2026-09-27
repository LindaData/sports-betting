import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { play } from '../lib/audio'
import { createGame, elapsedAt, gameReducer, type GameState } from '../lib/game'
import { getBest, recordResult, type BestRecord } from '../lib/storage'
import type { Layout, PiecePreset, PuzzleSpec } from '../lib/types'

const HINT_VISIBLE_MS = 2600

export interface CompletionInfo {
  timeMs: number
  moves: number
  isNewBest: boolean
  best: BestRecord | null
}

export interface PuzzleGame {
  state: GameState
  completion: CompletionInfo | null
  getElapsed: () => number
  drop: (id: number, dx: number, dy: number) => void
  rotate: (id: number) => void
  pause: () => void
  resume: () => void
  shuffle: () => void
  restart: () => void
  hint: () => void
  setRotation: (enabled: boolean) => void
  relayout: (layout: Layout, rescatter: boolean) => void
}

/**
 * Owns one game session: state machine, timer, hints, sound feedback,
 * completion detection and personal-best persistence.
 */
export function usePuzzleGame(
  spec: PuzzleSpec,
  initialLayout: Layout,
  preset: PiecePreset,
  rotation: boolean,
): PuzzleGame {
  const [state, dispatch] = useReducer(gameReducer, null, () =>
    createGame(spec, initialLayout, rotation, performance.now()),
  )
  const [completion, setCompletion] = useState<(CompletionInfo & { forMs: number }) | null>(null)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const getElapsed = useCallback(() => elapsedAt(stateRef.current, performance.now()), [])

  // Sound for each drop/snap/join/rotate.
  const feedback = state.feedback
  useEffect(() => {
    if (!feedback) return
    play(feedback.kind)
  }, [feedback])

  // Hints fade after a moment.
  const hint = state.hint
  useEffect(() => {
    if (!hint) return
    play('hint')
    const t = window.setTimeout(() => dispatch({ type: 'clearHint' }), HINT_VISIBLE_MS)
    return () => window.clearTimeout(t)
  }, [hint])

  // Completion: persist the result exactly once per finished game.
  const finalMs = state.finalMs
  const recordedFor = useRef<number | null>(null)
  useEffect(() => {
    if (finalMs === null || recordedFor.current === finalMs) return
    recordedFor.current = finalMs
    const moves = stateRef.current.moves
    const rot = stateRef.current.rotationThroughout
    const isNewBest = recordResult(preset, rot, finalMs, moves)
    // Persisting to localStorage is the external effect; show its outcome.
    // oxlint-disable-next-line react/set-state-in-effect
    setCompletion({ forMs: finalMs, timeMs: finalMs, moves, isNewBest, best: getBest(preset, rot) })
    window.setTimeout(() => play('complete'), 250)
  }, [finalMs, preset])

  // Pause automatically when the tab or app goes to the background.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) dispatch({ type: 'pause', now: performance.now() })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const actions = useMemo(
    () => ({
      drop: (id: number, dx: number, dy: number) => dispatch({ type: 'drop', id, dx, dy, now: performance.now() }),
      rotate: (id: number) => dispatch({ type: 'rotate', id, now: performance.now() }),
      pause: () => dispatch({ type: 'pause', now: performance.now() }),
      resume: () => dispatch({ type: 'resume', now: performance.now() }),
      shuffle: () => dispatch({ type: 'shuffle' }),
      restart: () => dispatch({ type: 'restart', now: performance.now() }),
      hint: () => dispatch({ type: 'hint', pick: Math.random() }),
      setRotation: (enabled: boolean) => dispatch({ type: 'setRotation', enabled }),
      relayout: (layout: Layout, rescatter: boolean) => dispatch({ type: 'relayout', layout, rescatter }),
    }),
    [],
  )

  const current = completion && completion.forMs === finalMs ? completion : null
  return { state, completion: current, getElapsed, ...actions }
}
