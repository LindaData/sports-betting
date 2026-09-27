import { useEffect, useState } from 'react'
import { formatTime } from '../lib/format'

interface Props {
  getElapsed: () => number
  running: boolean
}

/** Self-updating clock; re-renders only itself, not the board. */
export function Timer({ getElapsed, running }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), 250)
    return () => window.clearInterval(id)
  }, [running])
  const ms = getElapsed()
  return (
    <time className="timer" data-testid="timer" aria-label="Elapsed time">
      {formatTime(ms)}
    </time>
  )
}
