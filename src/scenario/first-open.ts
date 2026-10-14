/* MANDATE — the one place the wizard's choices become the desk's record.
   Kept out of App.tsx so the critical path is testable: what the first-open screens collected
   is exactly what the scenario is derived from, and nothing else. */

import { defaultTermStart } from './derive'
import type { ScenarioInput, Tier } from './types'

export interface FirstOpenChoices {
  name: string
  age: string
  pronouns: string
  officeId: string | null
  tier: Tier
  post: string
  route: 'elected' | 'appointed' | 'nomination'
  stateCode: string | null
  stateName?: string | null
  capital?: string | null
  lgaName: string | null
  partyCode: string | null
  partyName?: string | null
}

export function scenarioInputFromFirstOpen(c: FirstOpenChoices): ScenarioInput | null {
  if (!c.officeId) return null
  return {
    name: c.name.trim() || null,
    age: c.age ? Number(c.age) : null,
    pronouns: c.pronouns.trim() || null,
    officeId: c.officeId,
    tier: c.tier,
    post: c.post,
    route: c.route === 'elected' ? 'elected' : 'appointed',
    stateCode: c.stateCode,
    stateName: c.stateName ?? null,
    capital: c.capital ?? null,
    lgaName: c.lgaName,
    partyCode: c.partyCode,
    partyName: c.partyName ?? null,
    termStart: defaultTermStart(c.tier),
  }
}
