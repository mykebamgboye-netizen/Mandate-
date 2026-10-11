// @mandate/profile/delta-tutorial — the Delta Oct-2026 tutorial scenario, wired from
// src/content.ts anchors so the profile boots into the locked ledger world.
// In Supabase this is the scenario_start_state row 'delta/2026/w41'; locally it is the
// canonical fallback so the build and the prototype never depend on a live DB to render.

import type { Profile, FederationState, FederationOffice, ProfileIdentity, ProfileAxes } from './types'
import { DEFAULT_AXES } from './types'
import { OPENING_BALANCE } from '../content'

// The Delta tutorial profile is "M. A. Bamgboye — Executive Governor of Delta State"
// as established by the existing content pack. The profile layer mirrors that so the desk
// and the profile agree on who the player is.

export const DELTA_TUTORIAL_STATE: FederationState = {
  code: 'DT',
  name: 'Delta',
  capital: 'Asaba',
  tier: 'state',
  zone: 'South-South',
  senatorialDistricts: ['Delta North', 'Delta Central', 'Delta South'],
}

export const DELTA_TUTORIAL_OFFICE: FederationOffice = {
  id: 'state/governor',
  tier: 'state',
  post: 'Governor',
  route: 'elected',
  jurisdiction: 'state',
  termNote: '4-year term; Chief Executive of the State; appoints Commissioners under s.192.',
  powers: [
    'sign.memo',
    'appoint.commissioner',
    'receive.faac',
    'budget.allocate',
    'deploy.request',
    'oversight.lga',
  ],
  revenueMap: {
    faac_net: true,
    igr: true,
    state_wages: true,
    state_capex: true,
    derivation: true,
  },
  authorityNote: 'ss.176 · Governor; s.162 · Federation Account; ss.121–125 · State Appropriation; s.192 · Commissioners',
}

// The starting profile for the Delta tutorial. Axes are set to a believable "18 months in,
// 15 months to election" posture consistent with the content pack's framing.
export function deltaTutorialProfile(identity: Partial<ProfileIdentity> = {}): Profile {
  const axes: ProfileAxes = {
    ...DEFAULT_AXES,
    competence: 6200,
    integrity: 4800,
    popularSupport: 5500,
    partyLoyalty: 7000,
    eliteTrust: 5800,
    pressTone: -500,
    constituencyAlignment: 7000,
    patronageBank: OPENING_BALANCE,
    mandateLegitimacy: 8500,
    institutionalMemory: 4000,
  }

  return {
    id: 'delta/2026/w41', // mirrors the scenario_id; in production this is a real UUID
    handle: 'BAMG',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    identity: {
      name: 'M. A. Bamgboye',
      stateCode: 'DT',
      lgaName: null,
      senatorialDistrict: null,
      age: 52,
      ...identity,
    },
    office: {
      tier: 'state',
      post: 'Governor',
      elected: true,
      termStart: '2023-05-29',
      officeId: 'state/governor',
    },
    party: {
      current: 'APC',
      history: [],
      defectionRisk: 0.18,
    },
    axes,
    powers: DELTA_TUTORIAL_OFFICE.powers,
    patronageBank: OPENING_BALANCE,
    deletedAt: null,
  }
}

// A quick description of the tutorial scenario for the onboarding catalogue.
export const DELTA_TUTORIAL_SCENARIO = {
  scenarioId: 'delta/2026/w41',
  title: 'Situation Desk — Delta, 8 Oct 2026',
  officeId: 'state/governor',
  stateCode: 'DT',
  seed: 0xc0ffee,
  subtitle: 'From the handover note: "You are eighteen months into a four-year term." The desk opens with the Week 41 bundle.',
}
