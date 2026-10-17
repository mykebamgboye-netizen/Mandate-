// @mandate/profile/profile-state — the small client-side state machine that drives the first-open
// onboarding shell in App.tsx. It owns pick-state → prologue → sheet, and emits the values the
// React steps bind to. No Supabase here; persistence lives in client.ts / the app's use effect.

import type { FederationState, FederationOffice, FederationParty } from './types'
import type { Origin, Bringer, FirstScar } from './prologue'
import { sheetFromAxes, prologueAxes } from './profile-sheet'
import { ORIGINS, BRINGERS, FIRST_SCARS } from './prologue'
import { OPENING_BALANCE } from '../content'
import { FCT_MINISTER_OFFICE, DELTA_TUTORIAL_OFFICE } from './delta-tutorial'
import { PLAYABLE_OFFICES, FALLBACK_OFFICES, FALLBACK_OFFICES_COUNT } from './playable-offices'

// The full day-one playable set is the same shape as PLAYABLE_OFFICES now (FALLBACK_OFFICES
// is re-exported from playable-offices). Keep PLAYABLE_OFFICES as the import name used by the
// rest of the file for now, but route it through FALLBACK_OFFICES so pickers show the full
// constitutional set rather than the four-office curated shortlist.
const CURATED_PLAYABLE_OFFICES = PLAYABLE_OFFICES
const FULL_DAY_ONE_PLAYABLE_OFFICES = FALLBACK_OFFICES
// Re-export from FALLBACK so callers see the full set.
export { FULL_DAY_ONE_PLAYABLE_OFFICES as PLAYABLE_OFFICES, FALLBACK_OFFICES, FALLBACK_OFFICES_COUNT }

export type OnboardingPhase = 'landing' | 'pick-post' | 'pick-state' | 'pick-lga' | 'prologue' | 'profile-sheet'

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
  /** blank first-open: the player types their own; never pre-filled with an NPC name */
  name: string
  age: string
  pronouns: string
  locale: string
  bio: string
  altName: string
  /** player-chosen party from the first-open party picker */
  partyCode: string | null
  /** set only for the LGA tier (Chairman) — the territory a state-level post does not need */
  lgaName: string | null
  sheet: ReturnType<typeof sheetFromAxes> | null
  error: string | null
}

export function defaultState(
  states: FederationState[],
  offices: FederationOffice[],
  parties: FederationParty[],
): OnboardingState {
  return {
    phase: 'pick-post',
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
    pronouns: '',
    locale: '',
    bio: '',
    altName: '',
    partyCode: null,
    lgaName: null,
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

// ---- post → jurisdiction ----
//
// A post decides what the player still has to choose:
//   President        — nationwide; the seat of government is the FCT (Abuja), so there is
//                      nothing left to pick before the prologue.
//   Governor         — one of the 36 states (the FCT is not offered: s.299).
//   FCT Minister     — the territory itself, appointed, nothing to pick.
//   LGA Chairman     — a state, then one of its LGAs.
export type PostRoute =
  | { kind: 'direct'; stateCode: string }
  | { kind: 'state' }
  | { kind: 'state-then-lga' }

export function postRoute(office: FederationOffice): PostRoute {
  if (office.tier === 'fct') return { kind: 'direct', stateCode: FCT_STATE_CODE }
  if (office.id === 'federal/president') return { kind: 'direct', stateCode: FCT_STATE_CODE }
  if (office.jurisdiction === 'lga') return { kind: 'state-then-lga' }
  return { kind: 'state' }
}

/** Which states the jurisdiction step offers for a post. */
export function stateChoicesFor(office: FederationOffice, states: FederationState[]): FederationState[] {
  const route = postRoute(office)
  if (route.kind === 'state-then-lga') return states // every state + FCT has LGAs
  return states.filter(s => s.tier !== 'fct')
}

/** The playable offices the picker shows, taken from the live catalogue when it carries the
    playable flag, and from the full constitutional day-one set otherwise (1,245 seats). */
export function selectableOffices(offices: FederationOffice[]): FederationOffice[] {
  const flagged = offices.filter(o => o.playable)
  if (flagged.length > 0) return flagged
  return FALLBACK_OFFICES
}

/** The picker must never dead-end on a missing reference row: if the live
    federation_offices table has not been migrated yet (the FCT row ships in
    migration 002), merge the canonical definitions in so the chosen card still
    resolves to a real office. */
export function ensureReferenceOffices(offices: FederationOffice[]): FederationOffice[] {
  const have = new Set(offices.map(o => o.id))
  const required = [...PLAYABLE_OFFICES, FCT_MINISTER_OFFICE, DELTA_TUTORIAL_OFFICE, ...FALLBACK_OFFICES]
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
  // Party label follows the player's own first-open choice first; otherwise fall back
  // to the local fallback party row (PA), never to a real-party default.
  const localFallbackParty = s.parties.find(p => p.code === 'PA') ?? null

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
      // party label follows the player's own first-open choice first; otherwise fall back
      // to the local fallback party (PA), never to a real-party default.
      s.partyCode ? s.parties.find(p => p.code === s.partyCode)?.name ?? null : localFallbackParty?.name ?? null,
      s.name || 'M. A. Bamgboye',
      s.age || null,
      s.lgaName,
    ),
    error: null,
  }
}

/** Commit the sheet as "reviewed" without changing it — the accept action. */
export function acceptSheet(s: OnboardingState): OnboardingState {
  return { ...s, phase: 'profile-sheet', error: null }
}

/** Strip the first-open-only transient fields before the sheet travels anywhere else
   (e.g. a profile create / update call). The onboarding shell keeps name/age/pronouns/
   locale/bio/altName/partyCode during setup; downstream profile writes only need what
   the profile table already carries. */
export function profileIdentityFromOnboarding(s: OnboardingState): ProfileIdentityFields {
  return {
    name: s.name.trim() || null,
    stateCode: s.stateCode,
    lgaName: s.lgaName,
    senatorialDistrict: null,
    pronouns: s.pronouns.trim() || null,
    locale: s.locale.trim() || null,
    phoneHome: null,
    altName: s.altName.trim() || null,
    bio: s.bio.trim() || null,
    age: s.age.trim() ? Number(s.age) : null,
    chosenParty: s.partyCode,
  }
}

// A narrow shape for the identity fields the first-open form actually collects,
// kept separate from the full ProfileIdentity so the onboarding shell does not
// start carrying fields it does not use (e.g. office/party history).
export interface ProfileIdentityFields {
  name: string | null
  stateCode: string | null
  lgaName: string | null
  senatorialDistrict: string | null
  pronouns: string | null
  locale: string | null
  phoneHome: string | null
  altName: string | null
  bio: string | null
  age: number | null
  chosenParty: string | null
}

// Local re-export of normalizeAxes for the small state layer.
import { normalizeAxes } from './schema'
