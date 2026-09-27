import type { Grid } from './types'

/**
 * Pick rows × cols for a target piece count so that each piece is as close
 * to square as possible for the given image, while staying near the target
 * count. Cost = 4·ln²(piece aspect) + 10 × relative count error, so mildly
 * oblong pieces are fine but stretched ones are avoided.
 */
export function chooseGrid(target: number, imageW: number, imageH: number): Grid {
  const tolerance = Math.max(1, Math.round(target * 0.2))
  let best: Grid = { rows: 1, cols: target }
  let bestCost = Infinity

  for (let rows = 1; rows <= target + tolerance; rows++) {
    for (let cols = 1; cols <= target + tolerance; cols++) {
      const count = rows * cols
      if (Math.abs(count - target) > tolerance) continue
      if (rows < 2 || cols < 2) continue
      const pieceAspect = imageW / cols / (imageH / rows)
      const shapeCost = 4 * Math.log(pieceAspect) ** 2
      const countCost = (Math.abs(count - target) / target) * 10
      const cost = shapeCost + countCost
      if (cost < bestCost - 1e-9) {
        bestCost = cost
        best = { rows, cols }
      }
    }
  }
  return best
}

export const DIFFICULTY: Record<number, { label: string; blurb: string; level: number }> = {
  10: { label: 'Very easy', blurb: 'Casual — a quick warm-up', level: 1 },
  25: { label: 'Easy', blurb: 'Relaxed — a few minutes', level: 2 },
  50: { label: 'Medium', blurb: 'Focused — bring some patience', level: 3 },
  100: { label: 'Hard', blurb: 'Challenging — a proper puzzle', level: 4 },
}
