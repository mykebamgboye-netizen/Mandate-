/* Deterministic state hash for golden replays (§3.4): stable JSON with sorted
   keys, BigInts as decimal strings, then FNV-1a over the result (x2 for a 64-bit feel). */
import { hash32 } from './rng'

function stable(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'bigint') return `"${value.toString()}" `
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return `"nonfinite:${value}"`
  return JSON.stringify(value)
}

export function stateHash(value: unknown): string {
  const s = stable(value)
  const a = hash32(s)
  const b = hash32(`${a}:${s.length}`)
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}
