import { describe, it, expect } from 'vitest'
import { makeStream, makeStreams, randInt, hash32 } from './rng'
import { Ledger, nairaToKobo } from './ledger'
import { updateBelief, updatePerception, beliefKey, type PerceptionEvent } from './perception'
import { dispatch, type Command, ACTORS } from './bus'
import { createWorld, hashWorld, replay, stepWeek } from './world'
import { stateHash } from './hash'

describe('seed engine (§3.1)', () => {
  it('same seed → identical stream', () => {
    const a = makeStream(0xc0ffee, 'elections')
    const b = makeStream(0xc0ffee, 'elections')
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })
  it('subsystem streams are independent', () => {
    const s = makeStreams(0xc0ffee)
    const a = Array.from({ length: 20 }, () => s.get('crises')())
    const b = Array.from({ length: 20 }, () => s.get('media')())
    expect(a).not.toEqual(b)
  })
  it('different seeds diverge', () => {
    const a = makeStream(1, 'main'); const b = makeStream(2, 'main')
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })
  it('randInt stays in bounds', () => {
    const r = makeStream(7, 'main')
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 3, 9)
      expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(9)
    }
  })
})

describe('kobo ledger (§3.4)', () => {
  it('converts naira to kobo exactly', () => {
    expect(nairaToKobo('84,700,000').toString()).toBe('8470000000') // commas stripped first? no:
  })
  it('sums balances to zero (money is conserved)', () => {
    const l = new Ledger()
    l.transfer(1, '::mint', 'treasury', nairaToKobo('1,000'), 'open', 'sealed')
    l.transfer(2, 'treasury', 'contractor', nairaToKobo('400'), 'memo', 'public')
    expect(l.balance('treasury')).toBe(nairaToKobo('600'))
    expect(l.balance('contractor')).toBe(nairaToKobo('400'))
    expect(l.balancesSum()).toBe(0n)
    expect(l.conservation()).toBe(0n)
  })
  it('rejects non-positive and malformed amounts', () => {
    const l = new Ledger()
    expect(() => l.transfer(1, 'a', 'b', 0n, 'x')).toThrow()
    expect(() => nairaToKobo('12.345')).toThrow()
    expect(() => nairaToKobo('abc')).toThrow()
  })
})

describe('perception update (§18.4)', () => {
  const ev = (impact: bigint, beta = 10000n): PerceptionEvent => ({
    observer: 'the-people', dimension: 'closeness',
    visibilityBp: 10000n, channelBp: 10000n, betaBp: beta, impactBp: impact,
  })
  it('decays toward the prior with no events', () => {
    const p0 = updateBelief(8000n, [])
    expect(p0).toBe(6800n) // 8000 × (1 − 0.15)
    expect(updateBelief(0n, [])).toBe(0n)
    expect(updateBelief(10000n, [])).toBe(8500n)
  })
  it('positive events lift the belief above pure decay, clamped to 10000', () => {
    const withEvent = updateBelief(9000n, [ev(4000n)])
    const decayOnly = updateBelief(9000n, []) // 7650 after λ=15%
    expect(withEvent).toBeGreaterThan(decayOnly)
    expect(updateBelief(9900n, [ev(9000n)])).toBe(10000n)
  })
  it('confirmation bias amplifies belief-fitting events', () => {
    const neutral = updateBelief(5000n, [ev(1000n, 10000n)])
    const biased = updateBelief(5000n, [ev(1000n, 15000n)])
    expect(biased).toBeGreaterThan(neutral)
  })
  it('is order-independent across the belief map', () => {
    const beliefs = new Map([
      [beliefKey('a', 'x'), 4000n],
      [beliefKey('b', 'y'), 6000n],
    ])
    const events: PerceptionEvent[] = [
      { observer: 'b', dimension: 'y', visibilityBp: 10000n, channelBp: 8000n, betaBp: 10000n, impactBp: -500n },
      { observer: 'a', dimension: 'x', visibilityBp: 5000n, channelBp: 10000n, betaBp: 12000n, impactBp: 700n },
    ]
    const fwd = updatePerception(beliefs, events)
    const rev = updatePerception(beliefs, [...events].reverse())
    expect(stateHash([...fwd.entries()])).toBe(stateHash([...rev.entries()]))
  })
})

describe('command → event bus (§3.5)', () => {
  const fund = () => {
    const w = createWorld(42)
    return w
  }
  const sign = (id: string, amountNaira = '84,700,000'): Command => ({
    id, actorId: 'pc', type: 'SignMemo', week: 1,
    payload: { amountKobo: nairaToKobo(amountNaira), payee: 'halcyon', ref: 'GZ147' },
  })

  it('rejects commands without the office power (legality)', () => {
    const w = fund()
    const r = dispatch(w, { id: 'c1', actorId: 'agoro', type: 'SignMemo', week: 1, payload: sign('x').payload })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.stage).toBe('legality')
    expect(w.commandLog).toHaveLength(0) // rejected commands are not logged
  })
  it('rejects spending the treasury empty (feasibility)', () => {
    const w = fund()
    const r = dispatch(w, sign('c1', '999,999,999,999'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.stage).toBe('feasibility')
  })
  it('signs, logs and moves money', () => {
    const w = fund()
    const before = w.ledger.balance('treasury')
    const r = dispatch(w, sign('c1'))
    expect(r.ok).toBe(true)
    expect(w.ledger.balance('treasury')).toBe(before - nairaToKobo('84,700,000'))
    expect(w.commandLog).toHaveLength(1)
    expect(w.eventLog).toHaveLength(1)
    expect(w.eventLog[0].type).toBe('MemoSigned')
    expect(w.ledger.balancesSum()).toBe(0n)
  })
  it('emits party-visible promises and sealed intel', () => {
    const w = fund()
    const r1 = dispatch(w, { id: 'p1', actorId: 'pc', type: 'Promise', week: 1, payload: { to: 'agoro', terms: 'ticket', dueWeek: 8 } })
    const r2 = dispatch(w, { id: 'i1', actorId: 'pc', type: 'IntelBrief', week: 1, payload: { subject: 'agoro', qualityBp: 7000n } })
    expect(r1.ok && r1.events[0].visibility).toBe('party')
    expect(r2.ok && r2.events[0].visibility).toBe('sealed')
  })
})

describe('golden replay (§3.4)', () => {
  const SEED = 0xc0ffee
  // In the full sim these derive deterministically from the seed via subsystem
  // streams; in the skeleton they are passed explicitly to run() and replay().
  const PERCEPTION_EVENTS: PerceptionEvent[] = [
    { observer: 'the-people', dimension: 'closeness', visibilityBp: 8000n, channelBp: 7000n, betaBp: 11000n, impactBp: -300n },
  ]
  const script: Command[] = [
    { id: 'c1', actorId: 'pc', type: 'SignMemo', week: 1, payload: { amountKobo: nairaToKobo('84,700,000'), payee: 'halcyon', ref: 'GZ147' } },
    { id: 'c2', actorId: 'pc', type: 'SignMemo', week: 1, payload: { amountKobo: nairaToKobo('214,371,000'), payee: 'payroll', ref: 'FAAC-GAP' } },
    { id: 'c3', actorId: 'pc', type: 'Promise', week: 1, payload: { to: 'agoro', terms: 'works ticket silence', dueWeek: 12 } },
    { id: 'c4', actorId: 'coa', type: 'IntelBrief', week: 1, payload: { subject: 'agoro', qualityBp: 6500n } },
  ]
  const run = () => {
    const w = createWorld(SEED)
    for (const c of script) {
      const r = dispatch(w, c)
      if (!r.ok) throw r.why
    }
    stepWeek(w, PERCEPTION_EVENTS)
    return w
  }

  it('two runs from the same seed + log produce the same hash', () => {
    expect(hashWorld(run())).toBe(hashWorld(run()))
  })
  it('replay(seed, log) reproduces the live hash exactly', () => {
    const live = run()
    const re = replay(SEED, live.commandLog)
    stepWeek(re, PERCEPTION_EVENTS) // the week-step is a deterministic function of the log
    expect(hashWorld(re)).toBe(hashWorld(live))
  })
  it('matches the pinned golden hash', () => {
    expect(hashWorld(run())).toBe('895667a8d3df9d05')
  })
  it('a different seed changes the hash of an empty world only by seed', () => {
    expect(hashWorld(createWorld(1))).not.toBe(hashWorld(createWorld(2)))
  })
})

describe('hash stability (§3.4)', () => {
  it('key order does not matter', () => {
    expect(stateHash({ a: 1, b: 2 })).toBe(stateHash({ b: 2, a: 1 }))
  })
  it('bigint and number are not conflated', () => {
    expect(stateHash({ x: 1n })).not.toBe(stateHash({ x: 1 }))
  })
  it('hash32 is stable', () => {
    expect(hash32('mandate')).toBe(hash32('mandate'))
  })
})

// keep ACTORS referenced so the powers table stays exercised by import
void ACTORS
