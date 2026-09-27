/**
 * Tiny synthesised sound effects via Web Audio — no audio files needed.
 * The context is created lazily on the first user gesture (autoplay rules).
 */
type Sfx = 'pick' | 'drop' | 'snap' | 'join' | 'rotate' | 'hint' | 'complete'

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from a user gesture so iOS unlocks audio. */
export function unlockAudio(): void {
  if (enabled) context()
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

export function play(sfx: Sfx): void {
  if (!enabled) return
  const ac = context()
  if (!ac) return
  const t = ac.currentTime + 0.005
  switch (sfx) {
    case 'pick':
      tone(ac, 520, t, 0.06, 'sine', 0.05)
      break
    case 'drop':
      tone(ac, 240, t, 0.08, 'triangle', 0.07)
      break
    case 'rotate':
      tone(ac, 380, t, 0.05, 'triangle', 0.05)
      tone(ac, 460, t + 0.04, 0.05, 'triangle', 0.04)
      break
    case 'join':
      tone(ac, 330, t, 0.07, 'triangle', 0.09)
      tone(ac, 495, t + 0.05, 0.09, 'sine', 0.07)
      break
    case 'snap':
      tone(ac, 660, t, 0.07, 'triangle', 0.1)
      tone(ac, 990, t + 0.055, 0.12, 'sine', 0.08)
      break
    case 'hint':
      tone(ac, 880, t, 0.18, 'sine', 0.05)
      tone(ac, 1175, t + 0.1, 0.22, 'sine', 0.04)
      break
    case 'complete':
      ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(ac, f, t + i * 0.09, 0.35, 'sine', 0.08))
      break
  }
}
