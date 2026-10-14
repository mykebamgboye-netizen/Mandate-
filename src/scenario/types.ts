/* MANDATE — the scenario layer.
   The desk must be whatever post the player took: nothing about the role, the seat, the
   chamber, the fund, the calendar or the names on the files is allowed to be pinned to one
   state or one office. content.ts keeps the analog world's document shapes, the money
   anchors and the formatting; this module turns a player's own record into the desk it
   produces — the tray, the decisions, the allies, the ledger and the mastheads.

   The algorithm is: profile → scenario (identity + geography + institutions + calendar +
   money, all derived) → pack (the week's documents, composed from the scenario). */

import type { Doc, Decision, Ally, AssetDoc, NoteDoc, LedgerRow } from '../content'
import type { Tier } from '../profile/types'

export type { Tier }

/** The player's own record, as first-open collected it. Serializable on purpose: it is kept
    in the local store so the desk still knows who you are when Supabase is out of reach. */
export interface ScenarioInput {
  name: string | null
  age: number | null
  pronouns: string | null
  /** federation_offices.id — 'federal/president', 'state/governor', 'fct/minister', 'local/chairman' */
  officeId: string
  tier: Tier
  post: string
  route: 'elected' | 'appointed'
  stateCode: string | null
  /** carried when known (first-open has the row in hand) so the desk needn't re-look it up */
  stateName?: string | null
  capital?: string | null
  lgaName: string | null
  partyCode: string | null
  partyName?: string | null
  termStart: string | null
}

/** The institutional vocabulary the files are written in. Every slot is filled from the
    scenario, so a council desk and a federal desk read differently without either being
    the "real" one. */
export interface Words {
  tier: Tier
  elected: boolean
  /** grand title on the record, e.g. 'Executive Governor of Delta State' */
  officeTitle: string
  seatNoun: string
  cabinet: string
  cabinetShort: string
  cabinetTrayLine: string
  cabinetAuthority: string
  cabinetAuthorityText: string
  chamber: string
  chamberShort: string
  whipHead: string
  whipAuthority: string
  whipAuthorityText: string
  whipHoldouts: string
  worksOfficer: string
  educationOfficer: string
  chiefOfStaff: string
  attorney: string
  policeHead: string
  securityHead: string
  securityFoot: string
  /** money */
  fundTitle: string
  allocation: string
  allocationFull: string
  appropriationAuthority: string
  /** labour and education */
  employer: string
  union: string
  unionPaper: string
  unionSignatory: string
  /** the street, the market, the stadium */
  market: string
  road: string
  rallyTown: string
  stadium: string
  station: string
  wardLabel: string
  /** the schedule of files: which seats of power the pack speaks of */
  topJob: string
  oppositionJob: string
  digestHead: string
  gazetteRole: string
  ticketTitle: string
  ticketSubHead: string
  ticketRows: [string, string, string, string, string][]
  ticketRedNote: string
  ticketAuthorityText: string
  termNote: string
  electionLine: string
  /** the one-line briefing the desk prints under the header */
  briefingLine: string
}

export interface Calendar {
  iso: string
  weekNumber: number
  year: number
  /** 'THURSDAY · 8 OCTOBER 2026' */
  dayLine: string
  /** 'EXCO WEEK 41 · ASABA' — cabinet short name, week number, seat */
  weekLine: string
  /** 'OCTOBER 2026' */
  monthLabel: string
  /** the month the files being read actually cover (the allocation month): 'SEPTEMBER' */
  prevMonth: string
  /** '6 OCT' — the day the union's letter was written, two days back */
  letterDate: string
  /** '10–13 OCT' — the NIMET rainfall peak, derived from the desk day */
  floodWindow: string
  /** '8 OCT 2026' */
  shortDate: string
  /** 'DECISIONS · 8 OCT 2026' */
  decisionsHead: string
  /** the stamped date under every stamp */
  stampDate: string
  deadlines: { label: string; date: string; iso: string }[]
  /** 'ASUU ultimatum 15 Oct · NLC window closes 20 Oct · FAAC drops 21 Oct' */
  deadlineLine: string
  /** 'WEEK 41 FILED ✓ — THE DESK IS CLEAN. INBOX REOPENS MONDAY.' */
  filedLine: string
  /** 'TIDYING THE DESK OVERNIGHT — WEEK 41 → FILED' */
  tickLine: string
}

export interface Money {
  /** multiplier applied to the state-scale anchors in content.ts */
  scale: number
  rows: LedgerRow[]
  opening: number
  closing: number
  pendingTotal: number
  afterSanction: number
  shortfall: number
  fundTitle: string
  fundSub: string
  authorityLine: string
  openingNote: string
}

export interface Term {
  /** 'FIRST TERM · 4 MONTHS IN · POLL 40 MONTHS AWAY' */
  line: string
  monthsInOffice: number
  monthsToPoll: number | null
  pollLabel: string | null
  note: string
}

export interface Scenario {
  input: ScenarioInput
  tier: Tier
  elected: boolean
  player: string
  shortName: string
  initials: string
  age: number | null
  post: string
  officeTitle: string
  partyCode: string | null
  partyName: string | null
  /** where */
  seat: string
  jurisdictionName: string
  jurisdictionShort: string
  stateName: string | null
  stateCode: string | null
  capital: string | null
  lgaName: string | null
  lgaCount: number | null
  zones: string[]
  towns: string[]
  country: string
  w: Words
  calendar: Calendar
  money: Money
  term: Term
}

/** One week's paper, as the scenario produces it. */
export interface Pack {
  scenario: Scenario
  docs: Doc[]
  assets: AssetDoc[]
  decisions: Decision[]
  allies: Ally[]
  handover: NoteDoc
  /** sector brief + tell pack — the two teaching files, localized to the same seat */
  extras: Doc[]
  /** the gazette figure and the road variation, at this seat's scale (the decisions read them) */
  award: number
  roadVariation: number
}
