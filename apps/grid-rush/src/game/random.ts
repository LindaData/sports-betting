/**
 * Small seeded PRNG (mulberry32). Game state carries the seed so every
 * reducer transition is deterministic and replayable.
 */
export interface Rng {
  next: () => number;
  int: (maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: T[]) => T[];
  seed: () => number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive);

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[int(items.length)] as T;
  };

  const shuffle = <T,>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [items[i], items[j]] = [items[j] as T, items[i] as T];
    }
    return items;
  };

  return { next, int, pick, shuffle, seed: () => state };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
