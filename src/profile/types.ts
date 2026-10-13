// @mandate/profile — types for the persistent player profile + federation reference data.
// This layer is Supabase-backed in production and mirrors the model in the design note.
// Axes are in basis points (0..10000) to stay compatible with the sim's BP model.

export type Tier = 'federal' | 'state' | 'local' | 'fct'
export type Route = 'elected' | 'appointed' | 'nomination'
export type Jurisdiction =
  | 'nation'
  | 'state'
  | 'lga'
  | 'territory' /* the FCT — federal territory, not a state (s.299) */
  | 'constituency'
  | 'senatorial_district'
  | 'ministry'
  | 'agency'
  | 'office'
  | 'house'
  | 'senate'
  | 'ward'
  | 'party'
  | 'faction'

export interface ProfileIdentity {
  name: string
  stateCode: string // federation_states.code
  lgaName: string | null
  senatorialDistrict: string | null
  age: number | null
}

export interface ProfileParty {
  current: string | null // federation_parties.code
  history: { party: string; window: string }[] // {party code, e.g. "2019-2023"}
  defectionRisk: number // 0..1, app-level probability for prologue/switch modelling
}

export interface ProfileAxes {
  competence: number // 0..10000 bp
  integrity: number
  popularSupport: number
  partyLoyalty: number
  eliteTrust: number
  pressTone: number // signed; -10000..10000
  constituencyAlignment: number // 0..10000 bp
  patronageBank: number // naira (not bp)
  mandateLegitimacy: number // 0..10000 bp
  institutionalMemory: number // 0..10000 bp
}

export interface ProfileOffice {
  tier: Tier
  post: string // federation_offices.post (human label)
  elected: boolean
  termStart: string // ISO yyyy-mm-dd where applicable
  officeId: string // federation_offices.id
}

export interface Profile {
  id: string // UUID
  handle: string
  createdAt: string
  updatedAt: string
  identity: ProfileIdentity
  office: ProfileOffice
  party: ProfileParty
  axes: ProfileAxes
  powers: string[] // denormalized from federation_offices.powers
  patronageBank: number
  deletedAt: string | null
}

export interface FederationState {
  code: string
  name: string
  capital: string
  tier: 'state' | 'fct'
  zone: string | null
  senatorialDistricts: string[] | null
}

export interface FederationLga {
  id: string
  stateCode: string
  name: string
  fiscalNote: string
}

export interface FederationParty {
  code: string
  name: string
  note: string
}

export interface FederationOffice {
  id: string
  tier: Tier
  /** offered by the post picker (federation_offices.playable, migration 003) */
  playable?: boolean
  post: string
  route: Route
  jurisdiction: Jurisdiction
  termNote: string
  powers: string[]
  revenueMap: Record<string, boolean>
  authorityNote: string
}

export interface PatronageEdge {
  id: string
  profileId: string
  name: string
  role: string
  loyalty: number // 1..5
  note: string
  createdAt: string
}

export interface AxisHistoryEntry {
  id: string
  profileId: string
  axis: string
  valueBp: number
  eventType: string
  source: string | null
  week: number | null
  createdAt: string
}

export interface ScenarioStartState {
  id: string
  scenarioId: string
  title: string
  officeId: string
  stateCode: string
  seed: number
  startedAt: string
}

export interface Scenario {
  id: string
  title: string
  officeId: string
  stateCode: string
  seed: number
}

// Axes keys, kept in one place so the app and the sim agree.
export const AXIS_KEYS = [
  'competence',
  'integrity',
  'popularSupport',
  'partyLoyalty',
  'eliteTrust',
  'pressTone',
  'constituencyAlignment',
  'patronageBank',
  'mandateLegitimacy',
  'institutionalMemory',
] as const
export type AxisKey = typeof AXIS_KEYS[number]

// Default axes for a newly-created profile (neutral, not heroic).
export const DEFAULT_AXES: ProfileAxes = {
  competence: 5000,
  integrity: 5000,
  popularSupport: 5000,
  partyLoyalty: 5000,
  eliteTrust: 5000,
  pressTone: 0,
  constituencyAlignment: 5000,
  patronageBank: 0,
  mandateLegitimacy: 6000,
  institutionalMemory: 3000,
}

// Bounds used by the app for validation/display.
export const AXIS_MAX_BP = 10000
export const AXIS_MIN_BP = 0

// Profile normalization used by the client to turn Supabase rows into the app type.
export function normalizeProfile(row: {
  id: string
  handle: string
  created_at: string
  updated_at: string
  identity: ProfileIdentity
  office: ProfileOffice
  party: ProfileParty
  axes: ProfileAxes
  powers: string[]
  patronage_bank: number
  deleted_at: string | null
}): Profile {
  return {
    id: row.id,
    handle: row.handle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    identity: row.identity,
    office: row.office,
    party: row.party,
    axes: row.axes,
    powers: row.powers ?? [],
    patronageBank: row.patronage_bank,
    deletedAt: row.deleted_at,
  }
}
