/* MANDATE — the money of each desk.
   content.ts holds the analog world's anchors at state scale (Week 41, October 2026). A
   council does not hold a state's treasury and the Federation does not hold a state's FAAC
   net, so the ledger is SCALED by a factor derived from the anchors themselves — never a
   typed-in number — and every row's arithmetic is recomputed from the scaled rows:

     opening + Σ(non-pending rows except the variance) = closing
     closing − Σ(pending) = closing after sanction

   Two invariants survive any uniform scale (that is why it is the right transform): the
   opening balance stays about one week of payroll, and the shortfall stays the same share
   of the inflow, because both are ratios of scaled figures. */

import {
  OPENING_BALANCE, OPENING_NOTE,
  FAAC_FEDERAL, FAAC_STATES, FAAC_LGPS, FAAC_NET,
  TEACHERS_PAYROLL, PENSION_PAYROLL, OTHER_CS, HEALTH_PARAST, GRATUITY_FLOW, DEBT_SERVICE,
  COUNCIL_TRANSFER, OVERHEADS_SUBV, CONTRACTOR_VAR, CAPITAL_WIP,
  IGR_SEP, FEDERATION_REFUND,
  OKPE_VAR, NLC_TRANCH1, SAPELE_AWARD_NAIRA, SHORTFILL_NAIRA,
  type LedgerRow,
} from '../content'
import { PLACES } from './places'
import type { Tier } from '../profile/types'

/** The Federation's 774 local government areas — the divisor behind the third tier's share. */
export const LGA_TOTAL = 774

/** How many council areas the anchor ledger was written for (Delta's 25). */
const ANCHOR_COUNCILS = PLACES.DT.councils

/** Tier factor, derived:
    - state    : 1 — the anchors ARE a state treasury
    - federal  : the Federal Government's published share over this state's FAAC net
    - fct      : an average state's share (FAAC states pool ÷ 36), which is how the territory
                 is funded — not part of the LGA pool, not a state
    - local    : one council's share of the local-government pool (÷ 774) */
export function scaleFor(tier: Tier): number {
  if (tier === 'federal') return FAAC_FEDERAL / FAAC_NET
  if (tier === 'fct') return (FAAC_STATES / 36) / FAAC_NET
  if (tier === 'local') return (FAAC_LGPS / LGA_TOTAL) / FAAC_NET
  return 1
}

/** The anchor payroll's headcount (the world's Week 41 figure). */
export const PAYROLL_ANCHOR_STAFF = 14_612

/** Payroll headcount at any seat, derived on a council-proportional basis from the anchor. */
export function payrollStaff(councils: number): number {
  return Math.round(PAYROLL_ANCHOR_STAFF * councils / ANCHOR_COUNCILS)
}

export interface MoneyWords {
  stateName: string | null
  seat: string
  lgaName: string | null
  councils: number
  allocation: string
  allocationFull: string
  fundTitle: string
  appropriationAuthority: string
  tier: Tier
}

/** Payroll headcount, derived from the anchor's 14,612 on a council-proportional basis. */
export function staffCount(w: MoneyWords): number {
  return payrollStaff(w.councils)
}

interface RowSpec {
  date: string
  memo: (w: MoneyWords) => string
  amount: number
  pending?: boolean
  variance?: boolean
}

const inflowLabel = (w: MoneyWords) =>
  w.tier === 'federal'
    ? 'Federation Account — Federal Government share, September'
    : w.tier === 'fct'
      ? 'FCTA statutory allocation, September'
      : w.tier === 'local'
        ? 'Joint account allocation, September (JAAC)'
        : `${w.allocationFull}, September — the shortfall month`

/** The ten committed lines, the three inflows, the three pending sanctions and the variance
    — one spec, every tier, with only the wording of the money's source changing. */
const ROWS: RowSpec[] = [
  { date: '01 Oct', memo: inflowLabel, amount: FAAC_NET },
  { date: '02 Oct', memo: w => `Teachers payroll, September — GL 07-15 (${staffCount(w).toLocaleString('en-NG')} staff)`, amount: -TEACHERS_PAYROLL },
  { date: '02 Oct', memo: () => 'Pension payroll — September', amount: -PENSION_PAYROLL },
  { date: '03 Oct', memo: () => 'Other civil service — September', amount: -OTHER_CS },
  { date: '03 Oct', memo: () => 'Health and parastatals — September', amount: -HEALTH_PARAST },
  { date: '04 Oct', memo: () => 'Gratuity flow — monthly schedule', amount: -GRATUITY_FLOW },
  { date: '04 Oct', memo: () => 'Debt service — bond and facility', amount: -DEBT_SERVICE },
  {
    date: '04 Oct',
    memo: w => w.tier === 'local'
      ? 'Transfer to the state joint account (remittance)'
      : w.tier === 'federal'
        ? 'Statutory transfers to the 36 states and the FCT'
        : `${w.stateName ?? 'State'}-funded council line (~10% of IGR)`,
    amount: -COUNCIL_TRANSFER,
  },
  { date: '05 Oct', memo: () => 'Overheads and subventions — September', amount: -OVERHEADS_SUBV },
  { date: '05 Oct', memo: () => 'IGR — September', amount: IGR_SEP },
  { date: '05 Oct', memo: () => 'Contractor variation orders, certified', amount: -CONTRACTOR_VAR },
  { date: '06 Oct', memo: () => 'Capital works in progress, certified (equipment folded in)', amount: -CAPITAL_WIP },
  {
    date: '07 Oct',
    memo: w => w.tier === 'federal'
      ? 'Federation refund — excess deductions recovered, payroll balancing'
      : 'Federation refund — excess deductions recovered, payroll balancing',
    amount: FEDERATION_REFUND,
  },
  {
    date: '06 Oct',
    memo: w => w.tier === 'local' ? 'Road variation W2 — awaiting sanction' : 'Road variation W2 — the trunk road (awaiting sanction)',
    amount: -OKPE_VAR, pending: true,
  },
  { date: '07 Oct', memo: () => 'Arrears tranche 1 — window closes this month', amount: -NLC_TRANCH1, pending: true },
  {
    date: '08 Oct',
    memo: w => `${w.tier === 'local' ? `${w.lgaName ?? 'Council'} Market` : 'Market renovation'} — Gazette 147`,
    amount: -SAPELE_AWARD_NAIRA, pending: true,
  },
  {
    // A variance, not a movement: the gap between what was projected and what landed.
    // Counting it as cash would double-charge the shortfall, so the running balance skips it.
    date: '08 Oct', memo: () => 'Revenue shortfall against October projection',
    amount: -SHORTFILL_NAIRA, variance: true,
  },
]

export interface MoneyState {
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

export function moneyFor(w: MoneyWords): MoneyState {
  const scale = scaleFor(w.tier)
  const round = (n: number) => Math.round(n * scale)
  const rows: LedgerRow[] = ROWS.map(r => ({
    date: r.date,
    memo: r.memo(w),
    amount: round(r.amount),
    pending: r.pending,
    variance: r.variance,
  }))
  const opening = round(OPENING_BALANCE)
  const closing = rows.reduce(
    (sum, r) => (r.variance || r.pending ? sum : sum + (r.amount ?? 0)),
    opening,
  )
  const pendingTotal = rows.reduce((sum, r) => (r.pending ? sum + Math.abs(r.amount ?? 0) : sum), 0)
  return {
    scale,
    rows,
    opening,
    closing,
    pendingTotal,
    afterSanction: closing - pendingTotal,
    shortfall: round(SHORTFILL_NAIRA),
    fundTitle: w.fundTitle,
    fundSub: 'ALL FIGURES TO THE NAIRA',
    authorityLine: w.appropriationAuthority,
    openingNote: OPENING_NOTE,
  }
}
