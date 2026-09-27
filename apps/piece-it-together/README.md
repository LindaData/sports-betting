# Piece It Together

A browser jigsaw game: pick a photo from your phone or computer, choose 10 / 25 / 50 / 100 pieces, and put it back together.

Everything runs locally. The photo is decoded and resized in memory with File/Object URLs and Canvas. It is never uploaded. There is no backend, no account and no external API.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/ (relative base, works from any path)
npm run preview    # serve the production build
npm test           # engine unit tests (vitest)
npm run typecheck
npm run lint       # oxlint, warnings fail
```

## How it works

| Layer | File | Role |
|---|---|---|
| Grid | `src/lib/grid.ts` | Chooses rows × cols near the target count, keeping pieces close to square for the photo's aspect ratio. |
| Geometry | `src/lib/geometry.ts` | Seeded jigsaw cut. Each shared edge is a 3-segment Bézier tab, so neighbours interlock exactly. |
| Rendering | `src/lib/pieceRenderer.ts` | Draws each piece once to a canvas: the image clipped to the path, plus a baked shadow, bevel and outline. |
| Layout | `src/lib/layout.ts` | Sizes the table to the screen (board centred on desktop, board on top on phones) and scatters pieces into free slots. |
| Rules | `src/lib/game.ts` | Pure reducer covering moves, snapping, neighbour grouping, rotation, hints, shuffle, pause, timer and completion. |
| Hook | `src/hooks/usePuzzleGame.ts` | Connects the reducer to sound, hint timeout, auto-pause on tab hide and personal bests. |
| UI | `src/components/*` | `ImageUploader`, `PuzzleSetup`, `PuzzleBoard`, `PuzzlePiece`, `GameControls`, `Timer`, `CompletionScreen`. |

Performance notes for 100 pieces on phones:

- Pieces are pre-rendered bitmaps moved with GPU transforms.
- During a drag, the board updates the DOM directly and commits one reducer action on drop.
- Unchanged pieces keep their object identity, so memoised pieces skip re-rendering.
- Hit testing uses `isPointInPath` on the real piece outline. If that misses, it falls back to the nearest piece, which helps fingers.

## Gameplay

- **Mouse and touch:** drag pieces. With rotation on, tap a piece to turn it.
- **Zoom:** pinch or mouse wheel to zoom, drag empty space to pan, then use the fit button to reset.
- **Snapping:** a piece locks onto the board when it is dropped near its home and upright. Matching neighbours dropped next to each other join into a group that moves together.
- **Hint:** outlines where one piece goes. Each hint adds a 10 s penalty.
- **Other controls:** Shuffle, Guide (faint image and outlines on the board), Pause (also automatic when the tab is hidden), Restart, and sound and rotation toggles.
- **Personal bests:** stored in `localStorage` per piece count, and kept separately for games that had rotation on the whole time. They never depend on the image.
