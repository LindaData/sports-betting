# Chess Ascension

A roguelike chess game for the browser. Win a game, pick one of three **Reinforcements** that rewrite how your pieces move, then face a stronger computer. One loss ends the run.

**Play:** https://lindadata.github.io/sports-betting/chess-ascension/

Built with React, TypeScript, Vite and plain CSS. No backend: best round, best run and lifetime stats are saved in `localStorage`.

## Run it

```bash
cd apps/chess-ascension
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/ (relative paths, works from any subfolder)
```

The Pages workflow rebuilds the game into `docs/chess-ascension/` on every push to `main`. The committed copy there is a fallback.

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript project check (app, config and e2e) |
| `npm run lint` | ESLint (typescript-eslint + React hooks rules) |
| `npm test` | Unit tests: perft suites, a differential test against chess.js, every reinforcement, AI sanity |
| `npm run e2e` | Builds, starts `vite preview`, and plays real games in headless Chromium through the UI |

`npm run e2e` looks for Chromium at `/opt/pw-browsers/...`; set `CHROME_PATH` to use another Chrome/Chromium binary.

## How it's built

```
src/engine/   Chess rules. 0x88 board, make/unmake, Zobrist hashing, SAN.
              Move generation reads a compiled RuleSet, so reinforcements change movement
              without special cases. Every move, including reinforcement moves, must leave
              the mover's king safe.
src/ai/       Alpha-beta search (iterative deepening, quiescence, transposition table,
              killer/history ordering) running in a Web Worker. It uses the same RuleSet,
              so it understands and fears your upgraded pieces.
src/game/     Reinforcement definitions, the Match wrapper (abilities, Second Wind rewind,
              draw detection), run progression and localStorage persistence.
src/components, src/screens   React UI.
```

**Why a custom engine, not chess.js at runtime or Stockfish?** Reinforcements change how pieces move (for example, a queen that jumps like a knight, or a king with knight moves). Stockfish and chess.js only know standard chess, so they can't generate those moves or judge king safety against them. chess.js is used as a test oracle instead: in standard chess, the custom engine's legal moves must match chess.js exactly. It also passes the standard perft suites.

### Difficulty

The ELO shown is a progression label: 400 in round 1, +100 per round up to 2200 in round 19, then +250 per round. What actually changes is the search: below 800 the computer looks one move ahead with heavy random noise and frequent deliberate mistakes; from there the depth cap rises (about 6–7 plies above 2400), the time budget grows from 0.5 s to 3.2 s, and the noise and mistakes shrink to zero by about 2000 ELO. Tiers: Beginner (below 1250), Intermediate (below 1700), Advanced (up to 2200), Expert (2450+), Grandmaster (2700+).

### Adding a Reinforcement

Add an entry to `REINFORCEMENTS` in `src/game/reinforcements.ts`:

```ts
{
  id: 'rook-sprint',
  name: 'Rook Sprint',
  description: 'Your rooks may also jump two squares diagonally.',
  impact: 'Rooks hop over blockers on the diagonal.',
  rarity: 'common',
  kind: 'movement',
  icon: { piece: ROOK, badge: 'jump' },
  piece: ROOK,
  stackable: false,
  maxStacks: 1,
  apply: (r) => r.addLeaps(ROOK, [34, 30, -30, -34], 'rook-sprint'),
}
```

Movement changes (`addLeaps`, `addSlides`, `addPromotion`) and existing rule fields (`momentum`, `pawnArmor`, `queensGuard`, ability charges, …) work at once in move generation, check detection, the AI and the UI hints. A new kind of rule needs one new `SideRules` field, handled once in `Position`.
