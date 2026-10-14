/* MANDATE — the twelve sectors, and who actually holds each one.
   Politics is about winning; governance is about who can move which lever. The design's
   central claim is that a post decides what you control, what you are blamed for, and what
   you cannot touch at all — a Governor cannot direct the police or the naira, an LGA
   Chairman runs primary health care and market order with no money of his own, and the
   President is blamed for everything including the weather.

   Federal/state/local responsibility follows the Constitution's own division: the Exclusive
   Legislative List (police, defence, currency, oil and gas), the Concurrent List (education,
   health, agriculture, works), and the Fourth Schedule (the local functions).
   Real institutions, statutes and figures; the people and firms in play are fictional. */

import type { Tier } from './profile/types'

export const SECTOR_IDS = [
  'security',
  'economy_finance',
  'works',
  'health',
  'education',
  'agriculture',
  'oil_gas',
  'trade',
  'environment',
  'justice',
  'information',
  'traditional_religious',
] as const
export type SectorId = typeof SECTOR_IDS[number]

export interface Sector {
  id: SectorId
  label: string
  /** the sector in one line, for the reference sheet */
  line: string
  /** who is responsible for what inside it — the tier that actually holds the lever */
  federal: string
  state: string
  local: string
  /** a fact the sector is taught with, where the design gives one */
  note?: string
  /** the sector cannot be moved from a sub-national seat at all */
  federalOnly?: boolean
}

export const SECTORS: Record<SectorId, Sector> = {
  security: {
    id: 'security',
    label: 'Security',
    line: 'Police, army, vigilantes — and the violence the state answers for.',
    federal: 'The Nigeria Police Force (s.214), the armed forces, the DSS. Policing is exclusive to the Federation.',
    state: 'Chief security officer by convention, not by command: you may ask, fund and coordinate — not deploy. Governors fund vigilante outfits because they cannot order a Commissioner of Police.',
    local: 'A divisional police station and whatever vigilante or hunters’ group the council can pay.',
    note: 'Boko Haram in the North-East, banditry and mass abductions in the North-West, and the IPOB sit-at-home in the South-East (since 9 August 2021) are federal files that land on a sub-national desk anyway.',
    federalOnly: true,
  },
  economy_finance: {
    id: 'economy_finance',
    label: 'Economy & Finance',
    line: 'FAAC, IGR, subsidy, the naira — and who gets blamed for prices.',
    federal: 'The Federation Account (s.162), monetary policy and the naira, fuel subsidy, borrowing. All exclusive.',
    state: 'The FAAC share, internally generated revenue, the wage bill, and whatever the Joint Account leaves the councils.',
    local: 'Rates, market levies, and a share of the Joint Account that a state can delay.',
    note: 'Two shocks are canon. Brent sat at $111.80 in June 2014 and $30.70 in January 2016 (EIA monthly averages); the recession that followed was −1.51% for 2016 on NBS’s contemporaneous estimate, with December inflation at 18.55% y/y. On 29 May 2023 the subsidy was removed by announcement, and pump prices moved from an administered ₦185 to roughly ₦488–₦577 within days — the ₦850+ band is later, 2024, not the first move.',
  },
  works: {
    id: 'works',
    label: 'Works & Infrastructure',
    line: 'Roads are the most visible thing any government does.',
    federal: 'Trunk highways and rail, much of it on external credit.',
    state: 'State roads — the file every Governor is judged on.',
    local: 'Feeder roads: the ones the market actually uses.',
    note: 'Contract variation orders are where road money is quietly spent, and the certified variation is a paper trail in itself.',
  },
  health: {
    id: 'health',
    label: 'Health',
    line: 'Primary, secondary, tertiary — one system read at three tiers.',
    federal: 'Tertiary care: teaching hospitals and federal medical centres.',
    state: 'Secondary care: general hospitals and the state’s drugs bill.',
    local: 'Primary health care: the dispensaries and the ward clinics.',
    note: 'The tier that funds a clinic is not always the tier that is blamed when it has no drugs.',
  },
  education: {
    id: 'education',
    label: 'Education',
    line: 'Basic education is a local function; the strikes are national.',
    federal: 'Universities and federal colleges — and the strikes that close them.',
    state: 'Secondary schools, and the teachers on the state payroll.',
    local: 'Primary schools, and the teachers the council can actually pay.',
    note: 'ASUU shut the federal universities from 14 February to 14 October 2022 — eight months. A state’s own schools may be open the whole time while every parent blames whoever is nearest.',
  },
  agriculture: {
    id: 'agriculture',
    label: 'Agriculture',
    line: 'Land, fertiliser, extension — and the farmer–herder file.',
    federal: 'Land use policy, fertiliser supply and the security dimension of open grazing.',
    state: 'Agricultural development programmes, land allocation and grazing reserves.',
    local: 'Markets, abattoirs, and the ward-level disputes that become national news.',
    note: 'Farmer–herder conflict is a land question wearing a security coat: it is settled locally and funded federally.',
  },
  oil_gas: {
    id: 'oil_gas',
    label: 'Oil & Gas',
    line: 'The 13% derivation, and everything downstream of it.',
    federal: 'The resource itself, licences, NNPC, and the Federation Account it feeds.',
    state: 'The 13% derivation if you are an oil-mineral state — a first-line charge on the resource revenue, not a share of the vertical formula.',
    local: 'Environmental damage, pipelines and the spillage files a council inherits.',
    note: 'Derivation makes an oil state richer and less predictable at once: it rides the same price the naira does.',
    federalOnly: true,
  },
  trade: {
    id: 'trade',
    label: 'Trade & Markets',
    line: 'The informal economy runs the street, and it has its own governments.',
    federal: 'Company and commodity regulation, import policy, and the border.',
    state: 'Market development, licensing, and the price of transport.',
    local: 'Market associations, okada and keke unions, stall tickets and the daily levy.',
    note: 'A market association can close a market for a day. A council chairman can only negotiate.',
  },
  environment: {
    id: 'environment',
    label: 'Environment & Climate',
    line: 'Floods and desertification — the sector the federation is asked to solve locally.',
    federal: 'NIMET, NEMA, ecological funds, and the dams that decide who floods.',
    state: 'Drainage, flood response, and the resettlement the state must fund.',
    local: 'Waste, gutters, and the ward that floods first.',
    note: 'The 2022 floods killed over 600 and displaced an estimated 1.3–1.4 million (UNICEF/OCHA, October 2022). NEMA’s retrospective count for 2024 was 1,237 dead and 1,243,638 displaced.',
  },
  justice: {
    id: 'justice',
    label: 'Justice & Anti-corruption',
    line: 'Tribunals, EFCC and ICPC — the sector that can end you.',
    federal: 'Federal courts, EFCC and ICPC, and election petitions that run to the Court of Appeal.',
    state: 'State courts, the Attorney-General, and the state’s own prosecution.',
    local: 'Customary courts and the council’s solicitor.',
    note: 'A petition can join you as a respondent for money you spent on someone else’s campaign.',
  },
  information: {
    id: 'information',
    label: 'Information & Media',
    line: 'Press tone, influencers, and the 2023 deepfakes.',
    federal: 'Broadcast licensing, national media, and the state’s own narrative.',
    state: 'The state broadcaster, press releases, and the tone of the local press.',
    local: 'Ward rumour, radio phone-ins, and the market’s version of events.',
    note: 'Deepfakes in the 2023 cycle and foreign influence operations in 2024 made the cheapest lever the least controllable one.',
  },
  traditional_religious: {
    id: 'traditional_religious',
    label: 'Traditional & Religious',
    line: 'Emirs, obas, and the pulpits — the oldest institutions on the desk.',
    federal: 'Engagement and protocol; no formal power over either.',
    state: 'Emirate and oba councils, and the religious bodies that can swing a ward.',
    local: 'The ward head, the market overseers, and the parish or mosque leadership.',
    note: 'The design’s own rule of thumb: a decisive traditional or religious intervention moves 5–10% of a vote, and no government lasts long against a pulpit.',
  },
}

/** What a post holds, and what it cannot. */
export interface SectorClaim {
  sector: SectorId
  /** the part of the sector this post actually runs, when the sector is split across tiers */
  scope?: string
}

export interface PostSectors {
  officeId: string
  /** levers the post actually holds */
  controls: SectorClaim[]
  /** sectors the post is held responsible for whether it holds them or not */
  blamedFor: SectorClaim[]
  /** levers that exist, matter, and cannot be pulled from this seat */
  cannotControl: SectorClaim[]
}

export const POST_SECTOR_MATRIX: Record<string, PostSectors> = {
  'federal/president': {
    officeId: 'federal/president',
    controls: [
      { sector: 'security' },
      { sector: 'economy_finance' },
      { sector: 'oil_gas' },
      { sector: 'information' },
    ],
    blamedFor: [{ sector: 'security', scope: 'all of it — everything is the President’s file' }],
    cannotControl: [],
  },
  'state/governor': {
    officeId: 'state/governor',
    controls: [
      { sector: 'works', scope: 'state roads' },
      { sector: 'health', scope: 'secondary' },
      { sector: 'education', scope: 'secondary' },
      { sector: 'agriculture' },
    ],
    blamedFor: [
      { sector: 'security', scope: 'violence you cannot order anyone to stop' },
      { sector: 'economy_finance', scope: 'prices and arrears you did not set' },
    ],
    cannotControl: [
      { sector: 'security', scope: 'the police — the CP answers to the IG, not to you' },
      { sector: 'economy_finance', scope: 'the naira and the oil price' },
    ],
  },
  'fct/minister': {
    officeId: 'fct/minister',
    controls: [
      { sector: 'works', scope: 'the territory’s roads and drainage' },
      { sector: 'environment', scope: 'Abuja land use, demolition and resettlement (s.297 land; s.302 appointment)' },
    ],
    blamedFor: [
      { sector: 'environment', scope: 'Abuja demolitions — with no elected mandate to defend them' },
    ],
    cannotControl: [
      { sector: 'economy_finance', scope: 'your own tenure: the President can sack you at will' },
    ],
  },
  'local/chairman': {
    officeId: 'local/chairman',
    controls: [
      { sector: 'health', scope: 'primary' },
      { sector: 'education', scope: 'primary' },
      { sector: 'trade', scope: 'markets, levies and the unions' },
      { sector: 'environment', scope: 'waste and drainage' },
    ],
    blamedFor: [
      { sector: 'environment', scope: 'flooding the state and NEMA are supposed to fund' },
      { sector: 'trade', scope: 'market prices you never set' },
    ],
    cannotControl: [
      { sector: 'economy_finance', scope: 'your allocation: it arrives through the state, on the state’s timing' },
      { sector: 'security', scope: 'any deployment at all' },
    ],
  },
}

export function matrixFor(officeId: string): PostSectors | null {
  return POST_SECTOR_MATRIX[officeId] ?? null
}

/** The sector a file belongs to, so the desk can say who holds it. */
export function sectorLabel(id: SectorId): string {
  return SECTORS[id]?.label ?? id
}

/** The tier a seat sits at, read off its office id ('state/governor' → 'state'). */
export function tierFromOfficeId(officeId: string): Tier {
  const prefix = officeId.split('/')[0]
  return prefix === 'federal' || prefix === 'state' || prefix === 'fct' || prefix === 'local' ? prefix : 'federal'
}

/**
 * The one-page brief on the post: what it holds, what it is blamed for, and what it may not
 * touch. Written for the desk in the second person, because that is what the player reads.
 */
export function postSectorBrief(officeId: string): string[] {
  const m = matrixFor(officeId)
  if (!m) return []
  const tier = tierFromOfficeId(officeId)
  // the territory is administered like a state, so the 'fct' tier reads the state's line
  const own = (id: SectorId) => SECTORS[id][tier === 'fct' ? 'state' : tier]
  const scope = (c: SectorClaim) => (c.scope ? `${sectorLabel(c.sector)} — ${c.scope}` : sectorLabel(c.sector))
  const lines: string[] = [
    `YOU HOLD — ${m.controls.map(scope).join(' · ')}.`,
  ]
  for (const c of m.controls) lines.push(`• ${sectorLabel(c.sector)}: ${own(c.sector)}`)
  if (m.blamedFor.length) lines.push(`BLAMED FOR — ${m.blamedFor.map(scope).join(' · ')}.`)
  if (m.cannotControl.length) {
    lines.push(`CANNOT TOUCH — ${m.cannotControl.map(scope).join(' · ')}.`)
    for (const c of m.cannotControl) lines.push(`• ${sectorLabel(c.sector)}: ${c.scope ?? own(c.sector)}`)
  }
  return lines
}
