/* @mandate/profile/lives — the player's lives, on disk.
 *
 * A new life is a NEW ROW. Nothing here ever clears the desk's key, the profile key or any
 * other life: `createNewLife` and `startProtegeLife` append, `retireActiveLife` marks an
 * ending, and the old lives stay readable for the legacy screen. Storage is injectable so
 * the whole module is testable without a browser.
 *
 * The desk's own persistence (mandate.desk.v1) is deliberately a different key: the desk is
 * one scenario, the lives are the century.
 */

import {
  newLife, createRegistry, createLife, selectLife, retireLife, startAsProtege,
  serializeRegistry, deserializeRegistry, activeLife,
  type LifeRegistry, type SaveState, type NewLifeOptions,
} from '../sim/game-state'

export const LIVES_KEY = 'mandate.lives.v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface NewLifeInput {
  playerName: string
  positionId: string | null
  partyCode: string | null
  startDate?: string
  bank?: number
  axes?: NewLifeOptions['axes']
}

function nextLifeId(registry: LifeRegistry | null): string {
  const n = (registry?.lives.length ?? 0) + 1
  return `life-${n}`
}

export function loadLives(storage: StorageLike): LifeRegistry | null {
  try {
    const raw = storage.getItem(LIVES_KEY)
    return raw ? deserializeRegistry(raw) : null
  } catch {
    return null
  }
}

export function saveLives(storage: StorageLike, registry: LifeRegistry): void {
  storage.setItem(LIVES_KEY, serializeRegistry(registry))
}

/** Start a life. The first life seeds the registry; every later one is appended. */
export function createNewLife(storage: StorageLike, input: NewLifeInput): LifeRegistry {
  const existing = loadLives(storage)
  const life: SaveState = newLife({
    id: nextLifeId(existing),
    playerName: input.playerName,
    positionId: input.positionId,
    partyCode: input.partyCode,
    startDate: input.startDate,
    bank: input.bank,
    axes: input.axes,
  })
  const registry = existing ? createLife(existing, life) : createRegistry(life)
  saveLives(storage, registry)
  return registry
}

/** The life you are playing, if any. */
export function currentLife(storage: StorageLike): SaveState | null {
  const registry = loadLives(storage)
  return registry ? activeLife(registry) ?? null : null
}

export function switchToLife(storage: StorageLike, id: string): LifeRegistry | null {
  const registry = loadLives(storage)
  if (!registry || !registry.lives.some(l => l.id === id)) return registry
  const next = selectLife(registry, id)
  saveLives(storage, next)
  return next
}

/** End the active life without deleting it — the legacy screen still needs the history. */
export function retireActiveLife(storage: StorageLike, reason: string): LifeRegistry | null {
  const registry = loadLives(storage)
  if (!registry) return null
  const next = retireLife(registry, registry.activeId, reason)
  saveLives(storage, next)
  return next
}

/** Begin again as your own protégé: a new row, same world, both lives kept. */
export function startProtegeLife(storage: StorageLike, input: NewLifeInput): LifeRegistry {
  const existing = loadLives(storage)
  const opts: NewLifeOptions = {
    id: nextLifeId(existing),
    playerName: input.playerName,
    positionId: input.positionId,
    partyCode: input.partyCode,
    startDate: input.startDate,
    bank: input.bank,
    axes: input.axes,
  }
  const registry = existing ? startAsProtege(existing, opts) : createRegistry(newLife(opts))
  saveLives(storage, registry)
  return registry
}

/** The legacy screen's list: every life, newest first, ended ones included. */
export function lifeList(storage: StorageLike): SaveState[] {
  const registry = loadLives(storage)
  if (!registry) return []
  return [...registry.lives].reverse()
}

/** Load the axes and bank for one life from the on-device registry.
 *  Used by the living desk to restore a player's record across a reload
 *  (src/living-desk.ts `restorePlayerFromSave`). Returns null when there is
 *  no registry on file, or no life with that id.
 */
export function loadSave(
  storage: StorageLike,
  lifeId: string | null | undefined,
): { axes: SaveState['axes']; bank: SaveState['bank'] } | null {
  if (!lifeId) return null
  const registry = loadLives(storage)
  if (!registry) return null
  const life = registry.lives.find(l => l.id === lifeId)
  if (!life) return null
  return { axes: life.axes, bank: life.bank }
}

/** Push a lives registry to the Supabase saves table (one row per life, profile_id = profileId).
 *  Used when Supabase Auth is active so lives survive across devices for the signed-in user.
 *  Returns the number of rows touched (inserted + updated). Only for authenticated contexts:
 *  RLS (migration 004) scopes saves to profile_id = auth.uid().
 */
export async function syncLivesToSupabase(
  client: { from: (t: string) => any } | null,
  profileId: string,
  registry: LifeRegistry,
): Promise<{ upserted: number }> {
  if (!client) return { upserted: 0 }
  let upserted = 0
  for (const life of registry.lives) {
    const { error } = await client.from('saves').upsert({
      id: life.id,
      profile_id: profileId,
      player_name: life.playerName,
      start_date: life.startDate,
      date_current: life.date,
      position_id: life.positionId,
      party_code: life.partyCode,
      axes: life.axes,
      bank: life.bank,
      history: life.history,
      is_unemployed: life.isUnemployed,
      unemployment_start: life.unemploymentStart,
      retired_at: life.retiredAt,
    }, { onConflict: 'id' })
    if (!error) upserted++
  }
  return { upserted }
}

/** Pull lives from the Supabase saves table into a LifeRegistry. Returns null when Supabase
 *  is not configured or the table is empty. The returned registry uses life ids as-is from the
 *  database so they survive across devices; nextLifeId will continue from the count.
 */
export async function loadLivesFromSupabase(
  client: { from: (t: string) => any } | null,
  profileId: string,
): Promise<LifeRegistry | null> {
  if (!client) return null
  const { data, error } = await client
    .from('saves')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
  if (error) return null
  if (!data || data.length === 0) return null
  const lives = data.map((r: any) => ({
    id: r.id,
    playerName: r.player_name,
    startDate: r.start_date,
    date: r.date_current,
    positionId: r.position_id,
    partyCode: r.party_code,
    axes: r.axes,
    bank: r.bank,
    history: r.history ?? [],
    isUnemployed: r.is_unemployed,
    unemploymentStart: r.unemployment_start,
    retiredAt: r.retired_at,
    createdAt: r.created_at,
    relationships: [],
  }))
  const activeId = lives[0]?.id ?? null
  return {
    activeId,
    lives,
  }
}

/** A one-line summary of a life for the legacy screen. */
export function lifeSummary(life: SaveState): string {
  const last = life.history.length ? life.history[life.history.length - 1] : undefined
  const span = `${life.startDate} → ${life.retiredAt ?? life.date}`
  return `${life.playerName} · ${span}${last ? ` · ${last.summary}` : ''}`
}
