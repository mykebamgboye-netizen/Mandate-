/* @mandate/sim/living.ts — the world that runs whether or not you are watching.
 *
 * `advanceTurn(world)` runs one Monday: every key actor proposes a week (npcs.ts), the
 * proposals are applied to the relationship matrix and the money, trust decays, the dead
 * are replaced, and any election whose poll falls inside the week is held and its seats
 * handed over. A century is 5,200 turns of the same loop.
 *
 * The loop is deterministic and order-independent: `advanceTurn` produces the same report
 * for the same (seed, week), and the brain's draws come from per-(actor, week) streams, so
 * a worker can run the cast in any order or in parallel and the world still agrees.
 *
 * Money that moves through commands stays in the bigint kobo ledger (world.ts). The naira
 * bank figures here are agent-level cash and are integer naira, matching the schema.
 */

import {
  generateActor, generateKeyCast, generateRelationships, npcWeekly, decayRelationships,
  seedAmbition, ambitionFor, resolveTargetSeat, seniorityRank, ageOf,
  type Npc, type NpcAction, type NpcWorld, type Relationship,
} from './npcs'
import { generateParties, type Party } from './parties'
import { POSITIONS, SEAT_INDEX, buildSeatIndex, type Position, type SeatIndex } from './positions'
import { generateMedia, type MediaOutlet } from './media'
import { STATES } from './geo'
import { cyclesInWeek, type ElectionCycle } from './calendar'
import { subSeed, sfc32, hash32, randInt, chanceBp } from './rng'
import type { Axes, LifeEvent, PlayerTurn } from './game-state'

export interface PlayerEntry {
  id: string
  bank: number
  positionId: string | null
  partyCode: string | null
  axes: Axes
  name: string
}

export interface LivingWorld {
  seed: number
  /** 1-based, weeks since 2026-01-01 */
  week: number
  /** ISO date of the Monday the turn will run */
  date: string
  positions: Map<string, Position>
  seats: SeatIndex
  parties: Party[]
  /** the living key cast — replaced one-for-one as actors die */
  npcs: Npc[]
  /** everyone who has died, kept for the legacy screen. Never walked by the weekly loop. */
  departed: Npc[]
  relationships: Map<string, Map<string, Relationship>>
  media: MediaOutlet[]
  players: PlayerEntry[]
  journal: LifeEvent[]
}

export interface ElectionResult {
  cycleId: string
  kind: ElectionCycle['kind']
  seatId: string
  seatTitle: string
  winnerId: string
  winnerName: string
  partyCode: string | null
  wasPlayer: boolean
  challengers: number
  note: string
}

export interface TurnReport {
  week: number
  date: string
  actions: NpcAction[]
  deaths: { npcId: string; name: string; successors: string[] }[]
  elections: ElectionResult[]
  notes: string[]
  playerTurn: PlayerTurn
  journal: LifeEvent[]
}

const DAY = 86_400_000

/** 2026-01-01 is a Thursday; the world's weeks run Monday→Sunday, so week 1 starts
 *  Monday 2025-12-29. `weekToDate(1)` is therefore 2025-12-29, and the desk's first
 *  Monday in 2026 is week 2. */
export const WORLD_EPOCH_MONDAY = '2025-12-29'

export function weekToDate(week: number): string {
  const d = new Date(`${WORLD_EPOCH_MONDAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7)
  return d.toISOString().slice(0, 10)
}

export function dateToWeek(dateISO: string): number {
  const a = new Date(`${WORLD_EPOCH_MONDAY}T00:00:00Z`).getTime()
  const b = new Date(`${dateISO}T00:00:00Z`).getTime()
  return Math.floor((b - a) / (7 * DAY)) + 1
}

/** Weeks in a century, 2026-01-01 → 2126-01-01. */
export const CENTURY_WEEKS = 5200

export interface CreateWorldOptions {
  keyCast?: number
  player?: { name?: string; positionId?: string | null; partyCode?: string | null; bank?: number; axes?: Partial<Axes> }
}

const DEFAULT_AXES_FOR_PLAYER: Axes = {
  competence: 50, integrity: 50, popularity: 50, partyLoyalty: 50, eliteTrust: 50,
  pressTone: 0, constituency: 50, patronage: 50, legitimacy: 60, memory: 30,
}

export function createLivingWorld(seed: number, opts: CreateWorldOptions = {}): LivingWorld {
  const positions = new Map(POSITIONS.map(p => [p.id, p]))
  const seats = SEAT_INDEX
  const parties = generateParties(seed)
  const npcs = generateKeyCast(seed, POSITIONS, parties, opts.keyCast ?? 250)
  for (const npc of npcs) {
    npc.ambition = ambitionFor(npc, npc.positionId ? positions.get(npc.positionId) : undefined, seed)
  }
  const relationships = generateRelationships(seed, npcs)
  const media = generateMedia(seed, parties)

  // a third of the market is owned, and owners are the richest actors without a ministry
  const owners = [...npcs]
    .filter(n => !n.positionId && n.bank > 2_000_000_000)
    .sort((a, b) => b.bank - a.bank)
  owners.forEach((owner, i) => {
    const outlet = media[i % media.length]
    if (outlet && outlet.ownerId === '') outlet.ownerId = owner.id
  })

  const player: PlayerEntry = {
    id: 'player',
    name: opts.player?.name ?? 'The Player',
    bank: opts.player?.bank ?? 0,
    positionId: opts.player?.positionId ?? null,
    partyCode: opts.player?.partyCode ?? 'PA',
    axes: { ...DEFAULT_AXES_FOR_PLAYER, ...opts.player?.axes },
  }

  return {
    seed,
    week: 1,
    date: weekToDate(1),
    positions,
    seats,
    parties,
    npcs,
    departed: [],
    relationships,
    media,
    players: [player],
    journal: [],
  }
}

/** The NPC-facing view of the world: the same objects, typed for the brain. */
export function viewOf(world: LivingWorld): NpcWorld {
  return {
    seed: world.seed,
    date: world.date,
    week: world.week,
    year: Number(world.date.slice(0, 4)),
    positions: world.positions,
    seats: world.seats,
    index: new Map(world.npcs.map(n => [n.id, n])),
    parties: world.parties,
    npcs: world.npcs,
    relationships: world.relationships,
    media: world.media,
    players: world.players.map(p => ({
      id: p.id, bank: p.bank, positionId: p.positionId, name: p.name, partyCode: p.partyCode,
    })),
  }
}

function bumpTrust(world: LivingWorld, from: string, to: string, delta: number): void {
  const edge = world.relationships.get(from)?.get(to)
  if (!edge) return
  edge.trust = Math.max(-100, Math.min(100, edge.trust + delta))
  edge.lastInteraction = world.date
  edge.interactionCount += 1
}

function transferTo(index: ReadonlyMap<string, Npc>, fromNpcId: string, toNpcId: string | undefined, amount: number): void {
  const from = index.get(fromNpcId)
  if (!from) return
  const paid = Math.max(0, Math.min(from.bank, amount))
  from.bank -= paid
  if (!toNpcId) return
  const to = index.get(toNpcId)
  if (to) to.bank += paid
}

/** Party strength: the seniority-weighted share of seats each party currently holds. */
export function partyStrength(world: LivingWorld): Map<string, number> {
  const totals = new Map<string, number>()
  let grand = 0
  for (const npc of world.npcs) {
    if (!npc.isAlive || !npc.positionId) continue
    const seat = world.positions.get(npc.positionId)
    if (!seat) continue
    const weight = seniorityRank(seat)
    grand += weight
    const code = npc.partyCode ?? 'none'
    totals.set(code, (totals.get(code) ?? 0) + weight)
  }
  const out = new Map<string, number>()
  for (const [code, w] of totals) out.set(code, grand > 0 ? w / grand : 0)
  return out
}

function candidateScore(npc: Npc, strength: Map<string, number>, next: () => number): number {
  const money = Math.min(4_000_000_000, npc.bank)
  return (
    npc.axes.popularity * 2 +
    npc.axes.eliteTrust * 2 +
    npc.axes.competence +
    Math.round(npc.axes.partyLoyalty / 2) +
    Math.round((money / 4_000_000_000) * 120) +
    Math.round((strength.get(npc.partyCode ?? 'none') ?? 0) * 400) +
    randInt(next, -60, 60)
  )
}

function playerScore(player: PlayerEntry, strength: Map<string, number>, next: () => number): number {
  return (
    player.axes.popularity * 2 +
    player.axes.eliteTrust * 2 +
    player.axes.competence +
    Math.round(player.axes.partyLoyalty / 2) +
    Math.round((Math.min(4_000_000_000, player.bank) / 4_000_000_000) * 120) +
    Math.round((strength.get(player.partyCode ?? 'none') ?? 0) * 400) +
    randInt(next, -60, 60)
  )
}

function vacate(world: LivingWorld, npc: Npc, reason: string): void {
  if (!npc.positionId) return
  npc.positionId = null
  npc.history.push({ date: world.date, event: 'lost seat', detail: reason })
}

function takeSeat(world: LivingWorld, npc: Npc, seat: Position): void {
  npc.positionId = seat.id
  npc.termsServed += 1
  npc.history.push({ date: world.date, event: 'took office', detail: seat.title })
}

function successorsFor(world: LivingWorld, dead: Npc): string[] {
  const seat = dead.positionId ? world.positions.get(dead.positionId) : undefined
  if (seat) dead.positionId = null // the seat, not the corpse, carries the authority
  const key = `npc/successor/${dead.id}/${world.date}`
  const year = Number(world.date.slice(0, 4))
  // a successor enters young: 35–62. Ages are relative to the year they arrive, so a
  // replacement in 2094 is not born in 1960 and dead on arrival.
  const age = 35 + (hash32(key) % 28)
  const replacement = generateActor(world.seed, key, seat ?? null, world.parties, {
    partyCode: dead.partyCode ?? undefined,
    year,
    born: year - age,
  })
  replacement.ambition = ambitionFor(replacement, seat, world.seed)
  if (dead.faction === 'Chairman') replacement.faction = 'Chairman'
  world.npcs.push(replacement)
  // the replacement inherits a thin slice of the dead man's relationships, not his warmth
  const inherited = world.relationships.get(dead.id)
  if (inherited) {
    const edges = new Map<string, Relationship>()
    for (const [to, rel] of inherited) {
      edges.set(to, { ...rel, trust: Math.round(rel.trust / 4), lastInteraction: world.date })
    }
    world.relationships.set(replacement.id, edges)
  }
  return [replacement.id]
}

/** Run one poll: the seat is contested by the incumbents and everyone chasing it. */
function runContest(
  world: LivingWorld,
  cycle: ElectionCycle,
  seat: Position,
  strength: Map<string, number>,
  targetOf: (npc: Npc) => string | undefined,
): ElectionResult | null {
  const next = sfc32(
    subSeed(world.seed, `election/${cycle.id}/${seat.id}/${world.week}`),
    hash32(cycle.id), hash32(seat.id), world.week,
  )
  const incumbents = world.npcs.filter(n => n.isAlive && n.positionId === seat.id)
  const challengers = world.npcs
    .filter(n => n.isAlive && n.positionId !== seat.id && n.ambition && targetOf(n) === seat.id)
    .sort((a, b) => b.axes.eliteTrust + b.axes.popularity - (a.axes.eliteTrust + a.axes.popularity))
    .slice(0, 4)

  const candidates: Npc[] = [...incumbents, ...challengers]
  if (candidates.length === 0) return null

  let bestNpc: Npc | null = null
  let bestScore = -Infinity
  for (const c of candidates) {
    const score = candidateScore(c, strength, next)
    if (score > bestScore) { bestScore = score; bestNpc = c }
  }

  const player = world.players.find(p => p.positionId === seat.id)
  let playerWon = false
  if (player) {
    const pScore = playerScore(player, strength, next)
    if (pScore >= bestScore) { bestScore = pScore; playerWon = true; bestNpc = null }
  }

  if (bestNpc) {
    for (const other of candidates) {
      if (other.id !== bestNpc.id) vacate(world, other, `lost ${seat.title} at the ${cycle.label}`)
    }
    takeSeat(world, bestNpc, seat)
    return {
      cycleId: cycle.id, kind: cycle.kind, seatId: seat.id, seatTitle: seat.title,
      winnerId: bestNpc.id, winnerName: bestNpc.name, partyCode: bestNpc.partyCode,
      wasPlayer: false, challengers: candidates.length,
      note: `${bestNpc.name} (${bestNpc.partyCode}) takes ${seat.title}.`,
    }
  }

  // the player held it
  return {
    cycleId: cycle.id, kind: cycle.kind, seatId: seat.id, seatTitle: seat.title,
    winnerId: player?.id ?? 'player', winnerName: player?.name ?? 'you', partyCode: player?.partyCode ?? null,
    wasPlayer: playerWon, challengers: candidates.length,
    note: `You hold ${seat.title} against ${candidates.length} challenger${candidates.length === 1 ? '' : 's'}.`,
  }
}

function seatsForCycle(world: LivingWorld, cycle: ElectionCycle): Position[] {
  const all = [...world.positions.values()]
  if (cycle.kind === 'presidential') return all.filter(p => p.id === 'federal/president' || p.id === 'federal/vice-president')
  if (cycle.kind === 'state') {
    const off = cycle.id.includes('off-cycle')
    const codes = off
      ? ['AN', 'BY', 'ED', 'EK', 'IM', 'KO', 'ON', 'OS']
      : STATES.filter(s => s.code !== 'FC' && !['AN', 'BY', 'ED', 'EK', 'IM', 'KO', 'ON', 'OS'].includes(s.code)).map(s => s.code)
    return all.filter(p => p.stateCode !== null && codes.includes(p.stateCode) && (p.id.endsWith('/governor') || p.id.endsWith('/deputy-governor')))
  }
  return all.filter(p => p.tier === 'lga')
}

/** Hold every election whose poll lands in the current week. */
export function runElections(world: LivingWorld): ElectionResult[] {
  const cycles = cyclesInWeek(world.date)
  if (cycles.length === 0) return []
  const strength = partyStrength(world)
  const view = viewOf(world)
  // resolve each actor's target seat once for the whole poll, not once per seat
  const targetCache = new Map<string, string | undefined>()
  const targetOf = (npc: Npc): string | undefined => {
    if (!npc.ambition) return undefined
    if (targetCache.has(npc.id)) return targetCache.get(npc.id)
    const resolved = resolveTargetSeat(npc, npc.ambition.target, view)
    targetCache.set(npc.id, resolved?.id)
    return resolved?.id
  }
  const results: ElectionResult[] = []
  for (const cycle of cycles) {
    for (const seat of seatsForCycle(world, cycle)) {
      const result = runContest(world, cycle, seat, strength, targetOf)
      if (result) results.push(result)
    }
  }
  return results
}

/** Apply one actor's proposals. Exported so the desk can preview a proposal without
 *  running a whole week (and so tests can apply a single crafted action). */
export function applyAction(world: LivingWorld, action: NpcAction, byId?: ReadonlyMap<string, Npc>): void {
  const index = byId ?? new Map(world.npcs.map(n => [n.id, n]))
  const npc = index.get(action.npcId)
  if (!npc) return
  switch (action.type) {
    case 'death': {
      // the seat is not vacated here: successorsFor() hands it to the replacement
      npc.isAlive = false
      npc.history.push({ date: world.date, event: 'died', detail: action.detail })
      break
    }
    case 'retire': {
      vacate(world, npc, 'retired')
      npc.history.push({ date: world.date, event: 'retired', detail: action.detail })
      break
    }
    case 'declare_candidacy':
      npc.lastCandidacyDate = world.date
      npc.history.push({ date: world.date, event: action.type, detail: action.detail })
      break
    case 'consider_betrayal':
      npc.history.push({ date: world.date, event: action.type, detail: action.detail })
      if (action.targetId) bumpTrust(world, npc.id, action.targetId, -8)
      break
    case 'outreach':
      if (action.amountNaira) transferTo(index, npc.id, action.targetId, action.amountNaira)
      if (action.targetId) {
        bumpTrust(world, npc.id, action.targetId, 15)
        bumpTrust(world, action.targetId, npc.id, 6)
      }
      break
    case 'build_coalition':
      npc.history.push({ date: world.date, event: 'coalition', detail: action.detail })
      break
    case 'propose_truce':
      if (action.targetId) {
        bumpTrust(world, npc.id, action.targetId, 12)
        bumpTrust(world, action.targetId, npc.id, 12)
      }
      break
    case 'request_favor':
      if (action.targetId) bumpTrust(world, npc.id, action.targetId, -4)
      break
    case 'leak_blackmail': {
      const target = action.targetId ? index.get(action.targetId) : undefined
      if (target) {
        target.axes.pressTone = Math.max(-100, target.axes.pressTone - 15)
        target.axes.eliteTrust = Math.max(0, target.axes.eliteTrust - 8)
        bumpTrust(world, npc.id, target.id, -20)
        bumpTrust(world, target.id, npc.id, -25)
      }
      break
    }
    case 'solicit_bribe':
      npc.history.push({ date: world.date, event: 'asked for money', detail: action.detail })
      break
    case 'plant_story':
      if (action.amountNaira) transferTo(index, npc.id, undefined, action.amountNaira)
      npc.axes.pressTone = Math.min(100, npc.axes.pressTone + 5)
      break
    case 'fund_protege':
      if (action.amountNaira) transferTo(index, npc.id, action.targetId, action.amountNaira)
      if (action.targetId) bumpTrust(world, action.targetId, npc.id, 20)
      break
    case 'lobby_appointment':
      npc.history.push({ date: world.date, event: 'lobbied', detail: action.detail })
      break
    case 'defect': {
      const to = action.targetId
      if (to && world.parties.some(p => p.code === to)) {
        npc.history.push({ date: world.date, event: 'defected', detail: action.detail })
        npc.partyCode = to
        npc.axes.partyLoyalty = Math.max(0, npc.axes.partyLoyalty - 20)
      }
      break
    }
    case 'take_office':
    case 'lose_seat':
      break
  }
}

/** A compact journal entry for anything the player would hear about. */
function journalise(world: LivingWorld, byId: ReadonlyMap<string, Npc>, action: NpcAction): void {
  const actor = byId.get(action.npcId)
  if (!actor) return
  const kind: LifeEvent['kind'] =
    action.type === 'death' ? 'death'
      : action.type === 'consider_betrayal' || action.type === 'leak_blackmail' ? 'betrayal'
        : action.type === 'propose_truce' ? 'alliance'
          : action.type === 'declare_candidacy' ? 'election'
            : 'decision'
  world.journal.push({ date: world.date, kind, summary: action.detail, vs: action.npcId })
}

/** One week: the cast proposes, the world applies, the dead are replaced, the polls close. */
export function advanceTurn(world: LivingWorld, opts: { elections?: boolean } = {}): TurnReport {
  // one actor index for the week: built once, shared by the brain and the appliers
  const view = viewOf(world)
  const byId = view.index
  const actions: NpcAction[] = []
  const deaths: TurnReport['deaths'] = []
  const notes: string[] = []

  // 1. every living key actor proposes a week
  const cast = [...world.npcs]
  for (const npc of cast) {
    if (!npc.isAlive) continue
    const proposed = npcWeekly(npc, view)
    for (const action of proposed) actions.push(action)
  }

  // 2. apply
  const journalStart = world.journal.length
  for (const action of actions) {
    applyAction(world, action, byId)
    journalise(world, byId, action)
    if (action.type === 'death') {
      const dead = byId.get(action.npcId)
      if (!dead) continue
      const successors = successorsFor(world, dead)
      deaths.push({ npcId: dead.id, name: dead.name, successors })
      notes.push(`${dead.name} dies at ${ageOf(dead, Number(world.date.slice(0, 4)))}.`)
    }
  }
  // the dead leave the working cast (and are kept for the legacy screen)
  if (deaths.length > 0) {
    const gone = new Set(deaths.map(d => d.npcId))
    world.departed.push(...world.npcs.filter(n => gone.has(n.id)))
    world.npcs = world.npcs.filter(n => !gone.has(n.id))
  }

  // 3. the matrix cools
  decayRelationships(view)

  // 4. the polls
  const elections = opts.elections === false ? [] : runElections(world)
  for (const result of elections) {
    notes.push(result.note)
    if (!result.wasPlayer) {
      world.journal.push({ date: world.date, kind: 'election', summary: result.note, vs: result.winnerId })
    }
  }

  // 5. new chapters: an expired ambition is replaced, and actors without one eventually
  //    find another — this is why a 2033 rival can be running for something else by 2041
  const currentYear = Number(world.date.slice(0, 4))
  for (const npc of world.npcs) {
    if (!npc.isAlive) continue
    const seat = npc.positionId ? world.positions.get(npc.positionId) : undefined
    if (npc.ambition && currentYear > npc.ambition.by) {
      npc.ambition = seedAmbition(world.seed, npc, seat, currentYear)
      continue
    }
    if (npc.ambition) continue
    const next = sfc32(subSeed(world.seed, `newambition/${npc.id}/${world.week}`), world.week, hash32(npc.id), 0x27d4eb2f)
    if (chanceBp(next, 2500)) npc.ambition = seedAmbition(world.seed, npc, seat, currentYear)
  }

  // 6. the clock
  const lastDate = world.date
  world.week += 1
  world.date = weekToDate(world.week)

  // 7. what the player hears
  const player = world.players[0]
  const addressed: PlayerTurn['addressedToPlayer'] = []
  for (const action of actions) {
    if (!player || action.targetId !== player.id) continue
    const npc = byId.get(action.npcId)
    if (!npc) continue
    if (action.type === 'solicit_bribe') addressed.push({ npcId: npc.id, npcName: npc.name, kind: 'bribe', detail: action.detail, amountNaira: action.amountNaira })
    if (action.type === 'request_favor') addressed.push({ npcId: npc.id, npcName: npc.name, kind: 'favour', detail: action.detail })
    if (action.type === 'leak_blackmail') addressed.push({ npcId: npc.id, npcName: npc.name, kind: 'leak', detail: action.detail })
    if (action.type === 'propose_truce') addressed.push({ npcId: npc.id, npcName: npc.name, kind: 'truce', detail: action.detail })
    if (action.type === 'outreach') addressed.push({ npcId: npc.id, npcName: npc.name, kind: 'outreach', detail: action.detail, amountNaira: action.amountNaira })
  }

  const playerFacing = elections.filter(e => e.wasPlayer)
  const officesLost: string[] = []
  const officesGained: string[] = []
  for (const result of elections) {
    if (!player) continue
    if (result.wasPlayer) continue
    if (result.seatId === player.positionId) {
      // the seat was contested and the player did not keep it
      officesLost.push(result.seatTitle)
      player.positionId = null
    }
  }

  const deathsOfKnown = deaths
    .filter(d => world.relationships.get(player?.id ?? 'player')?.has(d.npcId))
    .map(d => ({ npcId: d.npcId, name: d.name }))

  const playerTurn: PlayerTurn = {
    date: world.date,
    addressedToPlayer: addressed,
    officesGained,
    officesLost,
    deathsOfKnown,
    elections: playerFacing.map(e => e.note),
  }

  return {
    week: world.week - 1,
    date: lastDate,
    actions,
    deaths,
    elections,
    notes,
    playerTurn,
    journal: world.journal.slice(journalStart),
  }
}

/** Run n weeks, newest last. */
export function advanceWeeks(world: LivingWorld, weeks: number, opts: { elections?: boolean } = {}): TurnReport[] {
  const out: TurnReport[] = []
  for (let i = 0; i < weeks; i++) out.push(advanceTurn(world, opts))
  return out
}

export interface CenturySummary {
  seed: number
  weeks: number
  firstDate: string
  lastDate: string
  elections: number
  deaths: number
  truces: number
  betrayals: number
  defections: number
  candidacies: number
  livingActors: number
}

/** Run a century of Mondays. 5,200 turns, the full cast each time. */
export function simulateCentury(seed: number, weeks = CENTURY_WEEKS): CenturySummary {
  const world = createLivingWorld(seed)
  const firstDate = world.date
  let elections = 0, deaths = 0, truces = 0, betrayals = 0, defections = 0, candidacies = 0
  for (let i = 0; i < weeks; i++) {
    const report = advanceTurn(world)
    elections += report.elections.length
    deaths += report.deaths.length
    for (const a of report.actions) {
      if (a.type === 'propose_truce') truces++
      if (a.type === 'consider_betrayal') betrayals++
      if (a.type === 'defect') defections++
      if (a.type === 'declare_candidacy') candidacies++
    }
  }
  return {
    seed, weeks, firstDate, lastDate: world.date,
    elections, deaths, truces, betrayals, defections, candidacies,
    livingActors: world.npcs.filter(n => n.isAlive).length,
  }
}

/** Exposed so the desk can describe a seat without re-deriving the index. */
export { buildSeatIndex }
