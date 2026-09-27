import type { SoundKind } from '../game/types';

/**
 * Tiny Web Audio synth. Every effect is built from oscillators and gain
 * envelopes at play time, so the game ships with zero audio assets.
 */
type Wave = OscillatorType;

interface Note {
  freq: number;
  /** Optional glide target frequency. */
  to?: number;
  start: number;
  duration: number;
  wave: Wave;
  volume: number;
}

const SOUNDS: Record<SoundKind, Note[]> = {
  step: [{ freq: 220, to: 180, start: 0, duration: 0.05, wave: 'triangle', volume: 0.05 }],
  coin: [
    { freq: 988, start: 0, duration: 0.07, wave: 'square', volume: 0.12 },
    { freq: 1319, start: 0.07, duration: 0.14, wave: 'square', volume: 0.12 },
  ],
  hit: [
    { freq: 320, to: 70, start: 0, duration: 0.32, wave: 'sawtooth', volume: 0.2 },
    { freq: 160, to: 50, start: 0.02, duration: 0.3, wave: 'square', volume: 0.1 },
  ],
  level: [
    { freq: 523, start: 0, duration: 0.1, wave: 'triangle', volume: 0.18 },
    { freq: 659, start: 0.1, duration: 0.1, wave: 'triangle', volume: 0.18 },
    { freq: 784, start: 0.2, duration: 0.1, wave: 'triangle', volume: 0.18 },
    { freq: 1047, start: 0.3, duration: 0.28, wave: 'triangle', volume: 0.2 },
    { freq: 1568, start: 0.3, duration: 0.28, wave: 'sine', volume: 0.06 },
  ],
  gameOver: [
    { freq: 392, start: 0, duration: 0.22, wave: 'square', volume: 0.12 },
    { freq: 330, start: 0.22, duration: 0.22, wave: 'square', volume: 0.12 },
    { freq: 262, start: 0.44, duration: 0.22, wave: 'square', volume: 0.12 },
    { freq: 196, to: 98, start: 0.66, duration: 0.6, wave: 'sawtooth', volume: 0.14 },
  ],
  warp: [
    { freq: 300, to: 1200, start: 0, duration: 0.18, wave: 'sine', volume: 0.16 },
    { freq: 600, to: 2400, start: 0.03, duration: 0.16, wave: 'triangle', volume: 0.06 },
    { freq: 1500, to: 900, start: 0.18, duration: 0.12, wave: 'sine', volume: 0.08 },
  ],
  start: [
    { freq: 440, start: 0, duration: 0.08, wave: 'square', volume: 0.08 },
    { freq: 880, start: 0.08, duration: 0.14, wave: 'square', volume: 0.08 },
  ],
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture on some browsers (iOS Safari). */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  play(kind: SoundKind): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const note of SOUNDS[kind]) this.playNote(ctx, this.master, note, t0);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private playNote(ctx: AudioContext, out: AudioNode, note: Note, t0: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = t0 + note.start;
    const end = start + note.duration;
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.freq, start);
    if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
