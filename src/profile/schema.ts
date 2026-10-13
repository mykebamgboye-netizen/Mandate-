// @mandate/profile/schema — normalization, validation, office->powers wiring, and
// the mapping from the model's axes to the sim's world/state where applicable.
// This is the layer that keeps the profile honest as it crosses gameplay.

import type { ProfileAxes, AxisKey } from './types'
import { OPENING_BALANCE } from '../content'

// ---- Normalization ----

export function normalizeAxes(incoming?: Partial<ProfileAxes>): ProfileAxes {
  const clampBp = (n: number | undefined, min = 0, max = 10000) => {
    const v = Number.isFinite(n ?? NaN) ? Math.round(n ?? 0) : 5000
    return Math.max(min, Math.min(max, v))
  }
  return {
    competence: clampBp(incoming?.competence),
    integrity: clampBp(incoming?.integrity),
    popularSupport: clampBp(incoming?.popularSupport),
    partyLoyalty: clampBp(incoming?.partyLoyalty),
    eliteTrust: clampBp(incoming?.eliteTrust),
    pressTone: clampBp(incoming?.pressTone, -10000, 10000),
    constituencyAlignment: clampBp(incoming?.constituencyAlignment),
    patronageBank: Math.round(incoming?.patronageBank ?? 0),
    mandateLegitimacy: clampBp(incoming?.mandateLegitimacy),
    institutionalMemory: clampBp(incoming?.institutionalMemory),
  }
}

export function clampAxis(axes: ProfileAxes, key: AxisKey, delta: number): ProfileAxes {
  const next = { ...axes } as any
  const cur = axes[key]
  if (key === 'pressTone') {
    next.pressTone = Math.max(-10000, Math.min(10000, cur + delta))
  } else {
    next[key] = Math.max(0, Math.min(10000, cur + delta))
  }
  return next as ProfileAxes
}

// ---- Office -> powers wiring (mirrors federation_offices.powers but validated locally) ----

export const POWER_TOKENS = {
  receiveFaac: 'receive.faac',
  receiveIgr: 'receive.igr',
  receiveAppropriation: 'receive.appropriation',
  receiveConstituency: 'receive.constituency',
  receivePatronage: 'receive.patronage',
  receiveLga: 'receive.lga',
  receiveSecurity: 'receive.security',
  receiveClassified: 'receive.classified',
  signMemo: 'sign.memo',
  budgetAllocate: 'budget.allocate',
  legislate: 'legislate',
  oversight: 'oversight',
  whip: 'whip',
  endorse: 'endorse',
  deployRequest: 'deploy.request',
  appointCommissioner: 'appoint.commissioner',
  appointMinister: 'appoint.minister',
  coordinateMinistries: 'coordinate.ministries',
  coordinateCivilService: 'coordinate.civil-service',
  implementPolicy: 'implement.policy',
  adviseLegal: 'advise.legal',
  coordinateSecurity: 'coordinate.security',
  presideHouse: 'preside.house',
  presideSenate: 'preside.senate',
  certifyLegislation: 'certify.legislation',
  setAgenda: 'set.agenda',
  countVotes: 'count.votes',
  runPrimaries: 'run.primaries',
  controlStructure: 'control.structure',
  commandConvention: 'command.convention',
  oversightLga: 'oversight.lga',
  oversightWard: 'oversight.ward',
  allocateLga: 'allocate.lga',
  legislateLga: 'legislate.lga',
  receiveIntelligence: 'receive.intelligence',
  receiveLegal: 'receive.legal',
  access: 'access',
  godfather: 'godfather',
} as const

export function validatePowers(powers: string[]): string[] {
  const allowed = new Set<string>(Object.values(POWER_TOKENS))
  return powers.filter((p): p is string => allowed.has(p))
}

// ---- Money / patronage bank ----

export function startingPatronageBankForOffice(officeId: string, stateCode: string): number {
  if (officeId === 'state/governor' && stateCode === 'DT') {
    return OPENING_BALANCE
  }
  return 0
}

// ---- Office model scaffolding for the federation ----

export interface OfficeEntry {
  id: string
  tier: 'federal' | 'state' | 'local' | 'fct'
  post: string
  route: 'elected' | 'appointed' | 'nomination'
  jurisdiction: string
  revenueKeys: string[]
}

// Canonical office set is loaded from federation_offices in Supabase at runtime.
// For the prototype+build that must pass offline, we keep a small local fallback for
// the tutorial office only, so the onboarding flow never fails to render the Delta row.
export const TUTORIAL_OFFICE: OfficeEntry = {
  id: 'state/governor',
  tier: 'state',
  post: 'Governor',
  route: 'elected',
  jurisdiction: 'state',
  revenueKeys: ['faac_net', 'igr', 'state_wages', 'state_capex', 'derivation'],
}
