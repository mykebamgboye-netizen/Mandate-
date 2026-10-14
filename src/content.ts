/* MANDATE — content inventory: the sample week, Thursday 8 October 2026.
   Analog world (Section 32): people, parties, papers and firms are fictional.
   Places, statutes, institutions and sections are real. */

export type Stock = 'lined' | 'memo' | 'newsprint' | 'ledger' | 'form' | 'letterhead' | 'pad' | 'photo'
export type Clip = 'binder' | 'paperclip' | 'none'
export type Mark = 'urgent' | 'opened' | 'forwarded' | 'fresh'

export interface BaseDoc {
  id: string
  title: string
  trayLine: string
  stock: Stock
  clip: Clip
  stain: 'coffee' | 'ring' | 'spatter' | 'none'
  mark: Mark
  date: string
  authority: string
  authorityText: string
  recordId: string
  audit: string[]
}

export interface MinutesDoc extends BaseDoc {
  kind: 'minutes'
  head: string[]
  items: { n: number; text: string }[]
  sketch: boolean
}
export interface GazetteDoc extends BaseDoc {
  kind: 'gazette'
  fedHead: string
  gazetteLine: string
  memoDate: string
  memorandum: string
  appropriation: string
  authorityPara: string
  faacLine: string
  note: string
  footer: string
  signName: string
  role: string
}
export interface FaacDoc extends BaseDoc {
  kind: 'faac'
  docHead: string
  lines: { label: string; value: string; indent?: boolean; rule?: boolean; strong?: boolean }[]
  foot: string
}
export interface WhipDoc extends BaseDoc {
  kind: 'whip'
  docHead: string
  counts: { label: string; value: string }[]
  bullets: string[]
  foot: string
}
export interface TableDoc extends BaseDoc {
  kind: 'table'
  docHead: string
  subHead: string
  columns: string[]
  rows: string[][]
  checkRow: number
  circleCol: number
  redNote: string
}
export interface SecurityDoc extends BaseDoc {
  kind: 'security'
  docHead: string
  items: { head: string; body: string }[]
  foot: string
}
export interface LetterDoc extends BaseDoc {
  kind: 'letter'
  letterhead: string
  to: string
  subject: string
  paras: string[]
  signName: string
  signTitle: string
  dateLine: string
}
export interface DossierDoc extends BaseDoc {
  kind: 'dossier'
  subject: string
  lines: { label: string; value: string; pencil?: boolean }[]
  whispers: string[]
  margin: string
}
export interface AssetDoc extends BaseDoc {
  kind: 'asset'
  formHead: string
  fields: { label: string; value: string }[]
  ranges: { label: string; lo: number; hi: number; src: string }[]
  margin: string
}
export interface TribunalDoc extends BaseDoc {
  kind: 'tribunal'
  docHead: string
  caseNo: string
  parties: { role: string; name: string }[]
  grounds: string[]
  relief: string
  listing: string
  stampText: string
}
export interface ClippingDoc extends BaseDoc {
  kind: 'clipping'
  outlet: string
  kicker: string
  headline: string
  byline: string
  paras: string[]
  briefs: string[]
}
export interface LeafletDoc extends BaseDoc {
  kind: 'leaflet'
  party: string
  colorA: string
  colorB: string
  event: string
  when: string
  where: string
  lines: string[]
  smear: string
}
export interface NoteDoc extends BaseDoc {
  kind: 'note'
  from: string
  re: string
  lines: string[]
}

export interface SectorDoc extends BaseDoc {
  kind: 'sector'
  docHead: string
  event: string
  desks: { id: string; label: string; sub: string; lines: string[] }[]
  glossary: Record<string, { gloss: string; misread: string; fine?: string }>
  chain: { step: string; lag: string; detail: string; minLiteracy: number }[]
}
export interface TellLine { id: string; text: string; tell?: boolean }
export interface TellDoc extends BaseDoc {
  kind: 'tell'
  docHead: string
  brief: string
  files: { name: string; lines: TellLine[] }[]
  hitNote: string
  missNote: string
}

export type Doc =
  | MinutesDoc | GazetteDoc | FaacDoc | WhipDoc | TableDoc | SecurityDoc
  | LetterDoc | DossierDoc | AssetDoc | TribunalDoc | ClippingDoc | LeafletDoc | NoteDoc
  | SectorDoc | TellDoc

export interface DecisionOption {
  key: string
  label: string
  /** the consequence line printed under the option, as on the memo */
  sub: string
  ledger: string
  marg: string
  /** §26.2 hold-to-commit: 1 routine · 2 policy · 3 career-ending */
  level: 1 | 2 | 3
}
export interface Decision {
  id: string
  docId: string
  question: string
  hours: number
  /** red handwritten line at the head of the card — nothing buried at the foot */
  deadline?: string
  options: DecisionOption[]
  special?: 'gazette'
}
export interface Ally {
  id: string
  name: string
  office: string
  zone: string
  initials: string
  whisper: string
  badge: 'LOYAL' | 'NEGOTIABLE' | 'LEVERAGE'
  trust: number // out of 3
}
export interface LedgerRow {
  date: string
  memo: string
  amount: number
  /** not yet sanctioned — excluded from the running balance until it is charged */
  pending?: boolean
  /** a variance against projection, not a cash movement — never in the running balance */
  variance?: boolean
}
// ============================================================================
// LEDGER ANCHORS — October 2026, Delta State Treasury (Week 41)
// All figures below are derived in /tmp/derive_final2.py from the fixed anchors
// in the brief and are reproduced here verbatim. Nothing here is hand-computed.
//
// DEFINITIONS (used by the test suite and the Budget screen):
//  - Committed = the ten non-pending posted lines. Pending is never in committed
//    and never in closing. (Okpe, NLC tranche 1, Sapele are pending.)
//  - Hard commitments = ALL personnel (Teachers + Pension payroll + Other civil
//    service + Health and parastatals = 14,604,458,824) + gratuity flow + debt service
//    = 24,564,458,830. Not just four lines.
//  - Personnel run-rate MRUN = 14,604,458,824 = TEACHERS + PENSION + OTHER_CS + HEALTH.
//  - Baseline = FAAC net + IGR = 53,336,495,820 (the two recurring inflows; REF is a
//    one-off and is excluded from ratios per the brief).
//  - Opening weeks = OPEN / (MRUN / 30) / 7              -> 1.1253 wks
//  - Cover on closing = CLOSING * 30 / MRUN              -> 17.0000 days
//  - Cover if sanctioned = (CLOSING - PENDING) * 30 / MRUN -> 12.7500 days
//    (sanctioning reduces cash; pending is never added back)
//  - Shortfall = 214,371,000, which is 0.4931% of FAAC net
//    (rounding to 0.49% at two dp); projection = FAAC net + shortfall =
//    43,689,591,940. NOTE: the brief's headline "4.93% of net" is internally
//    inconsistent with shortfall=214,371,000 and net=43,475,220,940; the arithmetic
//    is unambiguous, so the tests assert the real 0.4931%.
//    If you want the headline text to say 4.93%, that is a display choice only and
//    does not change FAAC_NET or SHORTFILL_NAIRA.
//  - Closing = sum of every signed posted row: inflows and one-offs positive,
//    committed negative, pending EXCLUDED. Asserted equal to 8,275,860,000.
//
// NOTE ON THE VAT POOL: the ₦773bn VAT pool is part of the ₦2.338 trillion gross
// distributed (statutory ≈ ₦1.565T plus VAT ≈ ₦773bn). It is NOT a separate pool.
// The communiqué line has been relabelled accordingly and the old "separate pool"
// note has been removed.
//
// NOTE ON PAYROLL LINES: the September teachers line is labelled "Teachers payroll,
// September, GL 07-15 (14,612 staff)" with amount 2,571,712,000. It is the monthly
// payroll, NOT arrears. The words "three months" and "arrears" are removed from the
// ledger line. Arrears live only in the arrears stock
// (=5,038,643,300, = Teachers + Pension), which is distinct from the ledger
// commitments and is referenced in the NLC letter and the minutes item 3.
//
// NOTE ON LGA TRANSMISSION: the ₦7.3bn LGA transmission line has been replaced by a
// state-funded council line of 986,127,491 (~10% of IGR), flagged [verify]. Statutory
// FAAC council shares run through the Joint Account and are not in the state treasury.
// ============================================================================

export const FAAC_GROSS_DISTRIBUTED = 2_338_000_000_000
export const FAAC_FEDERAL        = 805_000_000_000
export const FAAC_STATES         = 794_000_000_000
export const FAAC_LGPS           = 555_000_000_000
export const FAAC_DERIV_NATIONAL = 184_000_000_000
export const FAAC_VAT_POOL       = 773_000_000_000 // part of the 2.338T, not a separate pool

export const FAAC_STAT_DELTA     = 12_812_345_679
export const FAAC_VAT_DELTA      = 11_799_995_679
export const FAAC_DERIV_DELTA    = 21_500_056_789
export const FAAC_GROSS_DELTA    = 46_112_398_147   // stat + VAT + deriv
export const FAAC_DEDUCTIONS     = 2_637_177_207     // loan & bailout repayments at source
export const FAAC_NET            = 43_475_220_940      // gross - deductions; inflow to ledger

export const OPENING_BALANCE     = 3_834_790_251
export const OPENING_NOTE        = 'ABOUT ONE WEEK OF PAYROLL — NOT SIX'

export const IGR_SEP            = 9_861_274_880
export const FEDERATION_REFUND = 1_240_880_000   // one-off; memo: Federation refund, excess deductions recovered, payroll balancing [verify]

export const TEACHERS_PAYROLL   = 2_571_712_000  // Teachers payroll, September, GL 07-15 (14,612 staff) — monthly, not arrears
export const PENSION_PAYROLL    = 2_466_931_300 // monthly pension payroll [verify]
export const OTHER_CS          = 6_700_000_003
export const HEALTH_PARAST     = 2_865_815_521
export const GRATUITY_FLOW     = 1_900_000_003
export const DEBT_SERVICE      = 8_060_000_003
export const COUNCIL_TRANSFER  = 986_127_491 // state-funded LGA council line, ~10% of IGR [verify]
export const OVERHEADS_SUBV    = 8_000_000_003
export const CONTRACTOR_VAR    = 8_292_859_873    // contractor variation orders, certified
export const CAPITAL_WIP       = 8_292_859_874    // capital works in progress, certified (equipment folded in)

export const OKPE_VAR       = 1_377_540_000  // pending — Okpe Road W2
export const NLC_TRANCH1    = 606_725_000 // pending — NLC arrears tranche 1
export const SAPELE_AWARD_NAIRA = 84_700_000  // pending — Gazette 147, Sapele Market

export const SHORTFILL_NAIRA = 214_371_000

export const NLC_SUM_OUTSTANDING = 1_213_450_000  // NLC letter: 14,612 workers, 14 councils + state
export const ARREARS_STOCK       = 5_038_643_300 // = TEACHERS + PENSION; 3 months owed; distinct from monthly payroll

export const PENDING_TOTAL = 2_068_965_000
export const BUDGET_CLOSING = 8_275_860_000  // = OPENING_BALANCE + FAAC_NET + IGR_SEP + FEDERATION_REFUND - (sum of the ten committed lines)
export const CLOSING_AFTER_SANCTION = 6_206_895_000 // = BUDGET_CLOSING - PENDING_TOTAL

export const MRUN = 14_604_458_824   // personnel run-rate = TEACHERS + PENSION_PAYROLL + OTHER_CS + HEALTH_PARAST
export const HARD_COMMITMENTS = 24_564_458_830 // = MRUN + GRATUITY_FLOW + DEBT_SERVICE
export const BASELINE = 53_336_495_820 // = FAAC_NET + IGR_SEP

export const PROJECTION_FROM_NET = 43_689_591_940 // = FAAC_NET + SHORTFILL_NAIRA

// FAAC communiqué display values (national pool as published; Delta split derived,
// varied on the last digits — none is a multiple of 10,000,000).
export const FAAC_NET_DERIVE_CHECK = 43_475_220_940 // == FAAC_NET by construction
export const FAAC_OCT_PROJECTION = 43_689_591_940 // = FAAC_NET + SHORTFILL_NAIRA

export function formatNaira(n: number): string {
  const neg = n < 0
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '–' : '') + '₦' + s
}

export function nairaDisplay(n: number): string {
  // plain number with commas and a leading minus for negatives; no currency glyph, for inline UI sentences
  return formatNaira(n).replace(/^₦/, '')
}

export const ABUJA_SCENARIO = {
  id: 'abuja',
  title: 'Abuja Scenario — the substitution',
  line: 'LOCKED — unlocks after one successful term',
  detail: 'Who the party sends to Abuja in 2027, and whether your zone is owed the slot. Not on this desk yet.',
}

/* Question 1 — first term, eighteen months in, 2027 general election 15 months out. */