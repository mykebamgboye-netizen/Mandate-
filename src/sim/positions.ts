/* @mandate/sim/positions — the complete office catalogue.
 *
 * Every public office in the federation is generated from the canonical geography in
 * geo.ts (37 states + the FCT, 774 councils), so the catalogue cannot drift from the map
 * and there is no hand-maintained list of "the four offices you may play".
 *
 * Two counts matter and both are asserted in living.test.ts:
 *
 *   PLAYABLE_CORE — the slice the rebuild brief calls the day-one playable set:
 *                   President + Vice President + 109 Senators + 360 Representatives
 *                   + 774 LGA Chairmen = 1,245 seats.
 *                   (The brief says "1,247". That figure only comes out if the FCT is
 *                   given three senators (37 × 3 = 111); the constitution gives the
 *                   territory one (s.48), so the correct slice is 1,245. The catalogue
 *                   follows the constitution and the test records the difference.)
 *
 *   TOTAL         — the whole catalogue, incl. Ministers, Governors, Deputies, Speakers
 *                   and the 8,809 ward councillors.
 *
 * Powers are the same token vocabulary the profile layer validates (see
 * POWER_TOKENS in src/profile/schema.ts); a test keeps the two sets equal.
 */

import { STATES, LGAS, STATE_BY_CODE} from './geo'

export type PositionTier = 'federal' | 'state' | 'lga' | 'ward'
export type PositionArm = 'executive' | 'legislative' | 'judicial' | 'appointed'
export type AppointmentType = 'elected' | 'appointed' | 'civil_service'

export interface PositionPrereq {
  kind: 'office' | 'party-role' | 'age' | 'terms'
  /** e.g. 'federal/senator' — the office whose tenure qualifies you */
  officeId?: string
  minTerms?: number
  minAge?: number
}

export interface Position {
  id: string
  title: string
  tier: PositionTier
  arm: PositionArm
  /** human jurisdiction, e.g. "Delta Central Senatorial District" */
  jurisdiction: string
  stateCode: string | null
  /** the council's natural key `${stateCode}/${lgaName}` — matches federation_lgas.id */
  lgaCode: string | null
  termYears: number
  /** ₦ per month, integer naira (the brief's salary_monthly) */
  salaryMonthly: number
  /** share of the relevant monthly allocation, 0..1 (the brief's faac_share) */
  faacShare: number
  prerequisites: PositionPrereq[]
  powers: string[]
  appointmentType: AppointmentType
  /** modelled cost of a serious run for the seat, integer ₦ — a game constant, not a claim */
  campaignCostNaira: number
  /** every office is playable from day one in this build */
  playable: boolean
}

/** The 30 federal ministries (modelled; the brief seeds 30). */
export const MINISTRIES: readonly string[] = [
  'Finance', 'Works', 'Education', 'Health', 'Defence', 'Interior', 'Justice',
  'Agriculture', 'Petroleum', 'Power', 'Transport', 'Aviation', 'Communications',
  'Environment', 'Water Resources', 'Youth', 'Women Affairs', 'Labour', 'Trade',
  'Science and Technology', 'Housing', 'Police Affairs', 'Federal Capital Territory',
  'Special Duties', 'Budget and Planning', 'Humanitarian Affairs', 'Steel Development',
  'Blue Economy', 'Tourism', 'Sports Development',
]

/** House of Representatives seats per state — the constitution's 360-member House. */
const REP_SEATS: Record<string, number> = {
  AB: 8, AD: 8, AK: 10, AN: 11, BA: 12, BY: 5, BE: 11, BO: 10, CR: 8, DT: 10,
  EB: 6, ED: 9, EK: 6, EN: 8, FC: 2, GO: 6, IM: 10, JI: 11, KD: 16, KN: 24,
  KT: 15, KE: 8, KO: 9, KW: 6, LA: 24, NA: 5, NI: 10, OG: 9, ON: 9, OS: 9,
  OY: 14, PL: 8, RI: 13, SO: 11, TA: 6, YO: 6, ZA: 7,
}

const SENATORIAL_WINGS = ['Central', 'North', 'South'] as const

/** Candidate campaign costs, by tier — modelled constants (naira). */
const CAMPAIGN_COST = {
  presidential: 2_500_000_000,
  federalExecutive: 1_200_000_000,
  federalLegislative: 400_000_000,
  stateExecutive: 900_000_000,
  stateLegislative: 120_000_000,
  lga: 40_000_000,
  ward: 3_000_000,
} as const

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The 8,809 wards, distributed across the 774 councils.
 *  The national ward count is fixed by the electoral register; INEC's own per-council
 *  breakdown is not reproduced here, so the split is deterministic and exact:
 *  295 councils carry 12 wards, the remaining 479 carry 11 → 8,809. */
export const NATIONAL_WARDS = 8809

function wardCountsByLga(): Map<string, number> {
  const keys = LGAS.map(l => `${l.stateCode}/${l.name}`)
  const base = Math.floor(NATIONAL_WARDS / keys.length)
  const remainder = NATIONAL_WARDS - base * keys.length
  const out = new Map<string, number>()
  keys.forEach((k, i) => out.set(k, base + (i < remainder ? 1 : 0)))
  return out
}

/** Build the whole catalogue. Pure and deterministic: same geography, same offices. */
export function buildPositions(): Position[] {
  const out: Position[] = []
  const push = (p: Position) => { out.push(p) }

  // ---- 1. federal executive -------------------------------------------------
  push({
    id: 'federal/president', title: 'President', tier: 'federal', arm: 'executive',
    jurisdiction: 'Nigeria', stateCode: null, lgaCode: null, termYears: 4,
    salaryMonthly: 1_400_000, faacShare: 0.52, prerequisites: [],
    powers: ['sign.memo', 'appoint.minister', 'receive.faac', 'budget.allocate', 'command.convention'],
    appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.presidential, playable: true,
  })
  push({
    id: 'federal/vice-president', title: 'Vice President', tier: 'federal', arm: 'executive',
    jurisdiction: 'Nigeria', stateCode: null, lgaCode: null, termYears: 4,
    salaryMonthly: 1_200_000, faacShare: 0, prerequisites: [],
    powers: ['sign.memo', 'preside.senate', 'receive.faac'],
    appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.presidential, playable: true,
  })
  for (const dept of MINISTRIES) {
    push({
      id: `federal/minister/${slug(dept)}`, title: `Minister of ${dept}`, tier: 'federal', arm: 'appointed',
      jurisdiction: `Ministry of ${dept}`, stateCode: null, lgaCode: null, termYears: 4,
      salaryMonthly: 950_000, faacShare: 0, prerequisites: [{ kind: 'party-role' }],
      powers: ['propose.memo', 'allocate.ministry', 'receive.appropriation'],
      appointmentType: 'appointed', campaignCostNaira: CAMPAIGN_COST.federalExecutive, playable: true,
    })
  }

  // ---- 2. National Assembly -------------------------------------------------
  for (const state of STATES) {
    if (state.code === 'FC') {
      // the territory returns one senator and two representatives (s.48, s.49)
      push({
        id: 'federal/senator/FC', title: 'Senator', tier: 'federal', arm: 'legislative',
        jurisdiction: 'FCT Senatorial District', stateCode: 'FC', lgaCode: null, termYears: 4,
        salaryMonthly: 1_100_000, faacShare: 0, prerequisites: [],
        powers: ['legislate', 'oversight', 'budget.scrutinize', 'receive.constituency'],
        appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.federalLegislative, playable: true,
      })
    } else {
      for (const wing of SENATORIAL_WINGS) {
        push({
          id: `federal/senator/${state.code}/${slug(wing)}`, title: 'Senator', tier: 'federal', arm: 'legislative',
          jurisdiction: `${state.name} ${wing} Senatorial District`, stateCode: state.code, lgaCode: null,
          termYears: 4, salaryMonthly: 1_100_000, faacShare: 0, prerequisites: [],
          powers: ['legislate', 'oversight', 'budget.scrutinize', 'receive.constituency'],
          appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.federalLegislative, playable: true,
        })
      }
    }

    const seats = REP_SEATS[state.code] ?? 0
    for (let n = 1; n <= seats; n++) {
      push({
        id: `federal/rep/${state.code}/${n}`, title: 'Hon. Member, House of Reps', tier: 'federal', arm: 'legislative',
        jurisdiction: `${state.name} Federal Constituency ${n}`, stateCode: state.code, lgaCode: null,
        termYears: 4, salaryMonthly: 950_000, faacShare: 0, prerequisites: [],
        powers: ['legislate', 'oversight', 'budget.scrutinize', 'receive.constituency'],
        appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.federalLegislative, playable: true,
      })
    }
  }

  // ---- 3. the states --------------------------------------------------------
  for (const state of STATES) {
    if (state.code === 'FC') continue // the FCT has no governorship (s.299)
    push({
      id: `state/${state.code}/governor`, title: 'Governor', tier: 'state', arm: 'executive',
      jurisdiction: state.name, stateCode: state.code, lgaCode: null, termYears: 4,
      salaryMonthly: 1_000_000, faacShare: 0.26,
      prerequisites: [{ kind: 'terms', officeId: `federal/senator/${state.code}/central`, minTerms: 1 }],
      powers: ['sign.memo', 'appoint.commissioner', 'receive.faac', 'budget.allocate', 'deploy.request', 'oversight.lga'],
      appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.stateExecutive, playable: true,
    })
    push({
      id: `state/${state.code}/deputy-governor`, title: 'Deputy Governor', tier: 'state', arm: 'executive',
      jurisdiction: state.name, stateCode: state.code, lgaCode: null, termYears: 4,
      salaryMonthly: 900_000, faacShare: 0, prerequisites: [],
      powers: ['sign.memo', 'receive.faac', 'budget.allocate'],
      appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.stateExecutive, playable: true,
    })
    push({
      id: `state/${state.code}/speaker`, title: 'Speaker, State House of Assembly', tier: 'state', arm: 'legislative',
      jurisdiction: `${state.name} State House of Assembly`, stateCode: state.code, lgaCode: null, termYears: 4,
      salaryMonthly: 600_000, faacShare: 0, prerequisites: [{ kind: 'office', officeId: `state/${state.code}/assembly`, minTerms: 1 }],
      powers: ['preside.house', 'certify.legislation', 'oversight', 'receive.faac'],
      appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.stateLegislative, playable: true,
    })
  }

  // ---- 4. the third tier: 774 chairmen and the wards ------------------------
  const wards = wardCountsByLga()
  for (const lga of LGAS) {
    const state = STATE_BY_CODE.get(lga.stateCode)
    const lgaCode = `${lga.stateCode}/${lga.name}`
    push({
      id: `lga/${lgaCode}/chairman`, title: 'Chairman, Local Government', tier: 'lga', arm: 'executive',
      jurisdiction: `${lga.name} LGA, ${state?.name ?? lga.stateCode}`, stateCode: lga.stateCode, lgaCode,
      termYears: 3, salaryMonthly: 350_000, faacShare: 0.20, prerequisites: [],
      powers: ['allocate.lga', 'receive.lga', 'propose.memo', 'oversight.ward'],
      appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.lga, playable: true,
    })
    const count = wards.get(lgaCode) ?? 0
    for (let w = 1; w <= count; w++) {
      push({
        id: `ward/${lgaCode}/${w}/councillor`, title: 'Councillor', tier: 'ward', arm: 'legislative',
        jurisdiction: `${lga.name} Ward ${w}`, stateCode: lga.stateCode, lgaCode, termYears: 3,
        salaryMonthly: 150_000, faacShare: 0, prerequisites: [],
        powers: ['legislate.lga', 'oversight.ward', 'receive.constituency'],
        appointmentType: 'elected', campaignCostNaira: CAMPAIGN_COST.ward, playable: true,
      })
    }
  }

  return out
}

export const POSITIONS: readonly Position[] = buildPositions()

export const POSITION_BY_ID: ReadonlyMap<string, Position> = new Map(POSITIONS.map(p => [p.id, p]))

export function findPosition(id: string): Position | undefined {
  return POSITION_BY_ID.get(id)
}

export function positionsByTier(tier: PositionTier): Position[] {
  return POSITIONS.filter(p => p.tier === tier)
}

export interface PositionCounts {
  total: number
  /** President + VP + Senators + Reps + LGA Chairmen — the brief's "day-one playable" slice */
  playableCore: number
  federal: number
  state: number
  lga: number
  ward: number
  senators: number
  reps: number
  governors: number
  ministers: number
  chairmen: number
  councillors: number
}

export function countPositions(list: readonly Position[] = POSITIONS): PositionCounts {
  const by = (tier: PositionTier) => list.filter(p => p.tier === tier).length
  const core = list.filter(p =>
    p.id === 'federal/president' ||
    p.id === 'federal/vice-president' ||
    p.id.startsWith('federal/senator/') ||
    p.id.startsWith('federal/rep/') ||
    p.id.startsWith('lga/'),
  ).length
  return {
    total: list.length,
    playableCore: core,
    federal: by('federal'),
    state: by('state'),
    lga: by('lga'),
    ward: by('ward'),
    senators: list.filter(p => p.id.startsWith('federal/senator/')).length,
    reps: list.filter(p => p.id.startsWith('federal/rep/')).length,
    governors: list.filter(p => p.id.endsWith('/governor')).length,
    ministers: list.filter(p => p.id.startsWith('federal/minister/')).length,
    chairmen: list.filter(p => p.id.startsWith('lga/')).length,
    councillors: list.filter(p => p.id.startsWith('ward/') && p.id.endsWith('/councillor')).length,
  }
}

export const POSITION_COUNTS = countPositions(POSITIONS)

/** Pre-resolved lookups over the catalogue. A century is 5,200 turns over 10,000 seats;
 *  an actor's target must be resolvable in O(1), not by scanning the catalogue. */
export interface SeatIndex {
  president: string | null
  vicePresident: string | null
  ministers: string[]
  senatorsByState: Map<string, string[]>
  repsByState: Map<string, string[]>
  governorsByState: Map<string, string>
  deputyGovernorsByState: Map<string, string>
  speakersByState: Map<string, string>
  chairmenByState: Map<string, string[]>
}

export function buildSeatIndex(list: readonly Position[] = POSITIONS): SeatIndex {
  const index: SeatIndex = {
    president: null,
    vicePresident: null,
    ministers: [],
    senatorsByState: new Map(),
    repsByState: new Map(),
    governorsByState: new Map(),
    deputyGovernorsByState: new Map(),
    speakersByState: new Map(),
    chairmenByState: new Map(),
  }
  const pushInto = (map: Map<string, string[]>, key: string, id: string) => {
    const list = map.get(key)
    if (list) list.push(id)
    else map.set(key, [id])
  }
  for (const p of list) {
    if (p.id === 'federal/president') { index.president = p.id; continue }
    if (p.id === 'federal/vice-president') { index.vicePresident = p.id; continue }
    if (p.id.startsWith('federal/minister/')) { index.ministers.push(p.id); continue }
    if (p.id.startsWith('federal/senator/') && p.stateCode) { pushInto(index.senatorsByState, p.stateCode, p.id); continue }
    if (p.id.startsWith('federal/rep/') && p.stateCode) { pushInto(index.repsByState, p.stateCode, p.id); continue }
    if (p.id.endsWith('/governor') && p.stateCode) { index.governorsByState.set(p.stateCode, p.id); continue }
    if (p.id.endsWith('/deputy-governor') && p.stateCode) { index.deputyGovernorsByState.set(p.stateCode, p.id); continue }
    if (p.id.endsWith('/speaker') && p.stateCode) { index.speakersByState.set(p.stateCode, p.id); continue }
    if (p.id.endsWith('/chairman') && p.stateCode) { pushInto(index.chairmenByState, p.stateCode, p.id); continue }
  }
  return index
}

export const SEAT_INDEX: SeatIndex = buildSeatIndex(POSITIONS)
