/* @mandate/sim/game-state — the player's life.
 *
 * A life is a SAVE, not a reset. The registry is append-only: starting a new life adds a
 * row and leaves every other life untouched, so the desk can carry a 2026 councillor, a
 * 2051 godfather and the protégé you start after your first character dies. Nothing here
 * ever wipes storage.
 *
 * Axes are the same 0..100 scale the NPCs use, so player and cast are directly comparable
 * in the roll formula in events.ts.
 */

import type { NpcAxes, Relationship } from './npcs'
import type { Position } from './positions'
import type { EventTier } from './events'

export type Axes = NpcAxes

export type LifeEventKind =
  | 'office' | 'decision' | 'betrayal' | 'alliance' | 'loss'
  | 'unemployment' | 'return' | 'press' | 'death' | 'election'

export interface LifeEvent {
  date: string
  kind: LifeEventKind
  summary: string
  /** the other actor in the story, when there is one */
  vs?: string
}

export interface SaveState {
  id: string
  playerName: string
  startDate: string
  date: string
  positionId: string | null
  partyCode: string | null
  axes: Axes
  /** integer ₦ */
  bank: number
  isUnemployed: boolean
  unemploymentStart: string | null
  history: LifeEvent[]
  /** the player's side of the relationship matrix, snapshotted for the save */
  relationships: Relationship[]
  createdAt: string
  retiredAt: string | null
}

/** Append-only: a new life never removes or edits another. */
export interface LifeRegistry {
  activeId: string
  lives: SaveState[]
}

/** What a week of the living world does to the player. */
export interface PlayerTurn {
  date: string
  /** proposals addressed to the player, with the acting NPC already resolved */
  addressedToPlayer: { npcId: string; npcName: string; kind: 'bribe' | 'favour' | 'leak' | 'truce' | 'outreach'; detail: string; amountNaira?: number }[]
  /** seats the player took or lost this week */
  officesGained: string[]
  officesLost: string[]
  /** deaths of people the player has a relationship with */
  deathsOfKnown: { npcId: string; name: string }[]
  /** elections that produced the above */
  elections: string[]
}

export const NEUTRAL_AXES: Axes = {
  competence: 50,
  integrity: 50,
  popularity: 50,
  partyLoyalty: 50,
  eliteTrust: 50,
  pressTone: 0,
  constituency: 50,
  patronage: 50,
  legitimacy: 60,
  memory: 30,
}

export interface NewLifeOptions {
  id: string
  playerName: string
  positionId: string | null
  partyCode: string | null
  startDate?: string
  axes?: Partial<Axes>
  bank?: number
  relationships?: Relationship[]
}

export function newLife(opts: NewLifeOptions): SaveState {
  const startDate = opts.startDate ?? '2026-01-01'
  return {
    id: opts.id,
    playerName: opts.playerName,
    startDate,
    date: startDate,
    positionId: opts.positionId,
    partyCode: opts.partyCode,
    axes: { ...NEUTRAL_AXES, ...opts.axes },
    bank: opts.bank ?? 0,
    isUnemployed: opts.positionId === null,
    unemploymentStart: opts.positionId === null ? startDate : null,
    history: [],
    relationships: opts.relationships ?? [],
    createdAt: startDate,
    retiredAt: null,
  }
}

export function createRegistry(first: SaveState): LifeRegistry {
  return { activeId: first.id, lives: [first] }
}

/** Add a life and make it active. Existing lives are preserved exactly. */
export function createLife(registry: LifeRegistry, life: SaveState): LifeRegistry {
  return { activeId: life.id, lives: [...registry.lives, life] }
}

export function activeLife(registry: LifeRegistry): SaveState | undefined {
  return registry.lives.find(l => l.id === registry.activeId)
}

export function selectLife(registry: LifeRegistry, id: string): LifeRegistry {
  if (!registry.lives.some(l => l.id === id)) return registry
  return { ...registry, activeId: id }
}

/** End a life without deleting it: the legacy screen still needs the whole history. */
export function retireLife(registry: LifeRegistry, id: string, reason: string): LifeRegistry {
  return {
    ...registry,
    lives: registry.lives.map(l => l.id === id
      ? { ...l, retiredAt: l.date, history: [...l.history, { date: l.date, kind: 'death' as LifeEventKind, summary: reason }] }
      : l),
  }
}

/** Start as your own protégé: a brand-new life, same world, no reset of the old one. */
export function startAsProtege(registry: LifeRegistry, opts: NewLifeOptions): LifeRegistry {
  const previous = activeLife(registry)
  const life = newLife({
    ...opts,
    startDate: opts.startDate ?? previous?.date ?? '2026-01-01',
    relationships: opts.relationships ?? [],
  })
  const seeded: SaveState = previous
    ? { ...life, history: [{ date: life.startDate, kind: 'office' as LifeEventKind, summary: `Protégé of ${previous.playerName}.` }] }
    : life
  return createLife(registry, seeded)
}

/** Which decision desk a seat runs. Unemployed overrides everything.
 *  A minister runs a ministry, so ``appointed`` federal seats sit at the executive desk. */
export function tierForPosition(position: Position | undefined, isUnemployed: boolean): EventTier {
  if (isUnemployed || !position) return 'unemployed'
  if (position.tier === 'lga') return 'lga'
  if (position.tier === 'ward') return 'ward'
  const legislative = position.arm === 'legislative' || position.arm === 'judicial'
  if (position.tier === 'federal') return legislative ? 'federal-legislative' : 'federal-executive'
  return legislative ? 'state-legislative' : 'state-executive'
}

function clampAxis(key: keyof Axes, value: number): number {
  return key === 'pressTone' ? Math.max(-100, Math.min(100, value)) : Math.max(0, Math.min(100, value))
}

export function adjustAxes(axes: Axes, deltas: Partial<Axes>): Axes {
  const next = { ...axes }
  for (const [rawKey, delta] of Object.entries(deltas)) {
    if (delta === undefined) continue
    const key = rawKey as keyof Axes
    next[key] = clampAxis(key, next[key] + delta)
  }
  return next
}

/** Apply one week of the living world to a save. Pure: returns a new save. */
export function applyTurn(life: SaveState, turn: PlayerTurn): SaveState {
  let next: SaveState = { ...life, date: turn.date }
  const history: LifeEvent[] = [...life.history]

  for (const addressed of turn.addressedToPlayer) {
    if (addressed.kind === 'leak') {
      history.push({ date: turn.date, kind: 'press', summary: addressed.detail, vs: addressed.npcId })
    } else if (addressed.kind === 'truce') {
      history.push({ date: turn.date, kind: 'alliance', summary: addressed.detail, vs: addressed.npcId })
    } else {
      history.push({ date: turn.date, kind: 'decision', summary: addressed.detail, vs: addressed.npcId })
    }
  }
  for (const seat of turn.officesGained) {
    history.push({ date: turn.date, kind: 'office', summary: `Took office: ${seat}.` })
  }
  for (const seat of turn.officesLost) {
    history.push({ date: turn.date, kind: 'loss', summary: `Lost office: ${seat}.` })
  }
  for (const dead of turn.deathsOfKnown) {
    history.push({ date: turn.date, kind: 'death', summary: `${dead.name} is dead.`, vs: dead.npcId })
  }

  if (turn.officesGained.length > 0) {
    next = { ...next, isUnemployed: false, unemploymentStart: null }
  }
  if (turn.officesLost.length > 0 && turn.officesGained.length === 0) {
    next = { ...next, isUnemployed: true, unemploymentStart: life.unemploymentStart ?? turn.date }
    history.push({ date: turn.date, kind: 'unemployment', summary: 'Out of office. The desk is now a phone and a list of names.' })
  }
  return { ...next, history }
}

/** One week later, on the same weekday. */
export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Serialise a registry for storage; keeps every life. */
export function serializeRegistry(registry: LifeRegistry): string {
  return JSON.stringify({ version: 1, registry })
}

export function deserializeRegistry(raw: string): LifeRegistry | null {
  try {
    const parsed = JSON.parse(raw) as { version?: number; registry?: LifeRegistry }
    if (!parsed?.registry || !Array.isArray(parsed.registry.lives) || parsed.registry.lives.length === 0) return null
    return parsed.registry
  } catch {
    return null
  }
}
