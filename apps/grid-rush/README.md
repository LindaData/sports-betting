# Grid Rush

A small arcade strategy game for the browser. Steer your runner across a 10×10 grid, grab coins, dodge the hunters and reach the portal. Every level adds more walls, more coins and faster, smarter enemies, and the game keeps going until you run out of lives.

Built with React, TypeScript and Vite. No backend and no external assets. Graphics are CSS and inline SVG, and sound comes from the Web Audio API.

## Run it

```bash
cd apps/grid-rush
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build static files to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint (TypeScript and React Hooks rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests for the game engine |

The build uses a relative base (`./`), so you can drop `dist/` into any static host or subfolder.

## How to play

- **Move:** Arrow keys or WASD. On touch screens, use the on-screen pad (hold a button to keep moving).
- **Pause:** `P` / `Esc` · **Restart:** `R` · **Mute:** `M` · **Start / continue:** `Enter`
- The game pauses on its own when the tab is hidden.

### Scoring

| Event | Points |
|---|---|
| Coin | +25 |
| Reach the portal | +100 |
| Speed bonus | +10 for every second under the level's par time |

You start with 3 lives. If a hunter lands on your square, you lose a life, go back to the start and get a short shield. The high score and the mute setting are saved in `localStorage`.

## Difficulty curve

Levels are generated procedurally from a seeded RNG. Each level ramps up these values, and each one stops at a fixed cap:

| Stat | Level 1 | Per level | Cap |
|---|---|---|---|
| Walls | 10 | +3 | 34 |
| Hunters | 1 | +1 every 2 levels | 6 |
| Coins | 4 | +1 | 12 |
| Hunter step interval | 850 ms | −55 ms | 300 ms |
| Chance a hunter chases you | 20% | +6% | 75% |

Every level has a path from the start to the goal, and every coin can be reached. The generator checks both with a breadth-first search and throws away any layout that fails. Hunters spawn at least 6 steps away from the start and never enter walls, the portal or the start square.

## Code layout

```
src/
  game/            pure, framework-free game logic
    types.ts       shared types
    random.ts      seeded PRNG (mulberry32)
    grid.ts        grid helpers, BFS distance map and pathfinding
    level.ts       difficulty curve and procedural level generator
    enemies.ts     hunter movement (chase or wander)
    engine.ts      reducer: movement, collisions, scoring, lives, timer, phases
    storage.ts     localStorage persistence (fails safely)
    game.test.ts   engine tests
  audio/sfx.ts     Web Audio sound effects
  hooks/           useGame (loop, sound, persistence), useKeyboard
  components/      Board, Hud, Overlay, Controls, DPad, Instructions
```

The engine is a pure reducer: the RNG seed lives in state, so each state transition is deterministic and can be tested without a browser. The React layer only feeds in time and input, and plays the sound events the reducer queues.
