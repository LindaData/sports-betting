const HIGH_SCORE_KEY = 'grid-rush:high-score';
const MUTED_KEY = 'grid-rush:muted';

// Storage can be unavailable (private mode, blocked cookies); the game must still run.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore: persistence is best-effort */
  }
}

export function loadHighScore(): number {
  const value = Number(read(HIGH_SCORE_KEY));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveHighScore(score: number): void {
  write(HIGH_SCORE_KEY, String(Math.floor(score)));
}

export function loadMuted(): boolean {
  return read(MUTED_KEY) === '1';
}

export function saveMuted(muted: boolean): void {
  write(MUTED_KEY, muted ? '1' : '0');
}
