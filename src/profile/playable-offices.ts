// @mandate/profile/playable-offices — the offices a player may take at first-open.
//
// This mirrors the rows marked `playable = true` in federation_offices (migration 003):
// one elected executive per tier, plus the FCT's appointed administrator. The catalogue
// table stays the source of truth for powers/revenue/jurisdiction; this module exists so
// the picker still renders when there is no live database, and so the tier grouping is
// defined once for the boot merge, the optimistic path and the tests.
//
//   federal/president — the Federation
//   state/governor    — the 36 states (the FCT has no governorship: s.299)
//   fct/minister      — the Federal Capital Territory, served by an appointed Minister
//   local/chairman    — the 774 LGAs

import type { FederationOffice, Tier } from './types'
import { DELTA_TUTORIAL_OFFICE, FCT_MINISTER_OFFICE } from './delta-tutorial'

export const PRESIDENT_OFFICE: FederationOffice = {
  id: 'federal/president',
  tier: 'federal',
  post: 'President',
  route: 'elected',
  jurisdiction: 'nation',
  termNote: '4-year term; Commander-in-Chief by convention.',
  powers: ['sign.memo', 'appoint.minister', 'receive.faac', 'budget.allocate', 'command.convention'],
  revenueMap: { faac_net: true, derivation: true, federal_refund: true },
  authorityNote: 'ss.130-134 · Commander-in-Chief by convention',
  playable: true,
}

export const LGA_CHAIRMAN_OFFICE: FederationOffice = {
  id: 'local/chairman',
  tier: 'local',
  post: 'Chairman, Local Government',
  route: 'elected',
  jurisdiction: 'lga',
  termNote: '3-year term; the third tier — funds arrive through the state joint account.',
  powers: ['legislate.lga', 'allocate.lga', 'oversight.ward'],
  revenueMap: { lga_allocation: true },
  authorityNote: 's.7 · Local Government Councils',
  playable: true,
}

/** The playable set, in the order the picker groups them. */
export const PLAYABLE_OFFICES: FederationOffice[] = [
  PRESIDENT_OFFICE,
  DELTA_TUTORIAL_OFFICE, // state/governor
  FCT_MINISTER_OFFICE,
  LGA_CHAIRMAN_OFFICE,
].map(o => ({ ...o, playable: true }))

export const TIER_ORDER: Tier[] = ['federal', 'state', 'fct', 'local']

export const TIER_LABEL: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  fct: 'Federal Capital Territory',
  local: 'Local Government',
}
