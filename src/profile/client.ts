// @mandate/profile/client — Supabase client + query shapes with graceful fallback.
//
// Production: reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from env at deploy (Vite).
// When those env vars are absent (local dev, or Vercel before the vars are set), the public
// client is null and the query layer falls back to the local canonical data — the Delta tutorial
// profile and the local federation reference — so the game boots without a live DB.
//
// This file does not store any key; env is injected by the build/deploy host.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Profile, FederationState, FederationLga, FederationParty, FederationOffice,
  PatronageEdge, AxisHistoryEntry, ScenarioStartState,
  ProfileIdentity, ProfileParty, ProfileOffice, ProfileAxes,
} from './types'
import { DEFAULT_AXES, normalizeProfile } from './types'
import {
  DELTA_TUTORIAL_STATE, DELTA_TUTORIAL_OFFICE, DELTA_TUTORIAL_SCENARIO,
  deltaTutorialProfile, FCT_MINISTER_OFFICE,
} from './delta-tutorial'

// ---- env access: returns undefined (not an error) when the var is absent. ----
//
// These reads MUST be static, literal `import.meta.env.VITE_*` tokens: Vite replaces them with
// the literal value at build time. Reading `import.meta` dynamically (e.g.
// `globalThis.import?.meta?.env`) is never replaced by the bundler and is always undefined at
// runtime, so the Supabase path would never be taken even when the deploy host has the vars.
// `window.__env` stays as an optional runtime override (e.g. server-injected config).
function getEnv(name: string): string | undefined {
  const buildEnv: Record<string, string | undefined> = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_SERVICE_ROLE_KEY: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  }
  const fromBuild = buildEnv[name]
  if (typeof fromBuild === 'string' && fromBuild) return fromBuild
  const fromWindow = (globalThis as any).__env?.[name]
  if (typeof fromWindow === 'string' && fromWindow) return fromWindow
  return undefined
}

// ---- Public client: null when Supabase is not configured. ----

let _publicClient: SupabaseClient | null = null
export function publicClient(): SupabaseClient | null {
  if (_publicClient) return _publicClient
  const url = getEnv('VITE_SUPABASE_URL')
  const key = getEnv('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    _publicClient = null
    return null
  }
  _publicClient = createClient(url, key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  })
  return _publicClient
}

// Admin/service-role client — for migrations, seeding, and admin queries only.
// Never shipped to the browser bundle in production; used by ops scripts.
// Kept separate from the graceful public path; still throws if you try to use it without env,
// because admin operations should never silently no-op.
let _adminClient: SupabaseClient | null = null
export function adminClient(): SupabaseClient {
  if (_adminClient) return _adminClient
  const url = getEnv('VITE_SUPABASE_URL')
  const key = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('missing env VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY — configure Supabase before using the admin client')
  }
  _adminClient = createClient(url, key, { auth: { persistSession: false } })
  return _adminClient
}

// ---- Supabase availability predicate (used by the app to pick the boot path). ----

export const supabaseConfigured = (): boolean => {
  const url = getEnv('VITE_SUPABASE_URL')
  const key = getEnv('VITE_SUPABASE_ANON_KEY')
  return Boolean(url && key)
}

// ---- Federation reference reads: live when configured, local fallback otherwise. ----

export async function listStates(): Promise<FederationState[]> {
  const client = publicClient()
  if (!client) {
    return [DELTA_TUTORIAL_STATE]
  }
  const { data, error } = await client
    .from('federation_states')
    .select('code, name, capital, tier, zone, senatorial_districts')
    .order('name')
  if (error) throw error
  return (data ?? []).map(r => ({
    code: r.code,
    name: r.name,
    capital: r.capital,
    tier: r.tier as 'state' | 'fct',
    zone: r.zone,
    senatorialDistricts: (r.senatorial_districts as string[]) ?? null,
  }))
}

export async function getStateByCode(code: string): Promise<FederationState | null> {
  const client = publicClient()
  if (!client) {
    return DELTA_TUTORIAL_STATE.code === code ? DELTA_TUTORIAL_STATE : null
  }
  const { data, error } = await client
    .from('federation_states')
    .select('code, name, capital, tier, zone, senatorial_districts')
    .eq('code', code)
    .single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return {
    code: data.code,
    name: data.name,
    capital: data.capital,
    tier: data.tier as 'state' | 'fct',
    zone: data.zone,
    senatorialDistricts: (data.senatorial_districts as string[]) ?? null,
  }
}

export async function listLgas(stateCode: string): Promise<FederationLga[]> {
  const client = publicClient()
  if (!client) {
    return []
  }
  const { data, error } = await client
    .from('federation_lgas')
    .select('id, state_code, name, fiscal_note')
    .eq('state_code', stateCode)
    .order('name')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id,
    stateCode: r.state_code,
    name: r.name,
    fiscalNote: r.fiscal_note,
  }))
}

export async function listParties(): Promise<FederationParty[]> {
  const client = publicClient()
  if (!client) {
    return [{ code: 'APC', name: 'All Progressives Congress', note: 'local fallback' }]
  }
  const { data, error } = await client
    .from('federation_parties')
    .select('code, name, note')
    .order('name')
  if (error) throw error
  return (data ?? []).map(r => ({
    code: r.code,
    name: r.name,
    note: r.note,
  }))
}

export async function listOffices(): Promise<FederationOffice[]> {
  const client = publicClient()
  if (!client) {
    return [DELTA_TUTORIAL_OFFICE]
  }
  const { data, error } = await client
    .from('federation_offices')
    .select('id, tier, post, route, jurisdiction, term_note, powers, revenue_map, authority_note, playable')
    .order('tier, post')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    tier: r.tier,
    post: r.post,
    route: r.route,
    jurisdiction: r.jurisdiction,
    termNote: r.term_note,
    playable: Boolean(r.playable),
    powers: (r.powers as string[]) ?? [],
    revenueMap: (r.revenue_map as Record<string, boolean>) ?? {},
    authorityNote: r.authority_note,
  }))
}

export async function getOfficesForTier(tier: 'state' | 'local'): Promise<FederationOffice[]> {
  const offices = await listOffices()
  return offices.filter(o => o.tier === tier)
}

// ---- Profile reads/writes: live when configured; no-op read fallback otherwise. ----

export async function findProfileById(id: string): Promise<Profile | null> {
  const client = publicClient()
  if (!client) return null
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('deleted_at', null)
    .single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return normalizeProfile(data)
}

export async function createProfile(input: {
  handle: string | null
  identity: ProfileIdentity
  office: ProfileOffice
  party: ProfileParty
  axes?: Partial<ProfileAxes>
  powers?: string[]
  patronageBank?: number
}): Promise<Profile> {
  const client = publicClient()
  if (!client) {
    // Graceful fallback: build the profile locally without a DB write.
    const axes: ProfileAxes = {
      ...DEFAULT_AXES,
      ...(input.axes ?? {}),
    }
    const identity = input.identity
    const office = input.office
    const party = input.party
    const powers = input.powers ?? []
    const patronageBank = input.patronageBank ?? 0
    return {
      id: 'local/' + input.handle,
      handle: input.handle ?? input.identity.name ?? 'UNKNOWN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      identity,
      office,
      party,
      axes,
      powers,
      patronageBank,
      deletedAt: null,
    }
  }
  const axes: ProfileAxes = {
    ...DEFAULT_AXES,
    ...(input.axes ?? {}),
  }
  const { data, error } = await client
    .from('profiles')
    .insert({
      handle: input.handle ?? input.identity.name ?? 'UNKNOWN',
      identity: input.identity,
      office: input.office,
      party: input.party,
      axes,
      powers: input.powers ?? [],
      patronageBank: input.patronageBank ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return normalizeProfile(data)
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'handle' | 'identity' | 'office' | 'party' | 'axes' | 'powers' | 'patronageBank'>>,
): Promise<Profile> {
  const client = publicClient()
  if (!client) {
    // Local-only update: return a patched copy. In a real profile flow this branch is
    // not the primary path; it exists so the app never crashes when Supabase is absent.
    const base = deltaTutorialProfile()
    return {
      ...base,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
  }
  const { data, error } = await client
    .from('profiles')
    .update({
      ...patch,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('deleted_at', null)
    .select()
    .single()
  if (error) throw error
  return normalizeProfile(data)
}

export async function softDeleteProfile(id: string): Promise<void> {
  const client = publicClient()
  if (!client) return
  const { error } = await client
    .from('profiles')
    .update({ deletedAt: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ---- Patronage network (owned by profile) ----

export async function listPatronage(profileId: string): Promise<PatronageEdge[]> {
  const client = publicClient()
  if (!client) return []
  const { data, error } = await client
    .from('patronage_network')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    profileId: r.profile_id,
    name: r.name,
    role: r.role,
    loyalty: r.loyalty,
    note: r.note,
    createdAt: r.created_at,
  }))
}

export async function addPatronage(input: {
  profileId: string
  name: string
  role: string
  loyalty?: number
  note?: string
}): Promise<PatronageEdge> {
  const client = publicClient()
  if (!client) {
    return {
      id: 'local/' + input.profileId + '/' + Date.now(),
      profileId: input.profileId,
      name: input.name,
      role: input.role,
      loyalty: input.loyalty ?? 3,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    }
  }
  const { data, error } = await client
    .from('patronage_network')
    .insert({
      profile_id: input.profileId,
      name: input.name,
      role: input.role,
      loyalty: input.loyalty ?? 3,
      note: input.note ?? '',
    })
    .select()
    .single()
  if (error) throw error
  return {
    id: data.id,
    profileId: data.profile_id,
    name: data.name,
    role: data.role,
    loyalty: data.loyalty,
    note: data.note,
    createdAt: data.created_at,
  }
}

export async function updatePatronageLoyalty(
  profileId: string,
  edgeId: string,
  loyalty: number,
): Promise<PatronageEdge | null> {
  const client = publicClient()
  if (!client) return null
  const { data, error } = await client
    .from('patronage_network')
    .update({ loyalty: Math.max(1, Math.min(5, loyalty)) })
    .eq('id', edgeId)
    .eq('profile_id', profileId)
    .select()
    .single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return {
    id: data.id,
    profileId: data.profile_id,
    name: data.name,
    role: data.role,
    loyalty: data.loyalty,
    note: data.note,
    createdAt: data.created_at,
  }
}

export async function removePatronage(profileId: string, edgeId: string): Promise<void> {
  const client = publicClient()
  if (!client) return
  const { error } = await client
    .from('patronage_network')
    .delete()
    .eq('id', edgeId)
    .eq('profile_id', profileId)
  if (error) throw error
}

// ---- Axis history (append-only; append from gameplay) ----

export async function appendAxisEvent(input: {
  profileId: string
  axis: string
  valueBp: number
  eventType: string
  source?: string
  week?: number
}): Promise<AxisHistoryEntry> {
  const client = publicClient()
  if (!client) {
    return {
      id: 'local/' + input.profileId + '/' + Date.now(),
      profileId: input.profileId,
      axis: input.axis,
      valueBp: Math.max(0, Math.min(10000, input.valueBp)),
      eventType: input.eventType,
      source: input.source ?? null,
      week: input.week ?? null,
      createdAt: new Date().toISOString(),
    }
  }
  const { data, error } = await client
    .from('profile_axis_history')
    .insert({
      profile_id: input.profileId,
      axis: input.axis,
      value_bp: Math.max(0, Math.min(10000, input.valueBp)),
      event_type: input.eventType,
      source: input.source ?? null,
      week: input.week ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return {
    id: data.id,
    profileId: data.profile_id,
    axis: data.axis,
    valueBp: data.value_bp,
    eventType: data.event_type,
    source: data.source,
    week: data.week,
    createdAt: data.created_at,
  }
}

export async function listAxisHistory(profileId: string, axis?: string): Promise<AxisHistoryEntry[]> {
  const client = publicClient()
  if (!client) return []
  const q = client.from('profile_axis_history').select('*').eq('profile_id', profileId)
  if (axis) q.eq('axis', axis)
  const { data, error } = await q.order('created_at')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    profileId: r.profile_id,
    axis: r.axis,
    valueBp: r.value_bp,
    eventType: r.event_type,
    source: r.source,
    week: r.week,
    createdAt: r.created_at,
  }))
}

// ---- Scenarios ----

export async function listScenarios(): Promise<ScenarioStartState[]> {
  const client = publicClient()
  if (!client) {
    return [scenarioStartStateFromTutorial()]
  }
  const { data, error } = await client
    .from('scenario_start_state')
    .select('id, scenario_id, title, office_id, state_code, seed, started_at')
    .order('title')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    scenarioId: r.scenario_id,
    title: r.title,
    officeId: r.office_id,
    stateCode: r.state_code,
    seed: r.seed,
    startedAt: r.started_at,
  }))
}

export async function findScenarioByScenarioId(scenarioId: string): Promise<ScenarioStartState | null> {
  const client = publicClient()
  if (!client) {
    return DELTA_TUTORIAL_SCENARIO.scenarioId === scenarioId
      ? scenarioStartStateFromTutorial()
      : null
  }
  // Read with an explicit ordering + limit rather than `.single()`. `.single()`
  // raises PGRST116 both when there are no rows and when there is more than one,
  // so a stray duplicate row would look exactly like "scenario not found" and
  // silently drop the caller onto the local fallback. Asking for the earliest row
  // keeps the lookup well-defined; the unique index on scenario_id (migration 001)
  // is what guarantees there is only ever one.
  const { data, error } = await client
    .from('scenario_start_state')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('started_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
  if (error) throw error
  const row = ((data ?? []) as any[])[0]
  if (!row) return null
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    title: row.title,
    officeId: row.office_id,
    stateCode: row.state_code,
    seed: row.seed,
    startedAt: row.started_at,
  }
}

// ---- Local fallback surface for the onboarding boot. ----

/** When Supabase is absent, the onboarding shell falls back to the Delta tutorial scenario. */
export const defaultFederationReference = {
  states: [DELTA_TUTORIAL_STATE] as FederationState[],
  offices: [DELTA_TUTORIAL_OFFICE, FCT_MINISTER_OFFICE] as FederationOffice[],
  parties: [{ code: 'APC', name: 'All Progressives Congress', note: 'local fallback' }] as FederationParty[],
}

export function defaultScenarioStartState(): ScenarioStartState {
  return scenarioStartStateFromTutorial()
}

function scenarioStartStateFromTutorial(): ScenarioStartState {
  return {
    id: 'delta/2026/w41',
    scenarioId: DELTA_TUTORIAL_SCENARIO.scenarioId,
    title: DELTA_TUTORIAL_SCENARIO.title,
    officeId: DELTA_TUTORIAL_OFFICE.id,
    stateCode: DELTA_TUTORIAL_STATE.code,
    seed: DELTA_TUTORIAL_SCENARIO.seed,
    startedAt: new Date().toISOString(),
  }
}
