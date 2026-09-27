/** CSS transform placing an element of size w×h so its centre is at (x, y). */
export function pieceTransform(x: number, y: number, w: number, h: number, angle: number, lift = false): string {
  return `translate3d(${x - w / 2}px, ${y - h / 2}px, 0) rotate(${angle}deg)${lift ? ' scale(1.05)' : ''}`
}
