/* @mandate/sim/parties — the party system.
 *
 * The federation's parties are FICTIONAL. No real party appears anywhere in this module
 * (or in the data it generates), and no real politician is named. The eight parties below
 * have fixed identities — code, name, symbol, colour, founding year, base, and how much
 * godfatherism they tolerate — while their factions, founding crisis and split history are
 * generated, so every seed produces a different internal politics inside the same eight
 * brands.
 *
 * Everything is deterministic given a seed (see rng.ts). Nothing here reads the DOM, the
 * clock or Math.random.
 */

import { pick, pickIndex, chanceBp, subSeed, sfc32, hash32, randInt } from './rng'
import { pickName, type GeneratedName, type Zone } from './names'

/** A party's ideological position, each axis in basis points (0..10000). */
export interface PartyIdeology {
  /** tolerance for patronage politics and machine deals */
  patronage: number
  /** appetite for institutional/electoral reform */
  reform: number
  /** how much the party is built around one region */
  regionalism: number
}

export type FactionWing =
  | 'old-guard'
  | 'reformers'
  | 'youth'
  | 'governors'
  | 'women'
  | 'diaspora'
  | 'labour'
  | 'technocrats'

export const FACTION_WINGS: readonly FactionWing[] = [
  'old-guard', 'reformers', 'youth', 'governors', 'women', 'diaspora', 'labour', 'technocrats',
]

export interface PartyFaction {
  id: string
  /** e.g. "Reformers" / "Old Guard" — the public label */
  name: string
  wing: FactionWing
  /** share of the party's structure it controls, bp */
  strengthBp: number
  doctrine: string
  leaderId: string
  leader: GeneratedName
}

export interface PartyHistoryEvent {
  year: number
  kind: 'founded' | 'founding-crisis' | 'split' | 'merger' | 'victory' | 'defection-wave'
  summary: string
}

export interface Party {
  code: string
  name: string
  /** the party's ballot symbol */
  symbol: string
  /** the party's colour, as the desk prints it */
  colour: string
  colourHex: string
  founded: number
  /** the zones the party was born in and still draws its machine from */
  baseZones: readonly Zone[]
  /** how comfortably the party lives with godfathers, bp (0 = allergic, 10000 = built for it) */
  godfatherToleranceBp: number
  ideology: PartyIdeology
  factions: PartyFaction[]
  history: PartyHistoryEvent[]
  /** number of historical splits that produced a surviving faction or a rival party */
  splits: number
  chairmanId: string
  chairman: GeneratedName
}

interface PartySeed {
  code: string
  name: string
  symbol: string
  colour: string
  colourHex: string
  founded: number
  baseZones: readonly Zone[]
  godfatherToleranceBp: number
  ideology: PartyIdeology
  /** faction wings this party reliably carries, most-dominant first */
  wings: readonly FactionWing[]
  /** the crisis that nearly killed it in its founding decade */
  foundingCrisis: string
}

const PARTY_SEEDS: readonly PartySeed[] = [
  {
    code: 'PA', name: 'Progressive Alliance', symbol: 'broom', colour: 'green', colourHex: '#1c7a3e',
    founded: 1998, baseZones: ['SW', 'NW', 'NC'], godfatherToleranceBp: 8500,
    ideology: { patronage: 8200, reform: 3000, regionalism: 4500 },
    wings: ['old-guard', 'governors', 'youth'],
    foundingCrisis: 'a merger of three clubs that each wanted to keep its own register',
  },
  {
    code: 'PDM', name: "People's Democratic Movement", symbol: 'umbrella', colour: 'red', colourHex: '#b0212b',
    founded: 1999, baseZones: ['SS', 'SE', 'NC'], godfatherToleranceBp: 8000,
    ideology: { patronage: 7800, reform: 3500, regionalism: 6200 },
    wings: ['old-guard', 'diaspora', 'women'],
    foundingCrisis: 'the south-south governors bankrolled it and then argued over who owned it',
  },
  {
    code: 'LRP', name: 'Labour Reform Party', symbol: 'family', colour: 'gold', colourHex: '#c8951d',
    founded: 2002, baseZones: ['SW', 'SS', 'SE'], godfatherToleranceBp: 2500,
    ideology: { patronage: 2600, reform: 8800, regionalism: 2400 },
    wings: ['labour', 'youth', 'reformers'],
    foundingCrisis: 'a wage strike became a party before anyone had written a constitution',
  },
  {
    code: 'NCP', name: 'National Consensus Party', symbol: 'scale', colour: 'blue', colourHex: '#1d3f8f',
    founded: 1995, baseZones: ['NW', 'NE', 'NC'], godfatherToleranceBp: 7500,
    ideology: { patronage: 7200, reform: 4000, regionalism: 7000 },
    wings: ['old-guard', 'governors', 'technocrats'],
    foundingCrisis: 'the northern establishment registered it twice under two different trustees',
  },
  {
    code: 'ADC', name: 'Action Democratic Congress', symbol: 'torch', colour: 'orange', colourHex: '#c25a12',
    founded: 2005, baseZones: ['SW', 'NC', 'SS'], godfatherToleranceBp: 4500,
    ideology: { patronage: 4200, reform: 7000, regionalism: 3200 },
    wings: ['technocrats', 'reformers', 'women'],
    foundingCrisis: 'a donors\u2019 forum wrote the manifesto and forgot to build a single ward office',
  },
  {
    code: 'APF', name: 'Allied Peoples Front', symbol: 'handshake', colour: 'purple', colourHex: '#6a2f86',
    founded: 2010, baseZones: ['NC', 'NE', 'SS'], godfatherToleranceBp: 9000,
    ideology: { patronage: 8400, reform: 2200, regionalism: 5000 },
    wings: ['old-guard', 'diaspora', 'governors'],
    foundingCrisis: 'it was assembled in six weeks out of defectors and never chose a founding story',
  },
  {
    code: 'NNI', name: 'New Nigeria Initiative', symbol: 'star', colour: 'white', colourHex: '#8c8c94',
    founded: 2018, baseZones: ['SW', 'SE', 'SS'], godfatherToleranceBp: 1500,
    ideology: { patronage: 1800, reform: 9200, regionalism: 2800 },
    wings: ['youth', 'reformers', 'diaspora'],
    foundingCrisis: 'a register of 4 million members that could not be found on any server',
  },
  {
    code: 'UPP', name: 'United Progressive People', symbol: 'palm', colour: 'teal', colourHex: '#137a76',
    founded: 2012, baseZones: ['SE', 'SS'], godfatherToleranceBp: 6000,
    ideology: { patronage: 5800, reform: 5200, regionalism: 7400 },
    wings: ['technocrats', 'women', 'old-guard'],
    foundingCrisis: 'a market association funded it and expected a chairman of its own',
  },
]

const DOCTRINES: Record<FactionWing, readonly string[]> = {
  'old-guard': [
    'The machine is the party. Whoever holds the register holds the ticket.',
    'We won before these people were born. The structure remembers.',
    'Every reform is a chance for someone else to steal the register.',
  ],
  reformers: [
    'Primaries or nothing — the register must be open before the next cycle.',
    'The party dies of its own paperwork if it does not change.',
    'We will lose twice more before they admit we were right.',
  ],
  youth: [
    'The members are under 40. The officers are not. Do the arithmetic.',
    'Digital register, direct primaries, no delegates for sale.',
    'We are the turnout. Ignore us at the polling unit.',
  ],
  governors: [
    'The party is a delivery van. The state houses are the cargo.',
    'Whoever governs the most states decides the convention.',
    'Federal structure can wait until the state accounts are settled.',
  ],
  women: [
    'Half the membership, a tenth of the ticket. Fix the formula.',
    'We carry the rallies. We will carry the party too.',
    'No waiver for women officers is a choice, not a tradition.',
  ],
  diaspora: [
    'The money comes from abroad; the decisions are made without us.',
    'Fund the party properly and audit it properly.',
    'We can win the narrative if we are allowed to write it.',
  ],
  labour: [
    'The wage is the platform. Everything else is decoration.',
    'A party that cannot call a strike cannot defend a worker.',
    'Reform is fine until it lands on the salary arrears.',
  ],
  technocrats: [
    'Show me the model. Show me the cost. Then show me the ward.',
    'Competence is not a faction — it is the only electable position.',
    'Fund the party like a portfolio, not like a funeral.',
  ],
}

function factionName(wing: FactionWing): string {
  const names: Record<FactionWing, string> = {
    'old-guard': 'Old Guard',
    reformers: 'Reformers',
    youth: 'Youth Vanguard',
    governors: "Governors' Forum",
    women: 'Women Caucus',
    diaspora: 'Diaspora Assembly',
    labour: 'Labour Wing',
    technocrats: 'Technocrat Caucus',
  }
  return names[wing]
}

/** Generate the internal politics of one party from a stream. */
function buildParty(seed: PartySeed, streamName: string, masterSeed: number): Party {
  const next = sfc32(subSeed(masterSeed, streamName), hash32(`${seed.code}:a`), hash32(`${seed.code}:b`), hash32(`${seed.code}:c`))

  // 2–4 factions: the seeded wings, plus one emergent faction in some histories
  const emergent = chanceBp(next, 4500) ? [pick(next, FACTION_WINGS)] : []
  const wings = [...new Set([...seed.wings, ...emergent])].slice(0, 4)
  const weights = wings.map(() => randInt(next, 800, 4200))
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const factions: PartyFaction[] = wings.map((wing, i) => {
    const homeZone = pick(next, seed.baseZones)
    const leader = pickName(next, homeZone, { femaleBp: 3300, titleBp: 1800 })
    return {
      id: `party/${seed.code}/faction/${wing}`,
      name: factionName(wing),
      wing,
      strengthBp: Math.round((weights[i]! / totalWeight) * 10000),
      doctrine: pick(next, DOCTRINES[wing]),
      leaderId: `party/${seed.code}/faction/${wing}/leader`,
      leader,
    }
  })

  // histories: founding crisis, then 3 splits at real 4-year cadence
  const history: PartyHistoryEvent[] = [
    { year: seed.founded, kind: 'founded', summary: `${seed.name} registered at ${seed.founded}.` },
    { year: seed.founded + 1, kind: 'founding-crisis', summary: `Founding crisis: ${seed.foundingCrisis}.` },
  ]
  let splits = 0
  const splitYears = [seed.founded + 5, seed.founded + 9, seed.founded + 13]
  for (const year of splitYears) {
    if (year > 2026) break
    splits += 1
    const wing = wings[pickIndex(next, wings.length)]!
    const loser = pickName(next, pick(next, seed.baseZones), { femaleBp: 3000, titleBp: 1200 })
    const survivors = randInt(next, 3, 40)
    history.push({
      year,
      kind: 'split',
      summary: `${factionName(wing)} walked out over the register; ${survivors} ward chapters followed ${loser.family}.`,
    })
  }
  if (chanceBp(next, 3500)) {
    // a party can only win after it exists
    const victoryYear = Math.max(seed.founded + 4, 1999 + 4 * randInt(next, 1, 6))
    if (victoryYear <= 2026) {
      history.push({
        year: victoryYear,
        kind: 'victory',
        summary: `${seed.name} took the presidency at ${victoryYear} on a ${seed.symbol} ballot.`,
      })
    }
  }

  const chairmanZone = seed.baseZones[0]!
  const chairman = pickName(next, chairmanZone, { femaleBp: 2200, titleBp: 3200 })

  return {
    code: seed.code,
    name: seed.name,
    symbol: seed.symbol,
    colour: seed.colour,
    colourHex: seed.colourHex,
    founded: seed.founded,
    baseZones: seed.baseZones,
    godfatherToleranceBp: seed.godfatherToleranceBp,
    ideology: seed.ideology,
    factions,
    history: history.sort((a, b) => a.year - b.year),
    splits,
    chairmanId: `party/${seed.code}/chairman`,
    chairman,
  }
}

/** The eight fictional parties, with their internal politics generated for this seed. */
export function generateParties(seed: number): Party[] {
  return PARTY_SEEDS.map(s => buildParty(s, `party-${s.code}`, seed))
}

/** Party identity without the generated internals — for tests and reference listings. */
export const PARTY_IDENTITIES: readonly { code: string; name: string; colour: string; colourHex: string; symbol: string; founded: number }[] =
  PARTY_SEEDS.map(s => ({ code: s.code, name: s.name, colour: s.colour, colourHex: s.colourHex, symbol: s.symbol, founded: s.founded }))

export const PARTY_CODES: readonly string[] = PARTY_SEEDS.map(s => s.code)

/** Derived stream for party-side draws, kept off the game's named streams so adding a
    part never reshuffles elections, crises or the media. */
export function partyStream(seed: number, name: string): () => number {
  const h = subSeed(seed, name)
  return sfc32(h, hash32(name), (h ^ 0x5bf03635) >>> 0, (h + 0x9e3779b9) >>> 0)
}
