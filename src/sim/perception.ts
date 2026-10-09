/* Perception update (§18.4): P[o,d](t+1) = (1−λ)·P[o,d](t) + η·Σ(v·c·β·m)
   Fixed-point only: all values in basis points (0..10000 = 0.00%..100.00%),
   computed in BigInt so browsers can never diverge in the last bits. */

export type BP = bigint // basis points, 0n..10000n

export interface PerceptionEvent {
  observer: string
  dimension: string
  /** visibility of the event to this group, bp (0..10000) */
  visibilityBp: BP
  /** channel trust for the carrying outlet, bp (0..10000) */
  channelBp: BP
  /** confirmation bias multiplier, bp (0..10000); 10000 = neutral */
  betaBp: BP
  /** impact on the dimension, bp (can be negative) */
  impactBp: BP
}

export const BP_FULL = 10000n
const HALF = 5000n

export interface UpdateParams {
  /** weekly decay λ, bp (e.g. 1500n = 15%) */
  lambdaBp: BP
  /** learning rate η, bp */
  etaBp: BP
}

export const DEFAULT_PARAMS: UpdateParams = { lambdaBp: 1500n, etaBp: 3000n }

const SCALE = BP_FULL

function clampBp(x: BP): BP {
  if (x < 0n) return 0n
  if (x > SCALE) return SCALE
  return x
}

/** Apply one week of events to a single belief. Pure; returns the new belief. */
export function updateBelief(
  priorBp: BP,
  events: readonly PerceptionEvent[],
  params: UpdateParams = DEFAULT_PARAMS,
): BP {
  // Σ (v·c·β·m) / 10^12  — all factors are bp (10^4), three of them + impact
  let weighted = 0n
  for (const e of events) {
    const product = e.visibilityBp * e.channelBp * e.betaBp * e.impactBp
    weighted += product / 1_000_000_000_000n // v·c·β are each /10^4 → term stays in m's bp
  }
  const decayed = priorBp * (SCALE - params.lambdaBp) / SCALE
  const learned = weighted * params.etaBp / SCALE
  return clampBp(decayed + learned)
}

/** Convenience: run a full week over a belief map keyed `${observer}|${dimension}`. */
export function updatePerception(
  beliefs: ReadonlyMap<string, BP>,
  events: readonly PerceptionEvent[],
  params: UpdateParams = DEFAULT_PARAMS,
): Map<string, BP> {
  const byKey = new Map<string, PerceptionEvent[]>()
  for (const e of events) {
    const k = `${e.observer}|${e.dimension}`
    const list = byKey.get(k)
    if (list) list.push(e)
    else byKey.set(k, [e])
  }
  const out = new Map<string, BP>()
  // stable iteration: sort keys so dictionary order never matters (§3.4)
  const keys = [...new Set([...beliefs.keys(), ...byKey.keys()])].sort()
  for (const k of keys) {
    out.set(k, updateBelief(beliefs.get(k) ?? HALF, byKey.get(k) ?? [], params))
  }
  return out
}

export function beliefKey(observer: string, dimension: string): string {
  return `${observer}|${dimension}`
}
