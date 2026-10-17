/* @mandate/living-desk — the living world, on the desk.
 *
 * src/sim/living.ts runs the country: 250 actors propose a week each, the matrix moves,
 * the dead are replaced and the polls close. This module is the desk's end of that engine —
 * the same job src/desk-sim.ts does for the authored pack.
 *
 * Three rules shape everything here.
 *
 *   1. THE WORLD ARRIVES AS PAPER. An actor who wants money, a death you have a
 *      relationship with, a poll that moved your seat — each becomes a document on the
 *      tray, drawn in the desk's own materials, so the world is read where every other fact
 *      in this game is read. There is no dashboard of NPCs, because a minister does not
 *      get one.
 *
 *   2. ONE WEEK OF WORLD PER WEEK OF DESK. A single Monday costs ~9ms for the whole cast,
 *      so it runs inline at the week close. The spec's Web Worker was for running 5,200
 *      weeks at once; one week does not need one, and adding one would buy a
 *      message-passing bug in exchange for nothing.
 *
 *   3. NOTHING IS EVER WIPED. The world lives in its own key ('mandate.living.v1'), like
 *      the lives registry, so clearing the desk does not clear the century. A stored world
 *      is advanced, never rebuilt.
 *
 * The player's seat is resolved from the desk identity, so one desk always runs one
 * Nigeria: the seed is a hash of who you are and where you sit, not a random draw. Two
 * players who take the same post in the same state get the same country, and different
 * weeks — the NPCs roll their own numbers.
 */

import { advanceTurn, createLivingWorld, type LivingWorld, type PlayerEntry, type TurnReport } from './sim/living'
import { generateParties, type Party } from './sim/parties'
import { POSITIONS, SEAT_INDEX, findPosition, type Position } from './sim/positions'
import { ageOf, type Npc, type Relationship } from './sim/npcs'
import { STATES, LGAS } from './sim/geo'
import { CALENDAR, labelDate, type CycleKind } from './sim/calendar'
import { friendliestOutlet, type MediaOutlet } from './sim/media'
import { hash32 } from './sim/rng'
import type { Doc, ClippingDoc, NoteDoc } from './content'
import type { Axes, LifeEvent, PlayerTurn } from './sim/game-state'
import type { GazetteStory } from './types'

export const LIVING_KEY = 'mandate.living.v1'

/** The most papers one week may put on the tray. A desk is not a feed. */
export const LIVING_PAPER_CAP = 6

/** The most clippings one week may put in the press folder. */
export const LIVING_PRESS_CAP = 4

export interface LivingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/* --------------------------------------------------------------------------- */
/* the seat                                                                     */
/* --------------------------------------------------------------------------- */

export interface SeatLookup {
  /** a catalogue id, when the desk already knows one */
  positionId?: string | null
  /** the identity's own words, e.g. 'Executive Governor of Delta State' */
  post?: string
  /** the state name, e.g. 'Delta' */
  state?: string
  lga?: string | null
}

/** Which seat in the catalogue this desk sits at, or null for a spectator.
 *
 *  The onboarding layer speaks in federation_offices ids ('state/governor',
 *  'local/chairman'); the catalogue speaks in seats ('state/DT/governor'). This is the one
 *  place the two vocabularies meet, so a chairman in Sapele governs Sapele's council seat
 *  rather than whichever council sorted first. */
export function seatIdForIdentity(look: SeatLookup): string | null {
  if (look.positionId && findPosition(look.positionId)) return look.positionId
  const post = (look.post ?? '').toLowerCase()
  const state = STATES.find(s => s.name.toLowerCase() === (look.state ?? '').toLowerCase())
  const code = state?.code ?? null

  if (post.includes('vice president')) return 'federal/vice-president'
  if (post.includes('president')) return 'federal/president'
  if (post.includes('deputy governor') && code) return `state/${code}/deputy-governor`
  if (post.includes('governor') && code) return `state/${code}/governor`
  if (post.includes('minister')) {
    if (post.includes('capital territory') || post.includes('fct')) {
      const fct = 'federal/minister/federal-capital-territory'
      return findPosition(fct) ? fct : null
    }
    const slug = post.replace(/^.*minister of (the )?/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `federal/minister/${slug}`
    return findPosition(id) ? id : null
  }
  if (post.includes('chairman') && code && look.lga) {
    const lga = LGAS.find(g => g.stateCode === code && g.name.toLowerCase() === look.lga!.toLowerCase())
    return lga ? `lga/${code}/${lga.name}/chairman` : null
  }
  if (post.includes('speaker') && code) return `state/${code}/speaker`
  if (post.includes('senator') && code) return POSITIONS.find(p => p.id.startsWith(`federal/senator/${code}`))?.id ?? null
  if (post.includes('reps') || post.includes('member')) {
    return POSITIONS.find(p => p.id.startsWith(`federal/rep/${code}`))?.id ?? null
  }
  return null
}

export interface WorldSeedInput {
  name?: string
  post?: string
  state?: string
  lga?: string | null
  positionId?: string | null
}

/** The seed of this desk's Nigeria: stable across reloads, different for every
 *  (name, post, state, council). A governor in Delta and a governor in Kano do not share
 *  a country, and the same desk never rolls itself a new one. */
export function worldSeedFor(input: WorldSeedInput): number {
  const key = [input.name ?? 'player', input.post ?? '', input.state ?? '', input.lga ?? '', input.positionId ?? ''].join('|')
  const seed = hash32(`mandate/world/${key}`)
  return seed === 0 ? 1 : seed
}

/* --------------------------------------------------------------------------- */
/* storage                                                                      */
/* --------------------------------------------------------------------------- */

/** The world, as JSON. Maps do not survive JSON, so the relationship matrix is written as
 *  pairs. The catalogue and the parties are NOT stored: both are pure functions of the
 *  seed, so storing them would double the payload for no information. */
interface SerialisedLiving {
  version: 1
  seed: number
  week: number
  date: string
  npcs: Npc[]
  departed: Npc[]
  media: MediaOutlet[]
  players: PlayerEntry[]
  journal: LifeEvent[]
  relationships: [string, [string, Relationship][]][]
}

export function serialiseWorld(world: LivingWorld): string {
  const payload: SerialisedLiving = {
    version: 1,
    seed: world.seed,
    week: world.week,
    date: world.date,
    npcs: world.npcs,
    departed: world.departed,
    media: world.media,
    players: world.players,
    journal: world.journal,
    relationships: [...world.relationships].map(([from, edges]) => [from, [...edges]]),
  }
  return JSON.stringify(payload)
}

export function reviveWorld(raw: string): LivingWorld | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SerialisedLiving>
    if (!parsed || typeof parsed.seed !== 'number' || typeof parsed.week !== 'number') return null
    if (!Array.isArray(parsed.npcs) || !Array.isArray(parsed.players) || parsed.players.length === 0) return null
    const relationships = new Map<string, Map<string, Relationship>>()
    for (const [from, edges] of parsed.relationships ?? []) {
      if (!Array.isArray(edges)) continue
      relationships.set(from, new Map(edges))
    }
    return {
      seed: parsed.seed,
      week: parsed.week,
      date: parsed.date ?? '2025-12-29',
      positions: new Map(POSITIONS.map(p => [p.id, p])),
      seats: SEAT_INDEX,
      parties: generateParties(parsed.seed),
      npcs: parsed.npcs,
      departed: parsed.departed ?? [],
      relationships,
      media: parsed.media ?? [],
      players: parsed.players,
      journal: parsed.journal ?? [],
    }
  } catch {
    return null
  }
}

export function loadWorld(storage: LivingStorage): LivingWorld | null {
  try {
    const raw = storage.getItem(LIVING_KEY)
    return raw ? reviveWorld(raw) : null
  } catch {
    return null
  }
}

export function saveWorld(storage: LivingStorage, world: LivingWorld): void {
  storage.setItem(LIVING_KEY, serialiseWorld(world))
}

/* --------------------------------------------------------------------------- */
/* the player at this desk                                                      */
/* --------------------------------------------------------------------------- */

export interface LivingPlayerInput {
  name: string
  positionId: string | null
  /** a party code ('PA') or a party name ('Progressive Alliance') — resolved below */
  partyCode: string | null
  /** the desk's own approval, which is what a poll actually tests */
  approval?: number
  bank?: number
  axes?: Partial<Axes>
}

const NEUTRAL: Axes = {
  competence: 50, integrity: 50, popularity: 50, partyLoyalty: 50, eliteTrust: 50,
  pressTone: 0, constituency: 50, patronage: 50, legitimacy: 60, memory: 30,
}

/** The party code the world knows. The desk stores a party *name*; the world trades in
 *  codes. A name that matches nothing — an independent, or a party that is not in this
 *  federation — leaves the code alone rather than inventing one. */
export function resolvePartyCode(parties: readonly Party[], raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const byCode = parties.find(p => p.code.toLowerCase() === trimmed.toLowerCase())
  if (byCode) return byCode.code
  const byName = parties.find(p => p.name.toLowerCase() === trimmed.toLowerCase())
  if (byName) return byName.code
  return null
}

function syncPlayer(world: LivingWorld, input: LivingPlayerInput): void {
  const prior = world.players[0]
  const partyCode = resolvePartyCode(world.parties, input.partyCode)
  world.players = [{
    id: 'player',
    name: input.name,
    bank: input.bank ?? prior?.bank ?? 0,
    positionId: input.positionId,
    partyCode: partyCode ?? prior?.partyCode ?? null,
    axes: {
      ...NEUTRAL,
      ...(prior?.axes ?? {}),
      ...(input.axes ?? {}),
      popularity: input.approval ?? prior?.axes.popularity ?? 50,
    },
  }]
}

/** Load this desk's world, or open one. Called once per session, then advanced. */
export function ensureWorld(storage: LivingStorage, input: LivingPlayerInput): { world: LivingWorld; created: boolean } {
  const existing = loadWorld(storage)
  if (existing) {
    syncPlayer(existing, input)
    saveWorld(storage, existing)
    return { world: existing, created: false }
  }
  const seed = worldSeedFor(input)
  const world = createLivingWorld(seed, {
    player: {
      name: input.name,
      positionId: input.positionId,
      partyCode: resolvePartyCode(generateParties(seed), input.partyCode) ?? undefined,
      bank: input.bank ?? 0,
      axes: { ...(input.axes ?? {}), popularity: input.approval ?? 50 },
    },
  })
  saveWorld(storage, world)
  return { world, created: true }
}

/** One Monday of the living country, at the desk's week close.
 *
 *  `answered` is the tray the player has just finished with. Its stamps are read first, so
 *  the answers land on the actor before his week is run: the man who was refused on paper
 *  is refused in the country for the same Monday. */
export function runLivingWeek(
  storage: LivingStorage,
  input: LivingPlayerInput,
  answered?: AnsweredTray,
): { world: LivingWorld; report: TurnReport; effects: AnswerEffect[] } {
  const { world } = ensureWorld(storage, input)
  const effects = applyAnswers(
    world,
    answered ? answersFromTray(answered.tray ?? [], answered.marks ?? {}) : [],
  )
  const report = advanceTurn(world)
  saveWorld(storage, world)
  return { world, report, effects }
}

/* --------------------------------------------------------------------------- */
/* the week close, as one call                                                 */
/* --------------------------------------------------------------------------- */

export interface LivingCloseInput {
  storage: LivingStorage
  player: LivingPlayerInput
  /** the tray the desk is filing, whose stamps are the answers */
  tray?: readonly Doc[]
  marks?: Record<string, StampState | undefined>
}

export interface LivingClose {
  world: LivingWorld
  report: TurnReport
  /** one paper per stamp, in the order they were answered */
  effects: AnswerEffect[]
  /** Monday's papers, the receipt included */
  papers: Doc[]
  /** what the country's press printed, the desk's own refusal included */
  stories: GazetteStory[]
  /** the patronage bank after any money the answers moved — what the strip must show */
  bank: number
  /** what the answers did to public approval, signed */
  approvalDelta: number
}

/** Everything one week close asks the living country to do, in the order it has to happen:
 *  open the world, read the closing tray as answers, run the Monday, write it back. The
 *  desk's own close calls this and nothing else, so the path the player takes is the path
 *  the tests take. Throws only if storage is unreachable; the caller decides what to do. */
export function closeLivingWeek(input: LivingCloseInput): LivingClose {
  const { world, report, effects } = runLivingWeek(input.storage, input.player, {
    tray: input.tray,
    marks: input.marks,
  })
  return {
    world,
    report,
    effects,
    papers: livingPapers(world, report, effects),
    stories: livingPress(world, report, effects),
    bank: world.players[0]?.bank ?? 0,
    approvalDelta: effects.reduce((n, e) => n + e.approvalDelta, 0),
  }
}

/* --------------------------------------------------------------------------- */
/* paper                                                                        */
/* --------------------------------------------------------------------------- */

/** ₦1_400_000_000 → "₦1.40bn". The desk prints money the way the purse does. */
export function naira(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `₦${(abs / 1_000_000_000).toFixed(2)}bn`
  if (abs >= 1_000_000) return `₦${Math.round(abs / 1_000_000)}m`
  if (abs >= 1_000) return `₦${Math.round(abs / 1_000)}k`
  return `₦${Math.round(abs)}`
}

/** A stable pick from a list, so the same paper always wears the same materials. */
function stablePick<T>(list: readonly T[], key: string): T {
  return list[hash32(key) % list.length]!
}

function actorOf(world: LivingWorld, id: string): Npc | undefined {
  return world.npcs.find(n => n.id === id) ?? world.departed.find(n => n.id === id)
}

/** A name a paper could print. The player is not in the cast, so a leak aimed at this desk
 *  is reported as "this desk" rather than as a stranger the paper cannot name. */
function pressName(world: LivingWorld, id: string, fallback: string): string {
  if (world.players.some(p => p.id === id)) return 'this desk'
  return actorOf(world, id)?.name ?? fallback
}

/** An actor named the way a paper would name them: the seat first, then the party. */
function actorLine(npc: Npc | undefined, fallback: string): string {
  if (!npc) return fallback
  const seat = npc.positionId ? findPosition(npc.positionId) : undefined
  const bits: string[] = [seat ? seat.title : 'no seat']
  if (npc.partyCode) bits.push(npc.partyCode)
  if (npc.faction) bits.push(npc.faction)
  return `${npc.name} — ${bits.join(' · ')}`
}

interface PaperKit {
  week: number
  year: number
  dateLabel: string
}

function kitFor(report: TurnReport): PaperKit {
  return {
    week: report.week,
    year: Number(report.date.slice(0, 4)),
    dateLabel: labelDate(report.date).toUpperCase(),
  }
}

/** The house kit every living document is filed under: the same register, the same two
 *  audit lines, the same authority face — because these papers came in by the front door,
 *  not out of the ledger. */
function base(kit: PaperKit, suffix: string, over: { title: string; trayLine: string; mark: Doc['mark'] }) {
  return {
    id: `living/${kit.week}/${suffix}`,
    title: over.title,
    trayLine: over.trayLine,
    mark: over.mark,
    date: kit.dateLabel,
    recordId: `MANDATE/${kit.year}/W${kit.week}/${suffix.toUpperCase()}`,
    authority: 'DESK REGISTER · AN APPROACH',
    authorityText:
      'An approach is not a filing. Nothing here is signed into the record unless you answer it — which is why what you do next is the only part of this that becomes evidence.',
    audit: [
      `${kit.dateLabel} · 06:40 — delivered to the in-tray · visibility: private`,
      `${kit.dateLabel} · 06:41 — entered on the desk register from the week’s traffic`,
    ],
  }
}

const ASK_TITLE: Record<string, string> = {
  bribe: 'A REQUEST FOR MONEY',
  favour: 'A FAVOUR ASKED',
  leak: 'A LEAK IN THE PRESS',
  truce: 'A TRUCE OFFERED',
  outreach: 'A COALITION COUNTING YOU',
}

const ASK_TRAY: Record<string, string> = {
  bribe: 'the figure was named out loud, in a corridor, with no paper',
  favour: 'an appointment is yours to give and the party’s to price',
  leak: 'something you have not said is already with the press',
  truce: 'bury it, and turn on a third man together',
  outreach: 'a coalition is being built and your name is on the list',
}

const ASK_LINE: Record<string, string> = {
  bribe: 'Nothing about this is on the file. The register records only what you do next.',
  favour: 'An appointment is yours to give and the party’s to price. Both are on this desk.',
  leak: 'A leak is aimed at what you have not said yet. Quiet is cheaper than a reply.',
  truce: 'A truce with an enemy costs less than a war with two.',
  outreach: 'Somebody is building a coalition. You are being counted, not asked.',
}

/* What the two stamps mean on this particular paper. An approach that leaves the meaning
   of a stamp to be guessed is not an approach, it is a trap: the paper states the price of
   each answer, and the closing of the week carries it to the man who asked. */
const ASK_STAMP: Record<string, string> = {
  bribe: 'Stamped APPROVED, it is paid out of the patronage bank. Stamped DECLINED, he leaves with a no and a story about you.',
  favour: 'Stamped APPROVED, the appointment is his. Stamped DECLINED, a friend has been told no.',
  leak: 'Stamped APPROVED, the story is bought back. Stamped DECLINED, it runs and the desk answers for it.',
  truce: 'Stamped APPROVED, the quarrel is buried. Stamped DECLINED, the war goes on and he will not offer again.',
  outreach: 'Stamped APPROVED, your name goes on the coalition. Stamped DECLINED, it is built without you.',
}

const ASK_ORDER: Record<string, number> = { bribe: 0, leak: 1, truce: 2, favour: 3, outreach: 4 }

/** One approach, as the note the desk actually receives. */
export function approachPaper(
  world: LivingWorld,
  item: PlayerTurn['addressedToPlayer'][number],
  report: TurnReport,
): NoteDoc {
  const kit = kitFor(report)
  const npc = actorOf(world, item.npcId)
  const suffix = `ask-${item.kind}-${hash32(item.npcId).toString(36)}`
  const money = typeof item.amountNaira === 'number' ? `The figure named: ${naira(item.amountNaira)}.` : null
  const lines = [
    item.detail,
    money,
    ASK_LINE[item.kind] ?? 'The desk has no rule for this one.',
    ASK_STAMP[item.kind] ?? 'The stamps mean what they always mean. Ask the aide which is which.',
  ].filter((l): l is string => Boolean(l))
  return {
    ...base(kit, suffix, {
      title: `${ASK_TITLE[item.kind] ?? 'AN APPROACH'} — ${item.npcName}`,
      trayLine: `${item.npcName}: ${ASK_TRAY[item.kind] ?? 'an approach'}`,
      mark: item.kind === 'bribe' || item.kind === 'leak' ? 'urgent' : 'fresh',
    }),
    kind: 'note',
    stock: 'pad',
    clip: 'paperclip',
    stain: stablePick(['ring', 'coffee', 'none'] as const, suffix),
    from: actorLine(npc, item.npcName),
    re: ASK_TITLE[item.kind] ?? 'AN APPROACH',
    lines,
    /* The ask rides on the paper so the stamp can be read back without parsing the prose */
    ask: {
      npcId: item.npcId,
      npcName: item.npcName,
      kind: item.kind,
      ...(typeof item.amountNaira === 'number' ? { amountNaira: item.amountNaira } : {}),
    },
  }
}

/** A death the player has a relationship with, as the paper prints it. */
export function deathPaper(world: LivingWorld, dead: { npcId: string; name: string }, report: TurnReport): ClippingDoc {
  const kit = kitFor(report)
  const npc = actorOf(world, dead.npcId)
  const age = npc ? ageOf(npc, kit.year) : null
  const seat = npc?.positionId ? findPosition(npc.positionId) : undefined
  const outlet = friendliestOutlet(world.media, npc?.partyCode ?? null)?.name ?? 'The Gazette'
  const suffix = `death-${hash32(dead.npcId).toString(36)}`
  const held = npc?.termsServed
    ? `${npc.termsServed} term${npc.termsServed === 1 ? '' : 's'} in public office`
    : 'no elected term behind them'
  return {
    ...base(kit, suffix, {
      title: `${dead.name} — OBITUARY`,
      trayLine: `${dead.name}${age === null ? '' : `, ${age},`} is dead — you knew them`,
      mark: 'urgent',
    }),
    kind: 'clipping',
    stock: 'newsprint',
    clip: 'none',
    stain: 'spatter',
    outlet,
    kicker: 'OBITUARY',
    headline: `${dead.name}${age === null ? '' : `, ${age},`} dies`,
    byline: 'Our Correspondent',
    paras: [
      `${dead.name} died this week${age === null ? '' : ` at ${age}`}. ${npc?.partyCode ? `They were ${npc.partyCode}` : 'They were unaffiliated'}${npc?.faction ? `, of the ${npc.faction}` : ''}, and ${held}.`,
      `${seat ? `At the end they held ${seat.title}.` : 'At the end they held nothing.'} The ward chapters they carried do not pass to an heir; they pass to whoever reaches them first.`,
    ],
    briefs: ['The seat is open until the next poll.', 'The debts stay with the estate, and the estate is a phone.'],
  }
}

/** The poll, as the returning officer's note. Losing the seat is the one paper nobody
 *  wants to find on the tray, so it is marked the way an urgent one is. */
export function pollPaper(report: TurnReport): NoteDoc {
  const kit = kitFor(report)
  const lost = report.playerTurn.officesLost
  const lines = [
    ...report.playerTurn.elections,
    ...lost.map(seat => `You no longer hold ${seat}. The desk is a phone and a list of names until the next poll.`),
    lost.length === 0
      ? 'The register stands. Nothing changes at this desk this week, and that is the whole of the good news.'
      : 'The register is corrected this week, not at your convenience.',
  ]
  return {
    ...base(kit, 'poll', {
      title: lost.length > 0 ? 'RETURN OF THE POLL — YOU LOST' : 'RETURN OF THE POLL',
      trayLine: lost.length > 0 ? `you are out: ${lost.join(', ')}` : 'nothing moved; the seat held',
      mark: lost.length > 0 ? 'urgent' : 'fresh',
    }),
    kind: 'note',
    stock: 'form',
    clip: 'none',
    stain: 'none',
    from: 'The Returning Officer',
    re: 'RETURN OF THE POLL',
    lines,
  }
}

/** The week in the country, in one note. This is the paper that proves the world is not
 *  waiting for you: it ran whether or not anything was addressed to this desk. */
export function countryPaper(world: LivingWorld, report: TurnReport): NoteDoc {
  const kit = kitFor(report)
  const notable = report.journal.filter(
    (e: LifeEvent) => e.kind === 'betrayal' || e.kind === 'alliance' || e.kind === 'election' || e.kind === 'death',
  )
  const shown = notable.slice(0, 5)
  const drowned = notable.length - shown.length
  const body = shown.length > 0
    ? [
        ...shown.map(e => e.summary),
        drowned > 0
          ? `…and ${drowned} more that will not reach this desk.`
          : `That is ${notable.length} of the ${report.actions.length} moves the cast made this week.`,
      ]
    : ['No betrayal, no defection, no death worth a line. The country worked quietly.']
  return {
    ...base(kit, 'country', {
      title: `THE WEEK IN THE COUNTRY — ${kit.dateLabel}`,
      trayLine: `${report.actions.length} moves by ${world.npcs.length} actors — none of them asked you`,
      mark: 'fresh',
    }),
    kind: 'note',
    stock: 'lined',
    clip: 'binder',
    stain: 'coffee',
    from: 'The desk register',
    re: 'THE WEEK IN THE COUNTRY',
    lines: body,
  }
}

/** Everything the week put on the tray, in the order a chief of staff would hand it over:
 *  the money asks, then the register of what you answered last week, then the poll, then the
 *  dead, then the country. Capped, because a desk that hands you eleven papers is a desk
 *  that hands you none — but the country note always keeps the last slot, since a week that
 *  silently drops the proof the world is running is a week that lies about being alive. */
export function livingPapers(
  world: LivingWorld,
  report: TurnReport,
  answers: readonly AnswerEffect[] = [],
  cap = LIVING_PAPER_CAP,
): Doc[] {
  const asks = [...report.playerTurn.addressedToPlayer]
    .sort((a, b) => (ASK_ORDER[a.kind] ?? 9) - (ASK_ORDER[b.kind] ?? 9))
    .map(item => approachPaper(world, item, report))
  const receipt = answerPaper(answers, report)
  const contested = report.playerTurn.elections.length > 0 || report.playerTurn.officesLost.length > 0

  const front: Doc[] = [
    ...asks,
    ...(receipt ? [receipt] : []),
    ...(contested ? [pollPaper(report)] : []),
    ...report.playerTurn.deathsOfKnown.map(dead => deathPaper(world, dead, report)),
  ]
  const room = Math.max(0, cap - 1)
  return [...front.slice(0, room), countryPaper(world, report)]
}

/* --------------------------------------------------------------------------- */
/* what the desk answered                                                       */
/* --------------------------------------------------------------------------- */

/** The five approaches the world can make to a desk. */
export type AskKind = NonNullable<NoteDoc['ask']>['kind']

/** One stamp on one approach, read back as an answer. */
export interface LivingAnswer {
  docId: string
  npcId: string
  npcName: string
  kind: AskKind
  granted: boolean
  amountNaira?: number
}

/** What an answer did, in the terms the register keeps: who it moved, how far, and what
 *  it cost. The receipt paper is built from these, and the cast folder reads the same
 *  numbers a moment later. */
export interface AnswerEffect {
  docId: string
  npcId: string
  npcName: string
  kind: AskKind
  granted: boolean
  /** standing with the desk before the answer (-100..100) */
  before: number
  /** standing after it, before the country's own Monday moves anything */
  after: number
  /** ₦ that actually left the patronage bank */
  paidNaira: number
  /** what the answer did to public approval, signed. Zero for most answers: only a story
   *  that runs can be read by anybody. */
  approvalDelta: number
  /** one line, in the desk's voice, saying what the answer did */
  outcome: string
}

/** The stamp state the desk keeps per paper. Structural, not an import: the sim does not
 *  need to know what a React document is, only that a paper can carry a stamp label. */
export interface StampState {
  stamps?: readonly { label: string }[]
}

export interface AnsweredTray {
  /** the papers that were on the desk when the week closed */
  tray?: readonly Doc[]
  /** the marks carried for those papers */
  marks?: Record<string, StampState | undefined>
}

/** An hour-glass rule: what one honest answer is worth to the man who asked. */
const ANSWER_TRUST: Record<AskKind, { grant: number; refuse: number }> = {
  bribe: { grant: 18, refuse: -22 },
  favour: { grant: 12, refuse: -16 },
  leak: { grant: 6, refuse: -14 },
  truce: { grant: 20, refuse: -12 },
  outreach: { grant: 14, refuse: -8 },
}

/** What an answer costs the desk in public standing. Buying a story back means it never ran,
 *  so nothing is read out of the desk; letting it run means the country reads it, and the
 *  desk's own approval meter is where that lands. */
const ANSWER_APPROVAL: Record<AskKind, { grant: number; refuse: number }> = {
  bribe: { grant: 0, refuse: 0 },
  favour: { grant: 0, refuse: 0 },
  leak: { grant: 0, refuse: -4 },
  truce: { grant: 0, refuse: 0 },
  outreach: { grant: 0, refuse: 0 },
}

/** The stamps the desk offers on every paper, and what each one means here. */
export const STAMP_GRANT = 'APPROVED'
export const STAMP_REFUSE = 'DECLINED'

/** Every approach on the tray that carries a stamp, read as an answer. A paper left
 *  unstamped is not an answer: it writes nothing, and the register says so on the receipt
 *  rather than quietly deciding for the player. */
export function answersFromTray(tray: readonly Doc[], marks: Record<string, StampState | undefined>): LivingAnswer[] {
  const answers: LivingAnswer[] = []
  for (const doc of tray) {
    if (doc.kind !== 'note' || !doc.ask) continue
    const label = marks[doc.id]?.stamps?.[0]?.label
    if (label !== STAMP_GRANT && label !== STAMP_REFUSE) continue
    answers.push({
      docId: doc.id,
      npcId: doc.ask.npcId,
      npcName: doc.ask.npcName,
      kind: doc.ask.kind,
      granted: label === STAMP_GRANT,
      ...(typeof doc.ask.amountNaira === 'number' ? { amountNaira: doc.ask.amountNaira } : {}),
    })
  }
  return answers
}

function clampTrust(n: number): number {
  return Math.max(-100, Math.min(100, n))
}

/** Move one edge, dated, so the week's decay cannot eat an answer the same week it lands. */
function moveEdge(world: LivingWorld, from: string, to: string, delta: number): void {
  const edge = world.relationships.get(from)?.get(to)
  if (!edge) return
  edge.trust = clampTrust(edge.trust + delta)
  edge.lastInteraction = world.date
  edge.interactionCount += 1
}

/** The sentence the receipt prints for one answer. */
function outcomeFor(
  kind: AskKind,
  granted: boolean,
  npcName: string,
  paid: number,
  shortfall: number,
): string {
  if (kind === 'bribe') {
    if (!granted) return `${npcName} asked for money and was refused. That is a story he can tell about you, and will.`
    if (shortfall > 0) return `You promised what the purse did not hold: ${naira(paid)} paid, ${naira(shortfall)} left as a debt he will collect.`
    return `${npcName} has ${naira(paid)}. Nothing about it is written down, which is the point.`
  }
  if (kind === 'favour') {
    return granted
      ? `${npcName} has the appointment, and will say where it came from.`
      : `${npcName} asked for a small thing and got a no. He will remember the size of it.`
  }
  if (kind === 'leak') {
    return granted
      ? `${npcName} was paid to pull the story. Paid is not the same as forgiven.`
      : `${npcName} ran it. Refusing to pay is the one answer that cannot be walked back.`
  }
  if (kind === 'truce') {
    return granted
      ? `The quarrel with ${npcName} is buried, for as long as the third man is worth more to both of you.`
      : `${npcName} offered peace and was declined. He will not offer twice.`
  }
  return granted
    ? `Your name is on ${npcName}’s coalition. The counting has started and you are in it.`
    : `The coalition goes on without this desk. Counted is not the same as asked, and now you are neither.`
}

/** Apply the desk's answers to the world. This is the only place a stamp reaches an actor,
 *  and it runs before the Monday, so the man who was refused carries the refusal into the
 *  week he is about to have — which is what makes it show up later without being scripted. */
export function applyAnswers(world: LivingWorld, answers: readonly LivingAnswer[]): AnswerEffect[] {
  const effects: AnswerEffect[] = []
  const player = world.players[0]
  for (const answer of answers) {
    const npc = actorOf(world, answer.npcId)
    const edge = world.relationships.get('player')?.get(answer.npcId)
    if (!npc || !edge) continue
    const before = edge.trust
    let paid = 0
    let shortfall = 0
    if (answer.kind === 'bribe' && answer.granted) {
      const ask = Math.max(0, answer.amountNaira ?? 0)
      paid = Math.min(ask, Math.max(0, player?.bank ?? 0))
      if (player) player.bank -= paid
      shortfall = ask - paid
    }
    /* A man who was promised money and did not get all of it is not as warm as a man who
       was paid, but he is warmer than a man who was refused. */
    const delta = answer.granted
      ? shortfall > 0 ? Math.round(ANSWER_TRUST[answer.kind].grant / 3) : ANSWER_TRUST[answer.kind].grant
      : ANSWER_TRUST[answer.kind].refuse
    /* Both directions move: the desk's own view is what the cast folder prints, and the
       actor's view is what his week is decided on. Answering only one of them would make
       the world react to a paper it never received. */
    moveEdge(world, 'player', answer.npcId, delta)
    moveEdge(world, answer.npcId, 'player', delta)
    if (answer.granted && (answer.kind === 'bribe' || answer.kind === 'leak')) edge.sharedSecrets += 1
    if (shortfall > 0) edge.debt += shortfall
    const outcome = outcomeFor(answer.kind, answer.granted, npc.name, paid, shortfall)
    const approvalDelta = answer.granted
      ? ANSWER_APPROVAL[answer.kind].grant
      : ANSWER_APPROVAL[answer.kind].refuse
    npc.history.push({
      date: world.date,
      event: answer.granted ? 'desk granted' : 'desk refused',
      detail: outcome,
    })
    world.journal.push({ date: world.date, kind: 'decision', summary: outcome, vs: answer.npcId })
    effects.push({
      docId: answer.docId,
      npcId: answer.npcId,
      npcName: npc.name,
      kind: answer.kind,
      granted: answer.granted,
      before,
      after: edge.trust,
      paidNaira: paid,
      approvalDelta,
      outcome,
    })
  }
  return effects
}

/** The desk's own register of the answers it gave: what was granted, what was refused, and
 *  how far each one moved the man who asked. It arrives the Monday after the stamps, which
 *  is the first week the country could possibly have heard of them. */
export function answerPaper(effects: readonly AnswerEffect[], report: TurnReport): NoteDoc | null {
  if (effects.length === 0) return null
  const kit = kitFor(report)
  const granted = effects.filter(e => e.granted).length
  const lines = effects.map(e =>
    `${e.granted ? 'GRANTED' : 'REFUSED'} · ${e.npcName} — ${e.outcome} Standing ${signed(e.before)} → ${signed(e.after)}.`
    + (e.approvalDelta === 0 ? '' : ` Approval fell ${Math.abs(e.approvalDelta)} points.`),
  )
  lines.push('A paper left unstamped writes nothing. That is the whole of the desk’s mercy, and all of its silence.')
  return {
    ...base(kit, 'answers', {
      title: `THE DESK ANSWERED — ${effects.length} APPROACH${effects.length === 1 ? '' : 'ES'}`,
      trayLine: `${granted} granted, ${effects.length - granted} refused — and the country has been told`,
      mark: 'fresh',
    }),
    kind: 'note',
    stock: 'form',
    clip: 'none',
    stain: 'none',
    from: 'The desk register',
    re: 'WHAT THE STAMPS WROTE',
    lines,
  }
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

/* --------------------------------------------------------------------------- */
/* the press                                                                    */
/* --------------------------------------------------------------------------- */

/* Four leaks in one week must not print as four identical headlines: a paper that repeats
   itself reads like a template, and the whole point of this folder is that it does not. */
const LEAK_HEADLINE: readonly string[] = [
  'A leak lands on {name}',
  '{name} — and the envelope that found a newsroom',
  'What the file says about {name}',
  'A bad week to be {name}',
]

const LEAK_GLOSS: readonly string[] = [
  'The desk will be asked about it before it is asked anything else.',
  'Nothing in the copy is contested. That is what makes it expensive.',
  'It ran without a denial, which is the same as running twice.',
  'The story is the least of it; the questions after it are the cost.',
]

/** What the papers print about the week. Only things a paper would run: a leak, a
 *  defection, a bought story, a poll, a death — and a leak this desk declined to buy back,
 *  which is the one story the desk wrote itself. Two of any one kind is the most a week's
 *  paper carries: a front page with four of the same story is a front page nobody reads. */
export function livingPress(
  world: LivingWorld,
  report: TurnReport,
  answers: readonly AnswerEffect[] = [],
): GazetteStory[] {
  const stories: GazetteStory[] = []
  /* The leak's headline and gloss are placed by position at the end, not here: picked by
     hash, two leaks in one week can land on the same line twice, and a paper that repeats
     itself reads like a template. */
  const leakNames = new Map<string, string>()

  for (const [i, action] of report.actions.entries()) {
    const actor = actorOf(world, action.npcId)
    const target = action.targetId ? actorOf(world, action.targetId) : undefined
    if (action.type === 'leak_blackmail') {
      const id = `living/press/${report.week}/leak-${i}`
      leakNames.set(id, pressName(world, action.targetId ?? '', 'a name the desk knows'))
      stories.push({
        id,
        title: 'A leak lands on {name}',
        impact: 'both',
        magnitude: 3,
        description: action.detail,
        affectedSectors: [target?.homeState ?? 'National'],
      })
    } else if (action.type === 'defect') {
      stories.push({
        id: `living/press/${report.week}/defect-${i}`,
        title: `${actor?.name ?? 'A member'} crosses to ${action.targetId}`,
        impact: 'approval',
        magnitude: 2,
        description: `${action.detail} A defection is counted, never explained: the register says where the seat went, and the seat is what the paper prints.`,
        affectedSectors: [actor?.homeState ?? 'National'],
      })
    } else if (action.type === 'plant_story') {
      stories.push({
        id: `living/press/${report.week}/plant-${i}`,
        title: `${actor?.name ?? 'A funder'} buys a performance`,
        impact: 'approval',
        magnitude: 1,
        description: `${action.detail} The outlet was paid for it${action.amountNaira ? ` — ${naira(action.amountNaira)} for the placement` : ''}, which is the part that never runs in the copy.`,
        affectedSectors: [actor?.homeState ?? 'National'],
      })
    }
  }

  for (const result of report.elections) {
    stories.push({
      id: `living/press/${report.week}/poll-${result.seatId}`,
      title: `${result.seatTitle} — ${result.wasPlayer ? 'you held it' : 'it changed hands'}`,
      impact: 'approval',
      magnitude: result.wasPlayer ? 1 : 2,
      description: `${result.note} ${result.challengers} candidate${result.challengers === 1 ? '' : 's'} stood for it.`,
      affectedSectors: ['National'],
    })
  }

  /* An approach the desk answered by letting it run. The man had the file and was not paid
     for it, so the file is printed — this is the cost of a refusal, and it is a paper rather
     than a number nobody can see. */
  const playerSeat = world.players[0]?.positionId ? findPosition(world.players[0]!.positionId!) : undefined
  for (const answer of answers) {
    if (answer.kind !== 'leak' || answer.granted) continue
    stories.push({
      id: `living/press/${report.week}/ran-${hash32(answer.npcId).toString(36)}`,
      title: `The file on ${playerSeat?.title ?? 'this desk'}`,
      impact: 'approval',
      magnitude: 3,
      description: `${answer.npcName} held something on this desk and was not paid for it, so it ran. The desk answered for it at ${Math.abs(answer.approvalDelta)} points of public approval, and will answer for it again the next time somebody asks what it knew.`,
      affectedSectors: ['National'],
    })
  }

  for (const dead of report.deaths) {
    stories.push({
      id: `living/press/${report.week}/death-${dead.npcId}`,
      title: `${dead.name} is dead`,
      impact: 'approval',
      magnitude: 1,
      description: 'The seat is open and the ward chapters are already being counted. Whoever inherits them inherits the debts with them.',
      affectedSectors: ['National'],
    })
  }

  const perKind = new Map<string, number>()
  const varied = stories.filter(story => {
    const kind = /\/press\/\d+\/([a-z]+)/.exec(story.id)?.[1] ?? 'story'
    const seen = perKind.get(kind) ?? 0
    if (seen >= 2) return false
    perKind.set(kind, seen + 1)
    return true
  })
  /* A story this desk let run leads the paper, because the week's cap is four stories and
     the desk's own refusal must not be the one that gets cut: the polls still take the four
     points off it either way, and a cost with no visible cause is the worst of both. */
  const ordered = [
    ...varied.filter(s => s.id.includes('/ran-')),
    ...varied.filter(s => !s.id.includes('/ran-')),
  ]
  return ordered.slice(0, LIVING_PRESS_CAP).map((story, i) => {
    const name = leakNames.get(story.id)
    if (name === undefined) return story
    return {
      ...story,
      title: LEAK_HEADLINE[i % LEAK_HEADLINE.length]!.replace('{name}', name),
      description: `${story.description} ${LEAK_GLOSS[i % LEAK_GLOSS.length]}`,
    }
  })
}

/* --------------------------------------------------------------------------- */
/* the cast, and the calendar                                                   */
/* --------------------------------------------------------------------------- */

/** The shape the patronage folder already renders, so the folder shows real names from the
 *  cast instead of standing in with demo ones. Trust becomes 1–5 dots because that is what
 *  the folder's meter is; the raw number is kept beside it so nothing has to guess what the
 *  dots mean. */
export interface CastMember {
  id: string
  name: string
  role: string
  /** 1–5, from the relationship's trust (-100..100) */
  loyalty: number
  /** weeks until their return falls due; omitted when nothing is owed */
  ROI_due_weeks?: number
  /** the raw trust (-100..100) */
  trust: number
  /** ₦ they owe you */
  theyOweYou: number
  /** ₦ you owe them */
  owes: number
}

const DEBT_NOW = 5_000_000_000
const DEBT_SOON = 1_000_000_000

/** The actors this desk actually knows, most intense first. An enemy at −80 is a bigger
 *  fact on this desk than a friendly stranger at +20, so the sort is by |trust|. */
export function livingCast(world: LivingWorld, limit = 8): CastMember[] {
  const edges = world.relationships.get('player')
  if (!edges) return []
  const rows: CastMember[] = []
  for (const [id, rel] of edges) {
    const npc = world.npcs.find(n => n.id === id)
    if (!npc?.isAlive) continue
    const seat = npc.positionId ? findPosition(npc.positionId) : undefined
    const role = seat
      ? seat.title
      : npc.faction === 'Chairman'
        ? 'Party Chairman'
        : `Party elder · ${npc.partyCode ?? 'IND'}`
    rows.push({
      id,
      name: npc.name,
      role,
      loyalty: Math.max(1, Math.min(5, Math.round(((rel.trust + 100) / 200) * 5))),
      ROI_due_weeks: rel.debt > DEBT_NOW ? 0 : rel.debt > DEBT_SOON ? 1 : rel.debt > 0 ? 3 : undefined,
      trust: rel.trust,
      theyOweYou: rel.theyOweYou,
      owes: rel.debt,
    })
  }
  return rows.sort((a, b) => Math.abs(b.trust) - Math.abs(a.trust) || (a.id < b.id ? -1 : 1)).slice(0, Math.max(0, limit))
}

export interface PollRow {
  id: string
  kind: CycleKind
  label: string
  date: string
  dateLabel: string
  primaryOpensLabel: string
  officesUp: number
}

/** The polls still ahead of the desk, soonest first. */
export function upcomingPolls(dateISO: string, limit = 4): PollRow[] {
  return CALENDAR.filter(c => c.date >= dateISO).slice(0, Math.max(0, limit)).map(c => ({
    id: c.id,
    kind: c.kind,
    label: c.label,
    date: c.date,
    dateLabel: labelDate(c.date),
    primaryOpensLabel: labelDate(c.primaryOpens),
    officesUp: c.officesUp,
  }))
}

/** The seat the calendar says is next up for this desk's own post — the one line that
 *  answers "when is it my turn?" without scanning the calendar. */
export function nextPollForSeat(seat: Position | undefined, dateISO: string): PollRow | undefined {
  if (!seat) return upcomingPolls(dateISO, 1)[0]
  const kind: CycleKind = seat.tier === 'lga' || seat.tier === 'ward' ? 'lga' : seat.tier === 'federal' ? 'presidential' : 'state'
  return upcomingPolls(dateISO, 24).find(p => p.kind === kind)
}
