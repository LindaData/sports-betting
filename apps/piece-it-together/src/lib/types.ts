/** Piece-count presets offered on the setup screen. */
export type PiecePreset = 10 | 25 | 50 | 100

export const PIECE_PRESETS: readonly PiecePreset[] = [10, 25, 50, 100]

export interface Grid {
  rows: number
  cols: number
}

/** A processed, in-memory copy of the user's photo. */
export interface SourceImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
  /** Object URL of a JPEG preview (for <img> tags). */
  previewUrl: string
  name: string
}

/** Tab/blank shape parameters for one shared edge between two pieces. */
export interface EdgeShape {
  /** +1 bulges toward the positive axis (down / right), -1 the other way. */
  flip: 1 | -1
  a: number
  b: number
  c: number
  d: number
  e: number
}

/** Static description of one piece: where it belongs and what it looks like. */
export interface PieceDef {
  id: number
  row: number
  col: number
  /** SVG path in core-local coordinates (core top-left is 0,0). */
  path: string
}

/** Geometry of a generated puzzle, in world units (processed image pixels). */
export interface PuzzleSpec {
  rows: number
  cols: number
  /** Core piece width / height (without tabs). */
  pw: number
  ph: number
  /** Extra space around the core reserved for tabs and shadow. */
  pad: number
  imageW: number
  imageH: number
  pieces: PieceDef[]
}

/** Where the board sits in the world and how large the world is. */
export interface Layout {
  worldW: number
  worldH: number
  boardX: number
  boardY: number
}

/** Mutable, per-game piece state. Coordinates are the piece core centre. */
export interface PieceState {
  id: number
  x: number
  y: number
  /** Quarter turns clockwise, 0..3. */
  rot: number
  /** Pieces sharing a group id move together. */
  group: number
  locked: boolean
  z: number
}

export interface Point {
  x: number
  y: number
}
