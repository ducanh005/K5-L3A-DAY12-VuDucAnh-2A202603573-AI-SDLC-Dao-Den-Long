/**
 * Deterministic Mulberry32 PRNG utilities for reproducible headless simulation.
 */

export function normalizeSeed(seed: number): number {
  return (seed >>> 0) || 1;
}

/**
 * Advances a 32-bit PRNG state and returns [valueIn0To1, nextState].
 */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  const nextState = t >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextState];
}

export function nextRange(state: number, min: number, max: number): [number, number] {
  const [u, nextState] = nextRandom(state);
  return [min + u * (max - min), nextState];
}
