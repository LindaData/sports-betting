import { PIECE_PRESETS, type PiecePreset } from './types'

const PREFIX = 'piece-it-together:'

export interface BestRecord {
  timeMs: number
  moves: number
  date: string
}

export interface Settings {
  sound: boolean
  rotation: boolean
  preset: PiecePreset
}

const DEFAULT_SETTINGS: Settings = { sound: true, rotation: false, preset: 25 }

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode): the game still works.
  }
}

/** Best times are keyed by difficulty only — never by image. */
export function bestKey(preset: PiecePreset, rotation: boolean): string {
  return `best:${preset}${rotation ? ':rotation' : ''}`
}

export function getBest(preset: PiecePreset, rotation: boolean): BestRecord | null {
  const rec = read<BestRecord>(bestKey(preset, rotation))
  return rec && typeof rec.timeMs === 'number' && rec.timeMs > 0 ? rec : null
}

/** Save if faster than the current best. Returns true on a new record. */
export function recordResult(preset: PiecePreset, rotation: boolean, timeMs: number, moves: number): boolean {
  const current = getBest(preset, rotation)
  const plays = read<number>(`plays:${preset}`) ?? 0
  write(`plays:${preset}`, plays + 1)
  if (current && current.timeMs <= timeMs) return false
  write(bestKey(preset, rotation), { timeMs, moves, date: new Date().toISOString() })
  return true
}

export function getSettings(): Settings {
  const s = read<Partial<Settings>>('settings') ?? {}
  return {
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    rotation: typeof s.rotation === 'boolean' ? s.rotation : DEFAULT_SETTINGS.rotation,
    preset: PIECE_PRESETS.includes(s.preset as PiecePreset) ? (s.preset as PiecePreset) : DEFAULT_SETTINGS.preset,
  }
}

export function saveSettings(settings: Settings): void {
  write('settings', settings)
}
