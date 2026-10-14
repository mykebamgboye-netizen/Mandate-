/* The desk must be whatever seat the player took. These tests hold that line: a scenario for
   every one of the four playable offices, a governor for each of the 36 states plus the FCT,
   the ledger's arithmetic at every tier, and a guard that no file on a Kano or Rivers desk
   still says Delta. */

import { describe, expect, it } from 'vitest'
import { buildWeek } from './week'
import { deriveScenario } from './derive'
import { scaleFor } from './money'
import { PLACES } from './places'
import { PLAYABLE_OFFICES } from '../profile/playable-offices'
import { FEDERATION_STATES } from '../profile/client'
import { scenarioInputFromFirstOpen, type FirstOpenChoices } from './first-open'
import { bootTarget } from './boot'
import type { Scenario, ScenarioInput } from './types'

const input = (over: Partial<ScenarioInput> = {}): ScenarioInput => ({
  name: 'A. B. Testname',
  age: 52,
  pronouns: null,
  officeId: 'state/governor',
  tier: 'state',
  post: 'Governor',
  route: 'elected',
  stateCode: 'KN',
  lgaName: null,
  partyCode: 'APC',
  termStart: '2026-05-29',
  ...over,
})

const everyString = (value: unknown): string => JSON.stringify(value)

describe('the scenario is derived from the player’s own record', () => {
  it('gives the governor of each state that state’s seat, zones and towns', () => {
    for (const st of FEDERATION_STATES) {
      if (st.tier === 'fct') continue
      const s = deriveScenario(input({ stateCode: st.code, stateName: st.name, capital: st.capital }))
      expect(s.seat).toBe(st.capital)
      expect(s.jurisdictionName).toBe(`${st.name} State`)
      expect(s.calendar.weekLine).toBe(`EXCO WEEK 41 · ${st.capital.toUpperCase()}`)
      expect(s.zones).toEqual(PLACES[st.code].districts)
      expect(s.towns).toEqual(PLACES[st.code].towns)
      expect(s.w.cabinet).toBe(`${st.name.toUpperCase()} STATE EXECUTIVE COUNCIL`)
      expect(s.w.chamber).toBe(`${st.name.toUpperCase()} STATE HOUSE OF ASSEMBLY`)
    }
  })

  it('reads the calendar off the world clock instead of printing it', () => {
    const s = deriveScenario(input())
    expect(s.calendar.weekNumber).toBe(41)
    expect(s.calendar.year).toBe(2026)
    expect(s.calendar.dayLine).toBe('THURSDAY · 8 OCTOBER 2026')
    expect(s.calendar.monthLabel).toBe('OCTOBER 2026')
    // the world's deadlines are the desk date + 7 / +12 / +13 days, derived
    expect(s.calendar.deadlines.map(d => d.iso)).toEqual(['2026-10-15', '2026-10-20', '2026-10-21'])
    expect(s.calendar.deadlineLine).toBe('ASUU ultimatum 15 Oct · NLC window closes 20 Oct · FAAC drops 21 Oct')
    expect(s.calendar.filedLine).toContain('WEEK 41')
  })

  it('derives the term line from the inauguration and the tier’s term length', () => {
    const gov = deriveScenario(input())
    expect(gov.term.monthsInOffice).toBe(4)
    expect(gov.term.line).toBe('FIRST TERM · 4 MONTHS IN · GUBERNATORIAL POLL 40 MONTHS AWAY')
    const chair = deriveScenario(input({
      officeId: 'local/chairman', tier: 'local', post: 'Chairman, Local Government',
      lgaName: 'Wudil', termStart: '2026-07-01',
    }))
    expect(chair.term.line).toBe('FIRST TERM · 3 MONTHS IN · COUNCIL POLL 29 MONTHS AWAY')
    const min = deriveScenario(input({
      officeId: 'fct/minister', tier: 'fct', post: 'Minister of the Federal Capital Territory',
      route: 'appointed', stateCode: 'FC', termStart: '2026-06-01',
    }))
    expect(min.term.monthsToPoll).toBeNull()
    expect(min.term.line).toContain('APPOINTED SEAT')
  })

  it('takes each office into its own institutions', () => {
    const expectations: Record<string, string[]> = {
      'federal/president': ['FEC WEEK 41 · ABUJA', 'FEDERAL EXECUTIVE COUNCIL', 'NATIONAL ASSEMBLY', 'the presidency'],
      'state/governor': ['EXCO WEEK 41 · ' , 'STATE EXECUTIVE COUNCIL', 'HOUSE OF ASSEMBLY', 'ss.121–125'],
      'fct/minister': ['FCTA WEEK 41 · ABUJA', 'FCT EXECUTIVE COMMITTEE', 'FEDERAL CAPITAL TERRITORY', 's.299'],
      'local/chairman': ['COUNCIL WEEK 41 · WUDIL', 'WUDIL COUNCIL MEETING', 'WUDIL LEGISLATIVE COUNCIL', 's.7 & s.162(6)'],
    }
    for (const office of PLAYABLE_OFFICES) {
      const s = deriveScenario(input({
        officeId: office.id,
        tier: office.tier,
        post: office.post,
        route: office.route === 'elected' ? 'elected' : 'appointed',
        stateCode: office.tier === 'local' ? 'KN' : office.tier === 'state' ? 'KN' : 'FC',
        lgaName: office.tier === 'local' ? 'Wudil' : null,
      }))
      const blob = everyString(buildWeek(s))
      for (const needle of expectations[office.id]) {
        expect(blob, `${office.id} should show ${needle}`).toContain(needle)
      }
    }
  })

  it('keeps the analog world’s own seats out of a desk that is not theirs', () => {
    const cases: ScenarioInput[] = [
      input(),
      input({ officeId: 'federal/president', tier: 'federal', post: 'President', route: 'elected', stateCode: 'FC', stateName: null, termStart: '2026-05-29' }),
      input({ officeId: 'fct/minister', tier: 'fct', post: 'Minister of the Federal Capital Territory', route: 'appointed', stateCode: 'FC', termStart: '2026-06-01' }),
      input({ officeId: 'local/chairman', tier: 'local', post: 'Chairman, Local Government', lgaName: 'Wudil', termStart: '2026-07-01' }),
      input({ stateCode: 'RI', stateName: 'Rivers', capital: 'Port Harcourt' }),
      input({ stateCode: 'LA', stateName: 'Lagos', capital: 'Ikeja' }),
    ]
    for (const c of cases) {
      // 'Niger Delta' is a real region, not this desk's seat, so it is not a leak.
      const blob = everyString(buildWeek(deriveScenario(c))).replace(/Niger Delta/g, 'the region')
      expect(blob).not.toMatch(/\bDelta\b|\bAsaba\b|Bamgboye/)
    }
  })

  it('gives an oil seat its derivation and a non-oil seat the nil line', () => {
    const delta = deriveScenario(input({ stateCode: 'DT', stateName: 'Delta', capital: 'Asaba' }))
    const kano = deriveScenario(input())
    const deltaFaac = buildWeek(delta).docs.find(d => d.kind === 'faac')!
    const kanoFaac = buildWeek(kano).docs.find(d => d.kind === 'faac')!
    expect(JSON.stringify(deltaFaac)).toContain('13% Derivation tranche')
    expect(JSON.stringify(kanoFaac)).toContain('nil — this seat is not an oil-mineral one')
    // …and the digest's third item follows the same fact
    expect(JSON.stringify(buildWeek(delta).docs)).toContain('PIPELINE — TRUNKLINE')
    expect(JSON.stringify(buildWeek(kano).docs)).toContain('TRUNK ROAD — TANKER INCIDENT')
  })

  it('hands an appointed seat a mandate instead of an election petition', () => {
    const min = buildWeek(deriveScenario(input({
      officeId: 'fct/minister', tier: 'fct', post: 'Minister of the Federal Capital Territory',
      route: 'appointed', stateCode: 'FC', termStart: '2026-06-01',
    })))
    expect(min.docs.some(d => d.id === 'mandate-note')).toBe(true)
    expect(min.docs.some(d => d.id === 'tribunal-summons')).toBe(false)
    const gov = buildWeek(deriveScenario(input()))
    expect(gov.docs.some(d => d.id === 'tribunal-summons')).toBe(true)
    expect(gov.docs.some(d => d.id === 'mandate-note')).toBe(false)
  })

  it('names the desk after the party the player chose', () => {
    const s = deriveScenario(input({ partyCode: 'NRA', partyName: 'National Renewal Alliance' }))
    const pack = buildWeek(s)
    const chair = pack.allies.find(a => a.id === 'danjuma')!
    expect(chair.office).toBe('State Chairman, National Renewal Alliance')
  })
})

describe('the first-open choices are the desk’s record', () => {
  const wizardChoices = (officeId: string): FirstOpenChoices => {
    const office = PLAYABLE_OFFICES.find(o => o.id === officeId)!
    return {
      name: 'M. A. Bamgboye',
      age: '52',
      pronouns: 'he/him',
      officeId: office.id,
      tier: office.tier,
      post: office.post,
      route: office.route,
      stateCode: office.tier === 'state' || office.tier === 'local' ? 'KN' : 'FC',
      stateName: office.tier === 'state' || office.tier === 'local' ? 'Kano' : 'Federal Capital Territory',
      capital: office.tier === 'state' || office.tier === 'local' ? 'Kano' : 'Abuja',
      lgaName: office.tier === 'local' ? 'Wudil' : null,
      partyCode: 'CDM',
      partyName: 'Congress for Democratic Mandate',
    }
  }

  const expectDesk: Record<string, (s: Scenario) => void> = {
    'federal/president': s => {
      expect(s.officeTitle).toBe('President of the Federal Republic of Nigeria')
      expect(s.calendar.weekLine).toBe('FEC WEEK 41 · ABUJA')
      expect(s.w.cabinet).toBe('FEDERAL EXECUTIVE COUNCIL')
    },
    'state/governor': s => {
      expect(s.officeTitle).toBe('Executive Governor of Kano State')
      expect(s.calendar.weekLine).toBe('EXCO WEEK 41 · KANO')
      expect(s.jurisdictionName).toBe('Kano State')
    },
    'fct/minister': s => {
      expect(s.officeTitle).toBe('Minister of the Federal Capital Territory')
      expect(s.calendar.weekLine).toBe('FCTA WEEK 41 · ABUJA')
      expect(s.elected).toBe(false)
    },
    'local/chairman': s => {
      expect(s.officeTitle).toBe('Chairman, Wudil Local Government Council')
      expect(s.calendar.weekLine).toBe('COUNCIL WEEK 41 · WUDIL')
      expect(s.jurisdictionName).toBe('Wudil Local Government')
    },
  }

  it('lands the player on the seat they picked, at every post', () => {
    for (const office of PLAYABLE_OFFICES) {
      const record = scenarioInputFromFirstOpen(wizardChoices(office.id))
      expect(record).not.toBeNull()
      const s = deriveScenario(record!)
      expectDesk[office.id](s)
      expect(s.player).toBe('M. A. Bamgboye')
      expect(s.age).toBe(52)
      expect(s.partyName).toBe('Congress for Democratic Mandate')
    }
  })

  it('refuses to invent a seat when no post was chosen', () => {
    expect(scenarioInputFromFirstOpen({ ...wizardChoices('state/governor'), officeId: null })).toBeNull()
  })
})

describe('the boot rule picks the right desk', () => {
  const base = { hasProfile: false, profileHandle: null, supabaseConfigured: false, wizardLive: false }

  it('builds the desk from the local record, offline', () => {
    expect(bootTarget({ ...base, hasProfile: true })).toBe('desk')
    expect(bootTarget({ ...base, hasProfile: true, profileHandle: 'uid', supabaseConfigured: true })).toBe('desk')
  })

  it('reads a signed-in player’s record back from the database', () => {
    expect(bootTarget({ ...base, profileHandle: 'uid', supabaseConfigured: true })).toBe('fetch-profile')
  })

  it('otherwise opens the wizard — never somebody else’s desk', () => {
    expect(bootTarget(base)).toBe('wizard')
    // a handle with no configured backend cannot be fetched, so the wizard takes over
    expect(bootTarget({ ...base, profileHandle: 'uid' })).toBe('wizard')
  })
})

describe('the money is scaled by tier, and the arithmetic holds at every tier', () => {
  const tiers: ScenarioInput[] = [
    input({ officeId: 'federal/president', tier: 'federal', post: 'President', route: 'elected', stateCode: 'FC' }),
    input(),
    input({ officeId: 'fct/minister', tier: 'fct', post: 'Minister of the Federal Capital Territory', route: 'appointed', stateCode: 'FC' }),
    input({ officeId: 'local/chairman', tier: 'local', post: 'Chairman, Local Government', lgaName: 'Wudil' }),
  ]

  it('a council holds less than a state house, which holds less than the Federation', () => {
    const [fed, state, , local] = tiers.map(t => deriveScenario(t).money)
    expect(scaleFor('federal')).toBeGreaterThan(scaleFor('state'))
    expect(scaleFor('fct')).toBeLessThan(scaleFor('state'))
    expect(scaleFor('local')).toBeLessThan(scaleFor('fct'))
    expect(fed.closing).toBeGreaterThan(state.closing)
    expect(local.closing).toBeLessThan(state.closing)
  })

  it('opening + every posted movement − the variances = closing, pending excluded', () => {
    for (const t of tiers) {
      const m = deriveScenario(t).money
      const moved = m.rows.filter(r => !r.pending && !r.variance).reduce((a, r) => a + r.amount, 0)
      expect(m.opening + moved).toBe(m.closing)
      const pending = m.rows.filter(r => r.pending).reduce((a, r) => a + Math.abs(r.amount), 0)
      expect(pending).toBe(m.pendingTotal)
      expect(m.closing - m.pendingTotal).toBe(m.afterSanction)
      // the shortfall is a variance against projection, never a cash movement
      expect(m.rows.some(r => r.variance && r.amount === -m.shortfall)).toBe(true)
    }
  })

  it('keeps the state tier exactly on the analog world’s anchors', () => {
    const m = deriveScenario(input()).money
    expect(m.scale).toBe(1)
    expect(m.opening).toBe(3_834_790_251)
    expect(m.closing).toBe(8_275_860_000)
    expect(m.pendingTotal).toBe(2_068_965_000)
    expect(m.shortfall).toBe(214_371_000)
  })
})

describe('the pack is whole at every tier', () => {
  const packFor = (t: ScenarioInput) => buildWeek(deriveScenario(t))

  it('carries the tray, the decisions and the people', () => {
    for (const office of PLAYABLE_OFFICES) {
      const pack = packFor(input({
        officeId: office.id, tier: office.tier, post: office.post,
        route: office.route === 'elected' ? 'elected' : 'appointed',
        stateCode: office.tier === 'state' || office.tier === 'local' ? 'KN' : 'FC',
        lgaName: office.tier === 'local' ? 'Wudil' : null,
      }))
      expect(pack.docs.length).toBeGreaterThanOrEqual(12)
      expect(pack.decisions).toHaveLength(4)
      expect(pack.allies).toHaveLength(4)
      expect(pack.assets).toHaveLength(4)
      expect(pack.extras).toHaveLength(3)
      const ids = [...pack.docs, ...pack.extras, ...pack.assets].map(d => d.id)
      expect(new Set(ids).size).toBe(ids.length)
      // every decision points at a file that is actually on the desk
      for (const dec of pack.decisions) expect(ids).toContain(dec.docId)
      expect(pack.award).toBeGreaterThan(0)
      expect(pack.roadVariation).toBeGreaterThan(0)
    }
  })

  it('hands each seat the brief on its own levers and its own money', () => {
    const briefFor = (over: Partial<ScenarioInput>) => {
      const pack = packFor(input(over))
      const brief = pack.extras.find(d => d.id === 'desk-brief')
      expect(brief, over.officeId).toBeTruthy()
      return JSON.stringify(brief)
    }

    const federal = briefFor({ officeId: 'federal/president', tier: 'federal', post: 'President', stateCode: null, lgaName: null })
    expect(federal).toContain('SHARE — 52.68% of the federation account')
    expect(federal).toContain('s.143')
    expect(federal).toContain('YOU HOLD — Security')

    const governor = briefFor({})
    expect(governor).toContain('THE AXIOMS THIS DESK RUNS ON')
    expect(governor).toContain('CANNOT TOUCH')
    expect(governor).toContain('the police — the CP answers to the IG, not to you')
    expect(governor).toContain('NEXT RUNG — President')
    expect(governor).not.toContain('52.68% of the federation account')

    const council = briefFor({ officeId: 'local/chairman', tier: 'local', post: 'Council Chairman', lgaName: 'Wudil' })
    expect(council).toContain('SHARE — 20.6% of the federation account')
    expect(council).toContain('THE WAYS OFF')
    expect(council).toContain('NEXT RUNG — State Assembly Member')

    const fct = briefFor({ officeId: 'fct/minister', tier: 'fct', post: 'FCT Minister', stateCode: 'FC', lgaName: null })
    expect(fct).toContain('1% of the federal side (earmark)')
    expect(fct).toContain('President can sack you')
  })

  it('localizes the file titles to the seat', () => {
    const kano = packFor(input())
    // the cabinet, the digest and the allocation all print this state's own institutions
    expect(JSON.stringify(kano.docs)).toContain('KANO STATE EXECUTIVE COUNCIL')
    expect(JSON.stringify(kano.docs)).toContain('KANO STATE SECURITY DIGEST')
    expect(JSON.stringify(kano.docs)).toContain('Gaya')     // a real Kano town, in the market name
    expect(kano.docs.map(d => d.title).join(' | ')).toContain('Gaya Market')
    const lagos = packFor(input({ stateCode: 'LA', stateName: 'Lagos', capital: 'Ikeja' }))
    const lagosBlob = JSON.stringify(lagos.docs)
    expect(lagosBlob).toContain('LAGOS STATE HOUSE OF ASSEMBLY')
    expect(lagosBlob).toContain('Ikorodu')
    expect(lagosBlob).not.toContain('Gaya')
  })
})
