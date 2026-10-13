// @mandate/profile/profile-state — the small client-side state machine that drives the first-open
// onboarding shell in App.tsx. It owns pick-state → prologue → sheet, and emits the values the
// React steps bind to. No Supabase here; persistence lives in client.ts / the app's use effect.

import type { FederationState, FederationOffice, FederationParty } from './types'
import type { Origin, Bringer, FirstScar } from './prologue'
import { sheetFromAxes, prologueAxes } from './profile-sheet'
import { ORIGINS, BRINGERS, FIRST_SCARS } from './prologue'
import { OPENING_BALANCE } from '../content'

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
