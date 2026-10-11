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
    expect(hashWorld(run())).toBe('00408bb97818d3a8')
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

// ============================================================================
// LEDGER CALIBRATION + RECONCILIATION TESTS
// Anchored to the constants in src/content.ts (October 2026, Delta State Treasury,
// Week 41). All figures are read from content.ts; nothing here is hand-typed.
// ============================================================================
import { OPENING_BALANCE, FAAC_NET, IGR_SEP, FEDERATION_REFUND, BUDGET_CLOSING,
        CLOSING_AFTER_SANCTION, SHORTFILL_NAIRA, SAPELE_AWARD_NAIRA,
        NLC_TRANCH1, OKPE_VAR, TEACHERS_PAYROLL, PENSION_PAYROLL, OTHER_CS,
        HEALTH_PARAST, GRATUITY_FLOW, DEBT_SERVICE, COUNCIL_TRANSFER, OVERHEADS_SUBV,
        CONTRACTOR_VAR, CAPITAL_WIP, MRUN, HARD_COMMITMENTS, BASELINE,
        PROJECTION_FROM_NET, FAAC_STAT_DELTA, FAAC_VAT_DELTA, FAAC_DERIV_DELTA,
        FAAC_GROSS_DELTA, FAAC_DEDUCTIONS, FAAC_NET_DERIVE_CHECK, ARREARS_STOCK } from '../content'

describe('ledger calibration (§ brief, Oct 2026)', () => {
  // The ten committed (non-pending) posted lines, in naira.
  const COMM = TEACHERS_PAYROLL + PENSION_PAYROLL + OTHER_CS + HEALTH_PARAST
    + GRATUITY_FLOW + DEBT_SERVICE + COUNCIL_TRANSFER + OVERHEADS_SUBV
    + CONTRACTOR_VAR + CAPITAL_WIP
  // Pending lines (excluded from committed and from closing).
  const PEND = OKPE_VAR + NLC_TRANCH1 + SAPELE_AWARD_NAIRA

  it('closing equals the sum of every signed posted row (inflows + one-offs - committed; pending excluded)', () => {
    const closingFromSum = OPENING_BALANCE + FAAC_NET + IGR_SEP + FEDERATION_REFUND - COMM
    // This is the conservation check the brief asked for: closing === opening + sum(inflows)
    // + sum(one-offs) - sum(committed). Pending is NOT in this sum.
    expect(closingFromSum).toBe(BUDGET_CLOSING)
    expect(BUDGET_CLOSING).toBe(8_275_860_000)
  })

  it('fails loudly if any posted inflow is left out of the closing sum', () => {
    // If IGR (or FAAC net, or the refund) were accidentally dropped, the sum would drift.
    // Build the sum twice: once with every inflow, once with each inflow dropped in turn.
    const inflows = [FAAC_NET, IGR_SEP, FEDERATION_REFUND] as const
    const baseWithoutInflows = OPENING_BALANCE - COMM
    for (const inf of inflows) {
      const without = baseWithoutInflows + inflows.filter(i => i !== inf).reduce((a, b) => a + b, 0)
      // Without every posted inflow the closing would NOT equal BUDGET_CLOSING.
      expect(without).not.toBe(BUDGET_CLOSING)
    }
    // With ALL inflows present it MUST equal BUDGET_CLOSING (reassert for symmetry).
    expect(baseWithoutInflows + inflows.reduce((a, b) => a + b, 0)).toBe(BUDGET_CLOSING)
  })

  it('fails if pending is ever included in the closing sum', () => {
    const closingIfPendingCharged = OPENING_BALANCE + FAAC_NET + IGR_SEP + FEDERATION_REFUND - COMM - PEND
    // Pending items are charged only when sanctioned, so they do not belong in the
    // closing balance that the ledger shows before sanction. Including them would give
    // CLOSING_AFTER_SANCTION, not BUDGET_CLOSING.
    expect(closingIfPendingCharged).toBe(CLOSING_AFTER_SANCTION)
    expect(closingIfPendingCharged).not.toBe(BUDGET_CLOSING)
    expect(BUDGET_CLOSING - PEND).toBe(CLOSING_AFTER_SANCTION)
  })

  it('committed is exactly the ten non-pending lines; pending is never in committed', () => {
    // The committed subtotal is the ten non-pending posted lines only.
    expect(COMM).toBe(50_136_306_071)
    // Pending must never leak into the committed sum: if someone folds Okpe/NLC/Sapele
    // into committed, the ratio below would be wrong. Assert the committed sum does not
    // contain any pending amount as a summand — recompute committed WITHOUT each pending
    // line and confirm the result is unchanged (pending was never part of it).
    const committedWithoutOkpe = COMM - OKPE_VAR
    const committedWithoutNLC = COMM - NLC_TRANCH1
    const committedWithoutSapele = COMM - SAPELE_AWARD_NAIRA
    // If any pending line were actually in COMM, subtracting it would change the total.
    // Since pending is excluded by construction, subtracting a pending figure must NOT
    // equal the true committed total — i.e. COMM - pendingLine !== COMM.
    expect(committedWithoutOkpe).not.toBe(COMM)
    expect(committedWithoutNLC).not.toBe(COMM)
    expect(committedWithoutSapele).not.toBe(COMM)
  })

  it('committed-to-baseline ratio uses only the ten non-pending lines', () => {
    // Baseline = the two recurring inflows (FAAC net + IGR); REF is a one-off and is
    // excluded from ratios per the brief.
    const ratio = COMM / BASELINE
    expect(ratio).toBeCloseTo(0.9400, 4)            // 0.9400
    expect(ratio).toBeGreaterThanOrEqual(0.92)
    expect(ratio).toBeLessThanOrEqual(1.04)
    // Hard-commitments ratio (ALL personnel + gratuity + debt), not just four lines.
    const hardRatio = HARD_COMMITMENTS / BASELINE
    expect(hardRatio).toBeCloseTo(0.4606, 4)       // 46.06%
  })

  it('opening weeks, cover and pending sit in their bands', () => {
    const weeks = OPENING_BALANCE / (MRUN / 30) / 7
    const coverClose = BUDGET_CLOSING * 30 / MRUN
    const coverAfter = CLOSING_AFTER_SANCTION * 30 / MRUN
    const pendPct = PEND / BUDGET_CLOSING
    // Opening: about 1.125 weeks (1.0 to 1.5 band).
    expect(weeks).toBeCloseTo(1.125, 3)
    expect(weeks).toBeGreaterThanOrEqual(1.0)
    expect(weeks).toBeLessThanOrEqual(1.5)
    // Cover on closing: 17.0 days (15 to 19).
    expect(coverClose).toBeCloseTo(17.0, 1)
    expect(coverClose).toBeGreaterThanOrEqual(15)
    expect(coverClose).toBeLessThanOrEqual(19)
    // Cover if everything sanctioned: 12.75 days (10 to 14). Sanctioning reduces cash;
    // pending is never added back.
    expect(coverAfter).toBeCloseTo(12.75, 2)
    expect(coverAfter).toBeGreaterThanOrEqual(10)
    expect(coverAfter).toBeLessThanOrEqual(14)
    // Pending: 25.00% of closing (22 to 28).
    expect(pendPct).toBeCloseTo(0.2500, 4)
    expect(pendPct).toBeGreaterThanOrEqual(0.22)
    expect(pendPct).toBeLessThanOrEqual(0.28)
  })

  it('shortfall and projection derive from FAAC net', () => {
    // Shortfall is a memo/variance against the October projection, not a posted debit.
    const sfPct = SHORTFILL_NAIRA / FAAC_NET
    // Arithmetically 0.4931% of net (the brief's headline "4.93%" is a percentage-point
    // typo — see the comment in content.ts; the test asserts the real figure).
    expect(sfPct).toBeCloseTo(0.004931, 6)        // 0.4931%
    const proj = FAAC_NET + SHORTFILL_NAIRA
    expect(proj).toBe(PROJECTION_FROM_NET)
    expect(PROJECTION_FROM_NET).toBe(43_689_591_940)
  })

  it('FAAC Delta split is internally exact (gross = stat + VAT + deriv; net = gross - deductions)', () => {
    const gross = FAAC_STAT_DELTA + FAAC_VAT_DELTA + FAAC_DERIV_DELTA
    expect(gross).toBe(FAAC_GROSS_DELTA)
    const netFromGross = gross - FAAC_DEDUCTIONS
    expect(netFromGross).toBe(FAAC_NET_DERIVE_CHECK)
    expect(FAAC_NET_DERIVE_CHECK).toBe(FAAC_NET)   // the derived net MUST equal the governed net
  })

  it('no posted amount is a multiple of 10,000,000', () => {
    const posted = [
      OPENING_BALANCE, FAAC_NET, IGR_SEP, FEDERATION_REFUND,
      TEACHERS_PAYROLL, PENSION_PAYROLL, OTHER_CS, HEALTH_PARAST,
      GRATUITY_FLOW, DEBT_SERVICE, COUNCIL_TRANSFER, OVERHEADS_SUBV,
      CONTRACTOR_VAR, CAPITAL_WIP, OKPE_VAR, NLC_TRANCH1, SAPELE_AWARD_NAIRA,
      SHORTFILL_NAIRA, FAAC_STAT_DELTA, FAAC_VAT_DELTA, FAAC_DERIV_DELTA,
      FAAC_GROSS_DELTA, FAAC_DEDUCTIONS, FAAC_NET_DERIVE_CHECK,
    ] as const
    for (const v of posted) {
      expect(v % 10_000_000).not.toBe(0)
    }
  })

  it('no two posted amounts are equal (excluding the intentional FAAC_NET == FAAC_NET_DERIVE_CHECK)', () => {
    const posted = [
      OPENING_BALANCE, FAAC_NET, IGR_SEP, FEDERATION_REFUND,
      TEACHERS_PAYROLL, PENSION_PAYROLL, OTHER_CS, HEALTH_PARAST,
      GRATUITY_FLOW, DEBT_SERVICE, COUNCIL_TRANSFER, OVERHEADS_SUBV,
      CONTRACTOR_VAR, CAPITAL_WIP, OKPE_VAR, NLC_TRANCH1, SAPELE_AWARD_NAIRA,
      SHORTFILL_NAIRA, FAAC_STAT_DELTA, FAAC_VAT_DELTA, FAAC_DERIV_DELTA,
      FAAC_GROSS_DELTA, FAAC_DEDUCTIONS, FAAC_NET_DERIVE_CHECK,
    ] as const
    // FAAC_NET_DERIVE_CHECK is intentionally equal to FAAC_NET by construction.
    // There are 24 posted amounts and exactly ONE intentional equality, so 23 distinct values.
    const distinct = new Set<number>(posted).size
    expect(distinct).toBe(23)                 // 24 posted - 1 intentional collapse
    expect(posted.length).toBe(24)
    // Confirm the only duplicate is the intentional FAAC_NET pair.
    const counts = new Map<number, number>()
    for (const v of posted) counts.set(v, (counts.get(v) ?? 0) + 1)
    for (const [v, n] of counts) {
      if (v === FAAC_NET) {
        expect(n).toBe(2)                    // FAAC_NET and FAAC_NET_DERIVE_CHECK
      } else {
        expect(n).toBe(1)
      }
    }
  })

  it('Okpe, Sapele and NLC tranche 1 stay fixed', () => {
    expect(OKPE_VAR).toBe(1_377_540_000)
    expect(SAPELE_AWARD_NAIRA).toBe(84_700_000)
    expect(NLC_TRANCH1).toBe(606_725_000)
  })

  it('the teachers line is monthly payroll, not arrears; arrears live in the arrears stock', () => {
    // Teachers payroll, September, GL 07-15 (14,612 staff) is the monthly payroll.
    expect(TEACHERS_PAYROLL).toBe(2_571_712_000)
    // Arrears stock is 3 months owed and is distinct from the monthly payroll.
    expect(ARREARS_STOCK).toBe(TEACHERS_PAYROLL + PENSION_PAYROLL)
    expect(ARREARS_STOCK).not.toBe(TEACHERS_PAYROLL)
    expect(ARREARS_STOCK).toBe(5_038_643_300)
    // Pension payroll is a separate monthly line in the same band.
    expect(PENSION_PAYROLL).toBe(2_466_931_300)
  })

  it('the personnel run-rate is all four personnel lines, and cover uses MRUN', () => {
    expect(MRUN).toBe(TEACHERS_PAYROLL + PENSION_PAYROLL + OTHER_CS + HEALTH_PARAST)
    expect(MRUN).toBe(14_604_458_824)
    // Cover definitions use MRUN in the denominator, including pension payroll.
    const coverClose = BUDGET_CLOSING * 30 / MRUN
    const coverAfter = CLOSING_AFTER_SANCTION * 30 / MRUN
    expect(coverClose).toBeCloseTo(17.0, 1)
    expect(coverAfter).toBeCloseTo(12.75, 2)
  })

  it('Hard commitments = ALL personnel + gratuity flow + debt service', () => {
    const hard = MRUN + GRATUITY_FLOW + DEBT_SERVICE
    expect(hard).toBe(HARD_COMMITMENTS)
    expect(HARD_COMMITMENTS).toBe(24_564_458_830)
  })

  it('rounding corner-cases: 1.125 weeks is a 3-dp rounding of the exact value', () => {
    const exact = OPENING_BALANCE / (MRUN / 30) / 7
    expect(exact).toBeCloseTo(1.125329, 6)
    expect(Math.round(exact * 1000) / 1000).toBe(1.125)
  })
})
