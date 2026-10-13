// @mandate/profile/profile-state — the small client-side state machine that drives the first-open
// onboarding shell in App.tsx. It owns pick-state → prologue → sheet, and emits the values the
// React steps bind to. No Supabase here; persistence lives in client.ts / the app's use effect.

import type { FederationState, FederationOffice, FederationParty } from './types'
import type { Origin, Bringer, FirstScar } from './prologue'
import { sheetFromAxes, prologueAxes } from './profile-sheet'
import { ORIGINS, BRINGERS, FIRST_SCARS } from './prologue'
import { OPENING_BALANCE } from '../content'
import { FCT_MINISTER_OFFICE, DELTA_TUTORIAL_OFFICE } from './delta-tutorial'

export type OnboardingPhase = 'pick-state' | 'prologue' | 'profile-sheet'

export interface OnboardingState {
  phase: OnboardingPhase
  states: FederationState[]
  offices: FederationOffice[]
  parties: FederationParty[]
  stateCode: string | null
  officeId: string | null
  origin: Origin | null
  bringer: Bringer | null
  scar: FirstScar | null
  name: string
  age: string
  sheet: ReturnType<typeof sheetFromAxes> | null
  error: string | null
}

export function defaultState(
  states: FederationState[],
  offices: FederationOffice[],
  parties: FederationParty[],
): OnboardingState {
  return {
    phase: 'pick-state',
    states,
    offices,
    parties,
    stateCode: null,
    officeId: null,
    origin: null,
    bringer: null,
    scar: null,
    name: '',
    age: '',
    sheet: null,
    error: null,
  }
}

// Transition helpers — pure functions so App.tsx keeps control of the render.

// ---- post for a state-level pick ----
//
// The FCT is not a state: it has no governorship. s.299 has the territory
// administered by the President through a Minister, so the FCT card must route to
// an 'fct'-tier office rather than pinning 'state/governor' like the 36 states do.
export const FCT_STATE_CODE = 'FC'
export const FCT_OFFICE_ID = 'fct/minister'
export const STATE_GOVERNOR_OFFICE_ID = 'state/governor'

export function startingOfficeForState(stateCode: string): string {
  return stateCode === FCT_STATE_CODE ? FCT_OFFICE_ID : STATE_GOVERNOR_OFFICE_ID
}

/** The picker must never dead-end on a missing reference row: if the live
    federation_offices table has not been migrated yet (the FCT row ships in
    migration 002), merge the canonical definitions in so the chosen card still
    resolves to a real office. */
export function ensureReferenceOffices(offices: FederationOffice[]): FederationOffice[] {
  const have = new Set(offices.map(o => o.id))
  const required = [FCT_MINISTER_OFFICE, DELTA_TUTORIAL_OFFICE]
  return [...offices, ...required.filter(o => !have.has(o.id))]
}

export function nextPrologueState(s: OnboardingState): OnboardingState {
  if (!s.stateCode) return s
  return { ...s, phase: 'prologue' }
}

export function nextSheetState(s: OnboardingState): OnboardingState {
  if (!s.stateCode || !s.officeId || !s.origin || !s.bringer || !s.scar) {
    return { ...s, error: 'Complete the prologue before reviewing your record.' }
  }
  const st = s.states.find(st => st.code === s.stateCode)
  if (!st) return { ...s, error: 'State not found.' }
  const office = s.offices.find(o => o.id === s.officeId)
  if (!office) return { ...s, error: 'Office not found.' }
  const party = s.parties.find(p => p.code === 'APC') ?? null

  /* The prologue's axes are deltas on top of the desk you are taking over, not a
     from-scratch slate: the patronage bank must start at the treasury's opening
     balance (the same ₦ figure the budget screen reports). Building from an empty
     normalizeAxes({}) silently zeroed it, so a revised record claimed a ₦0 bank
     while the desk held ₦3.83bn. */
  const base = normalizeAxes({ patronageBank: OPENING_BALANCE })

  const axes = prologueAxes(
    base,
    ORIGINS.find(o => o.id === s.origin)!.deltas,
    BRINGERS.find(b => b.id === s.bringer)!.deltas,
    FIRST_SCARS.find(sc => sc.id === s.scar)!.deltas,
    0,
  )

  const patronageBank = axes.patronageBank

  const patron = ORIGINS.find(o => o.id === s.origin)?.patron

  return {
    ...s,
    phase: 'profile-sheet',
    sheet: sheetFromAxes(
      axes,
      patronageBank,
      patron,
      st.name,
      st.capital,
      office,
      party?.name ?? null,
      s.name || 'M. A. Bamgboye',
      s.age || null,
    ),
    error: null,
  }
}

export function acceptSheet(s: OnboardingState): OnboardingState {
  return { ...s, phase: 'profile-sheet', error: null }
}

// Local re-export of normalizeAxes for the small state layer.
import { normalizeAxes } from './schema'
