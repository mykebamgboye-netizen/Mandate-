/* @mandate/sim/npcs — the cast, and the brain that runs it.
 *
 * The federation is not populated with static chips. 250 key actors hold the senior
 * offices, run their own ambitions, build coalitions, leak what they hold, solicit what
 * they need and die; the remaining seats are held by background actors generated on demand
 * from the same seed, so every one of the catalogue's seats has a named holder without
 * materialising ten thousand full agents.
 *
 * The weekly loop is `npcWeekly(npc, world) → NpcAction[]`. It is PURE: it proposes, it
 * never mutates. `living.ts` applies the proposals. That split is what makes the brain
 * replayable and testable, and it is what lets it run in a worker: a worker only needs
 * `(seed, npcId, week, world)` to reproduce a week exactly.
 *
 * Determinism: every draw comes from a stream derived from (seed, npc id, week), so an
 * NPC's week never depends on the order the cast is processed in.
 */

import { sfc32, subSeed, hash32, randInt, pick, pickIndex, chanceBp } from './rng'
import { pickName, zoneOfState, type GeneratedName, type Zone } from './names'
import { STATES, STATE_BY_CODE } from './geo'
import type { Position, PositionTier, SeatIndex } from './positions'
import type { Party } from './parties'
import type { MediaOutlet } from './media'
import { friendliestOutlet, harshestOutlet } from './media'

export type NpcTrait =
  | 'vindictive' | 'media_savvy' | 'corruptible' | 'loyal' | 'ruthless'
  | 'cautious' | 'charismatic' | 'debt_ridden' | 'doctrinaire' | 'compromised'

export interface NpcAxes {
  competence: number     // 0..100
  integrity: number
  popularity: number
  partyLoyalty: number
  eliteTrust: number
  pressTone: number      // -100..100
  constituency: number
  patronage: number
  legitimacy: number
  memory: number
}

export interface NpcHistoryEntry {
  date: string
  event: string
  detail?: string
  /** the other actor in the story */
  vs?: string
}

export interface NpcAmbition {
  /** a position id, or a tier keyword ('governor', 'president', 'senator') */
  target: string
  by: number
}

export interface Npc {
  id: string
  name: string
  given: string
  family: string
  initials: string
  title: string | null
  gender: 'f' | 'm'
  born: number
  homeState: string
  zone: Zone
  positionId: string | null
  partyCode: string | null
  /** e.g. 'Old Guard' — the party faction they sit in */
  faction: string | null
  ambition: NpcAmbition | null
  axes: NpcAxes
  /** integer naira. The ledger (bigint kobo) remains the authority for money the player moves. */
  bank: number
  traits: NpcTrait[]
  history: NpcHistoryEntry[]
  isAlive: boolean
  lastActionDate: string | null
  /** terms already served in public office — the bar most seats are gated on */
  termsServed: number
  /** the last time this actor declared for something — one campaign per cycle, not per week */
  lastCandidacyDate: string | null
  /** true for the 250 who run the weekly loop */
  key: boolean
}

export interface Blackmail {
  type: 'video' | 'document' | 'witness' | 'ledger'
  severity: 1 | 2 | 3
  holderId: string
  exposureRiskBp: number
}

export interface Relationship {
  npcId: string
  trust: number          // -100 (enemy) .. 100 (blood oath)
  debt: number           // ₦ you owe them
  theyOweYou: number     // ₦ they owe you
  blackmail: Blackmail | null
  sharedSecrets: number
  lastInteraction: string | null
  interactionCount: number
}

export type NpcActionType =
  | 'death' | 'retire' | 'declare_candidacy' | 'outreach' | 'build_coalition'
  | 'propose_truce' | 'request_favor' | 'leak_blackmail' | 'solicit_bribe'
  | 'plant_story' | 'fund_protege' | 'lobby_appointment' | 'consider_betrayal'
  | 'defect' | 'take_office' | 'lose_seat'

export interface NpcAction {
  type: NpcActionType
  npcId: string
  targetId?: string
  amountNaira?: number
  detail: string
}

/** The world as an NPC sees it. `relationships` is directed: who → whom → relationship. */
export interface NpcWorld {
  seed: number
  /** ISO date of the Monday being run */
  date: string
  week: number
  year: number
  positions: ReadonlyMap<string, Position>
  /** pre-resolved seat lookups — see buildSeatIndex in positions.ts */
  seats: SeatIndex
  /** actor id → actor. The brain runs 250 actors × ~275 edges × 5,200 weeks; a linear
   *  scan per lookup would be tens of billions of comparisons. */
  index: ReadonlyMap<string, Npc>
  parties: readonly Party[]
  npcs: Npc[]
  relationships: Map<string, Map<string, Relationship>>
  media: MediaOutlet[]
  players: { id: string; bank: number; positionId: string | null }[]
}

// ---------------------------------------------------------------------------
// traits, axes, ambition
// ---------------------------------------------------------------------------

const ALL_TRAITS: readonly NpcTrait[] = [
  'vindictive', 'media_savvy', 'corruptible', 'loyal', 'ruthless',
  'cautious', 'charismatic', 'debt_ridden', 'doctrinaire', 'compromised',
]

export function ageOf(npc: Npc, year: number): number {
  return year - npc.born
}

/** Whole years between two ISO dates (b − a). */
export function yearsBetween(fromISO: string, toISO: string): number {
  return Math.floor((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / (365.25 * 86_400_000))
}

/** Seats, ranked — used to hand the senior offices to the key cast. */
export function seniorityRank(p: Position): number {
  const tierWeight: Record<PositionTier, number> = { federal: 4_000_000, state: 3_000_000, lga: 2_000_000, ward: 1_000_000 }
  const armWeight = p.arm === 'executive' ? 900_000 : p.arm === 'legislative' ? 500_000 : 100_000
  return tierWeight[p.tier] + armWeight + p.salaryMonthly
}

function ambitionTargetsFor(position: Position | undefined): readonly string[] {
  if (!position) return ['federal/rep', 'state/governor', 'lga']
  switch (position.tier) {
    case 'ward': return ['lga/chairman', 'federal/rep', 'state/assembly']
    case 'lga': return ['federal/rep', 'state/governor', 'federal/senator']
    case 'state': return position.arm === 'executive'
      ? ['federal/president', 'federal/senator', 'federal/minister']
      : ['state/governor', 'federal/senator', 'federal/rep']
    case 'federal':
    default: return position.arm === 'executive'
      ? ['federal/president', 'state/governor']
      : ['state/governor', 'federal/senator', 'federal/minister']
  }
}

/** A per-(npc, week) stream. Order-independent: safe for a worker to run in any order. */
export function weeklyStream(seed: number, npcId: string, week: number): () => number {
  const h = subSeed(seed, `${npcId}:${week}`)
  return sfc32(h, hash32(`${npcId}:w${week}`), (h ^ 0x85ebca6b) >>> 0, (h + 0x165667b1) >>> 0)
}

// ---------------------------------------------------------------------------
// generation
// ---------------------------------------------------------------------------

/** Plausible bank roll for a seat: salary × years served × a private multiplier. */
function bankFor(next: () => number, position: Position | null): number {
  if (!position) return randInt(next, 0, 40) * 1_000_000
  const years = randInt(next, 1, 12)
  const multiplier = randInt(next, 2, 60) // private money beyond the salary line
  return position.salaryMonthly * 12 * years * multiplier
}

function axesFor(next: () => number, position: Position | null): NpcAxes {
  const senior = position ? (position.tier === 'federal' ? 12 : position.tier === 'state' ? 8 : 0) : 4
  const roll = (lo: number, hi: number) => randInt(next, lo, hi)
  return {
    competence: roll(30, 88) + senior,
    integrity: roll(15, 85),
    popularity: roll(25, 85),
    partyLoyalty: roll(35, 95),
    eliteTrust: roll(25, 88) + senior,
    pressTone: roll(-60, 55),
    constituency: roll(30, 90),
    patronage: roll(20, 90) + senior,
    legitimacy: roll(30, 85),
    memory: roll(20, 90),
  }
}

function traitsFor(next: () => number, axes: NpcAxes): NpcTrait[] {
  const traits: NpcTrait[] = []
  if (chanceBp(next, 10000 - axes.integrity * 70)) traits.push('corruptible')
  if (chanceBp(next, 3000)) traits.push('media_savvy')
  if (chanceBp(next, 2200)) traits.push('vindictive')
  if (chanceBp(next, 2500)) traits.push('ruthless')
  if (axes.partyLoyalty > 80 && chanceBp(next, 4000)) traits.push('loyal')
  if (chanceBp(next, 2800)) traits.push('cautious')
  if (axes.popularity > 70 && chanceBp(next, 3500)) traits.push('charismatic')
  if (chanceBp(next, 1800)) traits.push('debt_ridden')
  if (axes.memory > 75 && chanceBp(next, 2500)) traits.push('doctrinaire')
  if (chanceBp(next, 1500)) traits.push('compromised')
  if (traits.length === 0) traits.push(pick(next, ALL_TRAITS))
  return [...new Set(traits)]
}

/** Weighted party draw — PA is the largest machine, NNI the smallest. */
function drawParty(next: () => number, parties: readonly Party[]): Party {
  const weights = parties.map(p => ({ p, w: p.code === 'PA' ? 26 : p.code === 'PDM' ? 20 : p.code === 'NCP' ? 16 : p.code === 'LRP' ? 9 : p.code === 'UPP' ? 8 : p.code === 'ADC' ? 8 : p.code === 'APF' ? 7 : 6 }))
  const total = weights.reduce((a, x) => a + x.w, 0)
  let roll = pickIndex(next, total)
  for (const { p, w } of weights) {
    if (roll < w) return p
    roll -= w
  }
  return weights[0]!.p
}

function factionOf(party: Party, next: () => number): string {
  return party.factions.length ? pick(next, party.factions).name : 'Old Guard'
}

export function generateActor(
  seed: number,
  streamKey: string,
  position: Position | null,
  parties: readonly Party[],
  opts: { partyCode?: string; key?: boolean; born?: number; titleBp?: number; /** the year the actor enters the story — ages are relative to it */ year?: number } = {},
): Npc {
  const next = sfc32(
    subSeed(seed, streamKey),
    hash32(`${streamKey}:a`),
    hash32(`${streamKey}:b`),
    hash32(`${streamKey}:c`),
  )
  const party = opts.partyCode
    ? parties.find(p => p.code === opts.partyCode) ?? drawParty(next, parties)
    : drawParty(next, parties)
  const homeState = position?.stateCode ?? pick(next, STATES).code
  const zone = zoneOfState(STATE_BY_CODE.get(homeState))
  const female = chanceBp(next, 2800)
  const name: GeneratedName = pickName(next, zone, { femaleBp: female ? 10000 : 0, titleBp: opts.titleBp ?? 2200 })
  const axes = axesFor(next, position)
  const entryYear = opts.year ?? 2026
  const born = opts.born ?? entryYear - randInt(next, 33, 71)
  const id = streamKey
  return {
    id,
    name: name.name,
    given: name.given,
    family: name.family,
    initials: name.initials,
    title: name.title,
    gender: female ? 'f' : 'm',
    born,
    homeState,
    zone,
    positionId: position?.id ?? null,
    partyCode: party.code,
    faction: factionOf(party, next),
    ambition: null,
    axes,
    bank: bankFor(next, position),
    traits: traitsFor(next, axes),
    history: born < 2000 ? [{ date: `${born + 30}-01`, event: 'first office', detail: 'entered public life' }] : [],  isAlive: true,
  lastActionDate: null,
  termsServed: position ? randInt(next, 0, 3) : 0,
  lastCandidacyDate: null,
  key: opts.key ?? true,
  }
}

/** The 250 key actors: the senior seats, the party chairmen and the men who own the party
 *  without holding anything. */
export function generateKeyCast(
  seed: number,
  positions: readonly Position[],
  parties: readonly Party[],
  count = 250,
): Npc[] {
  const chairmenCount = parties.length
  const elderCount = 12
  const seatCount = Math.max(0, count - chairmenCount - elderCount)
  const byId = new Map(positions.map(p => [p.id, p]))
  const cast: Npc[] = []
  const used = new Set<string>()
  const take = (ids: readonly string[], howMany = ids.length) => {
    let taken = 0
    for (const id of ids) {
      if (taken >= howMany || cast.length >= seatCount) break
      const position = byId.get(id)
      if (!position || used.has(id)) continue
      used.add(id)
      cast.push(generateActor(seed, `npc/seat/${position.id}`, position, parties))
      taken += 1
    }
  }
  const idsWhere = (test: (p: Position) => boolean) => positions.filter(test).map(p => p.id)

  // Composition matters more than pure rank: a cast of 109 senators and 121 reps would
  // have no governors in it, and the governorship is where the intrigue lives. So the 230
  // seats are handed out by office: the federal executive, every governorship and deputy,
  // every state speakership, and then the most senior legislators by ranking.
  take(idsWhere(p => p.id === 'federal/president' || p.id === 'federal/vice-president'))
  take(idsWhere(p => p.id.startsWith('federal/minister/')))
  take(idsWhere(p => p.id.endsWith('/governor') || p.id.endsWith('/deputy-governor')))
  take(idsWhere(p => p.id.endsWith('/speaker')))
  const ranked = positions
    .filter(p => !used.has(p.id))
    .sort((a, b) => seniorityRank(b) - seniorityRank(a) || (a.id < b.id ? -1 : 1))
    .map(p => p.id)
  take(ranked, seatCount)
  for (const party of parties) {
    const chair = generateActor(seed, `npc/party/${party.code}/chair`, null, parties, { partyCode: party.code, titleBp: 3500 })
    chair.faction = 'Chairman'
    chair.bank = randInt(weeklyStream(seed, chair.id, 0), 2, 40) * 1_000_000_000
    chair.axes.partyLoyalty = randInt(weeklyStream(seed, chair.id, 1), 70, 100)
    cast.push(chair)
  }
  for (let i = 0; i < elderCount; i++) {
    const party = parties[i % parties.length]!
    const elder = generateActor(seed, `npc/elder/${i + 1}`, null, parties, { partyCode: party.code, titleBp: 6000 })
    elder.traits = [...new Set([...elder.traits, 'ruthless' as NpcTrait])]
    elder.bank = randInt(weeklyStream(seed, elder.id, 0), 5, 120) * 1_000_000_000
    elder.axes.patronage = randInt(weeklyStream(seed, elder.id, 1), 70, 100)
    elder.axes.eliteTrust = randInt(weeklyStream(seed, elder.id, 2), 60, 100)
    cast.push(elder)
  }
  return cast.slice(0, count)
}

/** A named holder for any seat in the catalogue that the key cast does not cover. */
export function backgroundHolder(seed: number, position: Position, parties: readonly Party[]): { id: string; name: string; initials: string; partyCode: string; born: number } {
  const streamKey = `holder/${position.id}`
  const next = sfc32(subSeed(seed, streamKey), hash32(`${streamKey}:a`), hash32(`${streamKey}:b`), hash32(`${streamKey}:c`))
  const stateCode = position.stateCode ?? pick(next, STATES).code
  const zone = zoneOfState(STATE_BY_CODE.get(stateCode))
  const name = pickName(next, zone, { titleBp: 1500 })
  return {
    id: streamKey,
    name: name.name,
    initials: name.initials,
    partyCode: drawParty(next, parties).code,
    born: 2026 - randInt(next, 30, 68),
  }
}

/** Every seat in the catalogue resolves to a holder: a key actor, or a background one. */
export function holderOf(seed: number, position: Position, cast: readonly Npc[], parties: readonly Party[]): { id: string; name: string; partyCode: string } {
  const found = cast.find(n => n.positionId === position.id && n.isAlive)
  if (found) return { id: found.id, name: found.name, partyCode: found.partyCode ?? '' }
  const bg = backgroundHolder(seed, position, parties)
  return { id: bg.id, name: bg.name, partyCode: bg.partyCode }
}

// ---------------------------------------------------------------------------
// the relationship matrix
// ---------------------------------------------------------------------------

export function generateRelationships(
  seed: number,
  npcs: readonly Npc[],
  playerId = 'player',
  perNpc = 24,
): Map<string, Map<string, Relationship>> {
  const out = new Map<string, Map<string, Relationship>>()
  const add = (from: string, to: string, rel: Relationship) => {
    let m = out.get(from)
    if (!m) { m = new Map(); out.set(from, m) }
    m.set(to, rel)
  }

  // the player knows every key actor, and every key actor has a view of the player
  for (const npc of npcs) {
    const next = sfc32(subSeed(seed, `rel/${playerId}/${npc.id}`), hash32(npc.id), hash32(playerId), 0x9e3779b9)
    const trust = randInt(next, -60, 75)
    const blackmail = chanceBp(next, 1800) ? {
      type: pick(next, ['video', 'document', 'witness', 'ledger'] as const),
      severity: randInt(next, 1, 3) as 1 | 2 | 3,
      holderId: next() % 2 === 0 ? npc.id : playerId,
      exposureRiskBp: randInt(next, 500, 6000),
    } : null
    const base: Relationship = {
      npcId: npc.id,
      trust,
      debt: chanceBp(next, 2000) ? randInt(next, 1, 500) * 1_000_000 : 0,
      theyOweYou: chanceBp(next, 2500) ? randInt(next, 1, 800) * 1_000_000 : 0,
      blackmail,
      sharedSecrets: randInt(next, 0, 4),
      lastInteraction: null,
      interactionCount: 0,
    }
    add(playerId, npc.id, base)
    add(npc.id, playerId, { ...base, npcId: playerId })
  }

  // the cast knows itself — a sparse web, enough for truces and betrayals to form
  for (const npc of npcs) {
    const next = sfc32(subSeed(seed, `web/${npc.id}`), hash32(`${npc.id}:web`), hash32('web'), 0x85ebca6b)
    const others = npcs.filter(n => n.id !== npc.id)
    const chosen = new Set<string>()
    for (let i = 0; i < perNpc && others.length > 0; i++) {
      const other = pick(next, others)
      if (chosen.has(other.id)) continue
      chosen.add(other.id)
      const trust = randInt(next, -85, 90)
      const rel: Relationship = {
        npcId: other.id,
        trust,
        debt: chanceBp(next, 1500) ? randInt(next, 1, 900) * 1_000_000 : 0,
        theyOweYou: chanceBp(next, 1500) ? randInt(next, 1, 900) * 1_000_000 : 0,
        blackmail: chanceBp(next, 1200) ? {
          type: pick(next, ['video', 'document', 'witness', 'ledger'] as const),
          severity: randInt(next, 1, 3) as 1 | 2 | 3,
          holderId: npc.id,
          exposureRiskBp: randInt(next, 500, 6000),
        } : null,
        sharedSecrets: randInt(next, 0, 3),
        lastInteraction: null,
        interactionCount: 0,
      }
      add(npc.id, other.id, rel)
      // the mirror edge is not always warm: friendship is not always returned
      if (!out.get(other.id)?.has(npc.id)) {
        add(other.id, npc.id, { ...rel, npcId: npc.id, trust: Math.max(-100, Math.min(100, trust + randInt(next, -35, 20))) })
      }
    }
  }
  return out
}

/** Trust decays without contact, and grudges harden. Applied once a week per edge. */
/** Trust decays without contact: each stale edge drifts one point toward neutral with
    probability `decayBp` per week. Grudges and friendships both fade unless maintained. */
export function decayRelationships(world: NpcWorld, decayBp = 300): void {
  for (const [from, edges] of world.relationships) {
    for (const [to, rel] of edges) {
      if (rel.lastInteraction === world.date) continue
      if (rel.trust === 0) continue
      // a single hash, not a constructed PRNG: this runs ~32 million times a century
      const draw = hash32(`${world.seed}|decay|${from}|${to}|${world.week}`) % 10000
      if (draw >= decayBp) continue
      rel.trust += rel.trust > 0 ? -1 : 1
    }
  }
}

// ---------------------------------------------------------------------------
// the brain
// ---------------------------------------------------------------------------

function meetsPrerequisite(npc: Npc, position: Position): boolean {
  for (const req of position.prerequisites) {
    // 'age' bars are checked by canRunFor against the world clock; the rest are here
    if (req.kind === 'terms' && npc.termsServed < (req.minTerms ?? 0)) return false
    if (req.kind === 'party-role' && !npc.partyCode) return false
  }
  return true
}

/** Can this actor run for this seat this cycle? */
export function canRunFor(npc: Npc, target: string, world: NpcWorld): boolean {
  const seat = resolveTargetSeat(npc, target, world)
  if (!seat) return false
  // the age bar is only ever set through prerequisites of kind 'age'
  const ageBar = seat.prerequisites.find(r => r.kind === 'age')?.minAge
  if (ageBar !== undefined && ageOf(npc, world.year) < ageBar) return false
  return meetsPrerequisite(npc, seat)
}

function relationshipsOf(world: NpcWorld, npcId: string): Relationship[] {
  const m = world.relationships.get(npcId)
  return m ? [...m.values()] : []
}

/** The third party both actors hate — the seed of every "enemy becomes ally" story.
 *  Bounded work: at most 8 enemies are probed, and the shared-hate test is a map lookup. */
export function findMutualEnemy(world: NpcWorld, npcId: string): string | null {
  const mine = world.relationships.get(npcId)
  if (!mine) return null
  let probed = 0
  for (const [enemyId, rel] of mine) {
    if (rel.trust >= -50) continue
    if (++probed > 8) break
    const theirs = world.relationships.get(enemyId)
    if (!theirs) continue
    for (const [candidate, mirror] of theirs) {
      if (mirror.trust < -50 && (mine.get(candidate)?.trust ?? 0) < -50) return candidate
    }
  }
  return null
}

function alliesAbove(world: NpcWorld, npcId: string, minTrust: number): Relationship[] {
  return relationshipsOf(world, npcId).filter(r => r.trust >= minTrust)
}

/**
 * One week in an actor's life. Pure: returns proposals, mutates nothing.
 *
 * Order matters and is the brief's: survival → ambition → betrayal → money → press →
 * unemployment → betrayal of a friend (ambition beating loyalty). Every draw comes from
 * the actor's own (seed, id, week) stream.
 */
export function npcWeekly(npc: Npc, world: NpcWorld): NpcAction[] {
  const actions: NpcAction[] = []
  if (!npc.isAlive) return actions
  const next = weeklyStream(world.seed, npc.id, world.week)

  // 1. survival -----------------------------------------------------------
  const age = ageOf(npc, world.year)
  if (age > 85 && chanceBp(next, 800)) {
    actions.push({ type: 'death', npcId: npc.id, detail: `${npc.name} dies at ${age}.` })
    return actions
  }
  if (age > 72 && chanceBp(next, 500) && npc.positionId) {
    actions.push({ type: 'retire', npcId: npc.id, detail: `${npc.name} announces retirement at ${age}.` })
    return actions
  }

  // 2. ambition -----------------------------------------------------------
  if (npc.ambition && world.year >= npc.ambition.by - 2) {
    const alreadyCampaigning = npc.lastCandidacyDate !== null && yearsBetween(npc.lastCandidacyDate, world.date) < 3
    if (canRunFor(npc, npc.ambition.target, world) && !alreadyCampaigning) {
      const seat = resolveTargetSeat(npc, npc.ambition.target, world)
      actions.push({
        type: 'declare_candidacy',
        npcId: npc.id,
        targetId: seat?.id,
        detail: `${npc.name} declares for ${seat?.title ?? npc.ambition.target} (${npc.partyCode}) ahead of ${npc.ambition.by}.`,
      })
      const allies = alliesAbove(world, npc.id, 60)
      if (allies.length < 5) {
        const sameParty = relationshipsOf(world, npc.id)
          .filter(r => r.trust < 30)
          .map(r => world.index.get(r.npcId))
          .filter((n): n is Npc => Boolean(n) && n!.partyCode === npc.partyCode && n!.isAlive)
        for (const target of sameParty.slice(0, 3)) {
          actions.push({
            type: 'outreach',
            npcId: npc.id,
            targetId: target.id,
            amountNaira: 5_000_000,
            detail: `${npc.name} courts ${target.name} for the coalition (₦5m in the handshake).`,
          })
        }
      } else {
        actions.push({
          type: 'build_coalition',
          npcId: npc.id,
          detail: `${npc.name} builds a coalition of ${allies.length} allies for the ${npc.ambition.target} run.`,
        })
      }
    } else if (world.year > npc.ambition.by && chanceBp(next, 2500)) {
      // the window closed and they are looking for another route. The ambition itself is
      // dropped by the tick (living.ts), not here: this function never mutates.
      actions.push({
        type: 'consider_betrayal',
        npcId: npc.id,
        detail: `${npc.name} missed the window for ${npc.ambition.target} and is looking for another route.`,
      })
    }
  }

  // 3. the relationship ledger --------------------------------------------
  for (const rel of relationshipsOf(world, npc.id)) {
    const other = world.index.get(rel.npcId)
    if (!other?.isAlive) continue

    if (rel.trust < -40 && rel.debt === 0 && chanceBp(next, 1500)) {
      const mutual = findMutualEnemy(world, npc.id)
      if (mutual) {
        const mutualName = world.index.get(mutual)?.name ?? mutual
        actions.push({
          type: 'propose_truce',
          npcId: npc.id,
          targetId: rel.npcId,
          detail: `${npc.name} sends word to ${other.name}: bury it, and turn on ${mutualName} together.`,
        })
      }
    }
    if (rel.trust > 70 && npc.bank > 1_000_000_000 && chanceBp(next, 1000)) {
      actions.push({
        type: 'request_favor',
        npcId: npc.id,
        targetId: rel.npcId,
        detail: `${npc.name} asks ${other.name} for an appointment — a son, a cousin, a loyal ward man.`,
      })
    }
    if (rel.trust < -60 && rel.blackmail && rel.blackmail.holderId === npc.id && chanceBp(next, 2000)) {
      const outlet = harshestOutlet(world.media, other.partyCode ?? npc.partyCode)
      actions.push({
        type: 'leak_blackmail',
        npcId: npc.id,
        targetId: rel.npcId,
        detail: `${npc.name} hands ${rel.blackmail.type} on ${other.name} to ${outlet?.name ?? 'the press'}.`,
      })
    }
    // admiration is not protection: a hungry friend takes your seat
    if (rel.trust > 70 && npc.axes.integrity < 40 && npc.ambition && other.positionId === resolveTargetSeat(npc, npc.ambition.target, world)?.id && chanceBp(next, 900)) {
      actions.push({
        type: 'consider_betrayal',
        npcId: npc.id,
        targetId: rel.npcId,
        detail: `${npc.name} wants ${other.name}'s seat badly enough to forget the friendship.`,
      })
    }
  }

  // 4. money ---------------------------------------------------------------
  if (npc.bank < 50_000_000 && npc.positionId && npc.traits.includes('corruptible')) {
    const rich = [...world.players].sort((a, b) => b.bank - a.bank)[0]
    if (rich && rich.bank > 5_000_000_000) {
      actions.push({
        type: 'solicit_bribe',
        npcId: npc.id,
        targetId: rich.id,
        amountNaira: 20_000_000,
        detail: `${npc.name} needs ₦20m and knows ${rich.id === 'player' ? 'you' : 'a rich man'} has it.`,
      })
    }
  }

  // 5. press ---------------------------------------------------------------
  if (npc.traits.includes('media_savvy') && world.date.slice(5, 7) === '01') {
    const outlet = friendliestOutlet(world.media, npc.partyCode)
    if (outlet) {
      actions.push({
        type: 'plant_story',
        npcId: npc.id,
        amountNaira: outlet.pricePerStory,
        detail: `${npc.name} plants a performance story with ${outlet.name}.`,
      })
    }
  }

  // 6. life after office ---------------------------------------------------
  if (!npc.positionId) {
    if (npc.bank > 1_000_000_000) {
      const protege = relationshipsOf(world, npc.id).filter(r => r.trust > 50).map(r => world.index.get(r.npcId)).find((n): n is Npc => Boolean(n) && n!.isAlive && !n!.positionId)
      actions.push({
        type: 'fund_protege',
        npcId: npc.id,
        targetId: protege?.id,
        amountNaira: 300_000_000,
        detail: protege ? `${npc.name} funds ${protege.name}'s next run.` : `${npc.name} puts money into a protégé yet to be chosen.`,
      })
    } else {
      const formerAlly = alliesAbove(world, npc.id, 40).map(r => world.index.get(r.npcId)).find((n): n is Npc => Boolean(n) && n!.isAlive && Boolean(n!.positionId))
      actions.push({
        type: 'lobby_appointment',
        npcId: npc.id,
        targetId: formerAlly?.id,
        detail: formerAlly ? `${npc.name} lobbies ${formerAlly.name} for a board or an agency.` : `${npc.name} lobbies for any appointment going.`,
      })
    }
  }

  // 7. defection -----------------------------------------------------------
  if (npc.partyCode && chanceBp(next, 120) && npc.axes.partyLoyalty < 45) {
    const others = world.parties.filter(p => p.code !== npc.partyCode)
    const to = others.length ? pick(next, others) : null
    if (to) {
      actions.push({ type: 'defect', npcId: npc.id, targetId: to.code, detail: `${npc.name} defects from ${npc.partyCode} to ${to.code}.` })
    }
  }

  return actions
}

/** The seat an actor is really chasing, resolved from a seat id or a tier keyword.
 *  O(1) through the seat index: a century runs this a million times. */
export function resolveTargetSeat(npc: Npc, target: string, world: NpcWorld): Position | undefined {
  const direct = world.positions.get(target)
  if (direct) return direct
  const seats = world.seats
  const one = (id: string | null | undefined): Position | undefined => (id ? world.positions.get(id) : undefined)
  const anyOf = (map: Map<string, string[]>): string[] | undefined => map.values().next().value as string[] | undefined
  // actors of the same tier spread across the catalogue rather than all chasing the
  // alphabetically-first seat: a state's 25 council chairmanships are 25 contests
  const spread = (ids: string[] | undefined): Position | undefined => {
    if (!ids || ids.length === 0) return undefined
    return one(ids[hash32(`${npc.id}:${target}`) % ids.length])
  }

  switch (target) {
    case 'president': return one(seats.president)
    case 'vice-president': return one(seats.vicePresident)
    case 'governor': return one(seats.governorsByState.get(npc.homeState)) ?? one(seats.governorsByState.values().next().value)
    case 'deputy-governor': return one(seats.deputyGovernorsByState.get(npc.homeState)) ?? one(seats.deputyGovernorsByState.values().next().value)
    case 'senator': return spread(seats.senatorsByState.get(npc.homeState)) ?? spread(anyOf(seats.senatorsByState))
    case 'federal/rep': return spread(seats.repsByState.get(npc.homeState)) ?? spread(anyOf(seats.repsByState))
    case 'federal/minister': return one(seats.ministers[0])
    case 'lga': return spread(seats.chairmenByState.get(npc.homeState)) ?? spread(anyOf(seats.chairmenByState))
    case 'state/assembly': return one(seats.speakersByState.get(npc.homeState)) ?? one(seats.speakersByState.values().next().value)
    default: return undefined
  }
}


/** Hand a fresh ambition to an actor who has none — new blood keeps entering the game. */
export function seedAmbition(seed: number, npc: Npc, position: Position | undefined, startYear = 2026): NpcAmbition {
  const next = sfc32(subSeed(seed, `ambition/${npc.id}`), hash32(`${npc.id}:amb`), hash32('amb'), 0x27d4eb2f)
  const targets = ambitionTargetsFor(position)
  const target = pick(next, targets)
  return { target, by: startYear + randInt(next, 1, 14) }
}

export function ambitionFor(npc: Npc, position: Position | undefined, seed: number): NpcAmbition | null {
  // the men who own the party rather than hold office do not all want one back:
  // some of them are content to sell the ticket to someone else
  if (!position && npc.axes.patronage > 70 && chanceBp(weeklyStream(seed, npc.id, 0), 4500)) return null
  return seedAmbition(seed, npc, position)
}
