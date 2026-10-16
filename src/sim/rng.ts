/* Seed engine (§3.1): one master seed, PCG-style streams derived per subsystem
   so adding a feature never reshuffles another subsystem's dice.
   sfc32 — small fast chaotic PRNG, deterministic across JS engines. */

export type StreamName =
  | 'main' | 'elections' | 'crises' | 'characters' | 'media' | 'judiciary'

export const STREAM_NAMES: StreamName[] = [
  'main', 'elections', 'crises', 'characters', 'media', 'judiciary',
]

/** FNV-1a 32-bit — stable string→u32 hash for stream derivation. */
export function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** sfc32 generator. Returns uint32 draws. */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return t >>> 0
  }
}

function warmup(next: () => number): () => number {
  for (let i = 0; i < 12; i++) next()
  return next
}

/** Derive one independent stream per subsystem from the master seed. */
export function makeStream(seed: number, name: StreamName): () => number {
  const s = seed >>> 0
  const h = hash32(`${s}:${name}`)
  return warmup(sfc32(h, hash32(`${name}:x`), hash32(`${name}:y`), h ^ 0x9e3779b9))
}

export interface Streams { get(name: StreamName): () => number }

export function makeStreams(seed: number): Streams {
  const map = new Map<StreamName, () => number>()
  for (const n of STREAM_NAMES) map.set(n, makeStream(seed, n))
  return { get: (name) => map.get(name)! }
}

/** Integer draw in [lo, hi] inclusive. */
export function randInt(next: () => number, lo: number, hi: number): number {
  return lo + (next() % (hi - lo + 1))
}

/** Uniform index in [0, n). Deterministic and integer-only. */
export function pickIndex(next: () => number, n: number): number {
  if (n <= 0) throw new Error('pickIndex needs a positive range')
  return next() % n
}

/** One element of a non-empty list. */
export function pick<T>(next: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from an empty list')
  return items[pickIndex(next, items.length)]
}

/** Probability test in basis points (0..10000). 10000 = always. */
export function chanceBp(next: () => number, bp: number): boolean {
  return next() % 10000 < bp
}

/** Copy of a list in a deterministic shuffled order (Fisher–Yates). */
export function shuffled<T>(next: () => number, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(next, i + 1)
    const tmp = out[i]!; out[i] = out[j]!; out[j] = tmp
  }
  return out
}

/** Derive a named integer sub-seed from a master seed — for generators that want
    their own stream (e.g. the NPC cast) without widening the StreamName union. */
export function subSeed(seed: number, name: string): number {
  return hash32(`${seed >>> 0}:${name}`)
}
