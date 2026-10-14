/* MANDATE — where the money comes from, and what the seat is allowed to do with it.
   Every figure below is checked against the statute or the published series, and the ones
   the design asserts that could NOT be verified are tagged `verify` rather than printed as
   fact — the game teaches this material, so it must not teach a number nobody can source. */

/** The vertical allocation of the Federation Account: FG / States / LGs. Sums to 100%. */
export const FAAC_VERTICAL = {
  federal: 52.68,
  states: 26.72,
  local: 20.60,
  /**
   * [verify] The operational split in use since 2004 (via the 2002 executive-order sequence
   * after the resource-control decision). Its exact instrument and date are not conclusively
   * documented, and it is NOT written into the Constitution — do not present it as
   * constitutional text. VAT is distributed on its own formula.
   */
  verify: true,
}

/** 13% derivation — a first-line charge on natural-resource revenue, not a share of the
    vertical formula (Allocation of Revenue Act s.1; Constitution s.162(2)). */
export const DERIVATION = {
  pct: 13,
  prior: true as const,
  line: 'Taken off qualifying natural-resource revenue before the vertical formula runs — not 13% of every Federation Account stream.',
}

/** The FCT’s 1% is an earmark inside the federal side; the three vertical shares already
    total 100%, so it is never added on top of them. */
export const FCT_EARMARK = {
  pct: 1,
  line: 'An earmark within the federal allocation, not a fourth tier — 52.68 + 26.72 + 20.60 is already 100%.',
}

/** The Supreme Court’s local-government financial autonomy judgment. */
export const LG_AUTONOMY = {
  date: '2024-07-11',
  line: 'Allocations to be paid to councils directly; a state cannot retain, control or disburse them, and caretaker committees cannot stand in for elected councils.',
}

/** What each seat may do with what it receives. */
export interface OfficeRevenue {
  officeId: string
  /** headline share of the Federation Account, if the seat has one */
  share?: { pct: number; of: 'federation account' | 'federal side (earmark)' }
  lines: string[]
  cites: string[]
  /** figures the design asserts that could not be verified */
  verify?: string[]
}

export const OFFICE_REVENUE: Record<string, OfficeRevenue> = {
  'federal/president': {
    officeId: 'federal/president',
    share: { pct: FAAC_VERTICAL.federal, of: 'federation account' },
    lines: [
      '4-year term, maximum two — s.135(2).',
      'You may not spend what the National Assembly has not appropriated: s.80.',
      'The budget is laid by you and passed by them: s.81(1).',
      'Commander-in-Chief by convention; the police and the armed forces are yours to order.',
      'Impeachment runs through s.143, and it is a political count, not a court.',
    ],
    cites: ['s.135(2)', 's.80', 's.81(1)', 's.143', 's.162'],
    verify: [
      'The design’s debt figures (World Bank ~$17.32bn, China ~$5.06bn as at December 2025) could not be confirmed against the DMO’s December 2025 external-debt stock — treat them as the brief’s numbers, not sourced ones.',
    ],
  },
  'state/governor': {
    officeId: 'state/governor',
    share: { pct: FAAC_VERTICAL.states, of: 'federation account' },
    lines: [
      '4-year term, maximum two — s.180(2).',
      'The state budget is yours to lay and theirs to pass: s.121(1).',
      'Derivation at 13% if the state is oil-mineral — and it moves with the price.',
      'You cannot direct the Commissioner of Police: the Force is federal and answers to the Inspector-General (s.214).',
      'The Joint Account is where a council’s money waits on your signature.',
    ],
    cites: ['s.180(2)', 's.121(1)', 's.162(2)', 's.214'],
    verify: [
      '“More than 90% FAAC dependence in 32 states” is the brief’s figure; the direction is right and the exact count is not sourced here.',
    ],
  },
  'fct/minister': {
    officeId: 'fct/minister',
    share: { pct: FCT_EARMARK.pct, of: 'federal side (earmark)' },
    lines: [
      'Appointed by the President — s.302 — and removable by him without a vote.',
      'Land administration in the territory is yours: s.297.',
      'No elected mandate: what you decide, you defend alone.',
      'The FCTA appropriation passes through the National Assembly with the federal budget.',
    ],
    cites: ['s.302', 's.297', 's.299'],
    verify: [
      'The brief’s “₦432.13bn over 2023–26” for the FCTA could not be sourced here — treat it as the brief’s figure.',
    ],
  },
  'local/chairman': {
    officeId: 'local/chairman',
    share: { pct: FAAC_VERTICAL.local, of: 'federation account' },
    lines: [
      'elected, by constitutional guarantee — s.7(1); no caretaker committee can replace you.',
      'Since the Supreme Court’s judgment of 11 July 2024 the allocation is paid to the council directly.',
      'Direct payment is not the same as prompt payment: timing still runs through the state.',
      'Primary health care, primary schools, markets and waste are the Fourth Schedule’s own list.',
    ],
    cites: ['s.7(1)', 's.162(6)', 'Fourth Schedule', 'SC/2024 (11 July 2024)'],
  },
}

export function revenueFor(officeId: string): OfficeRevenue | null {
  return OFFICE_REVENUE[officeId] ?? null
}

/** The seat's revenue page: the share, what it may do with it, the sections, and the
    figures that could not be sourced. */
export function revenueBrief(officeId: string): string[] {
  const r = revenueFor(officeId)
  if (!r) return []
  const lines: string[] = []
  if (r.share) lines.push(`SHARE — ${r.share.pct}% of the ${r.share.of}.`)
  for (const l of r.lines) lines.push(`• ${l}`)
  lines.push(`CITES — ${r.cites.join(' · ')}.`)
  for (const v of r.verify ?? []) lines.push(`[verify] ${v}`)
  return lines
}

/** The vertical formula as the desk prints it. */
export function verticalFormulaLine(): string {
  return `FG ${FAAC_VERTICAL.federal}% · STATES ${FAAC_VERTICAL.states}% · LGA ${FAAC_VERTICAL.local}%${FAAC_VERTICAL.verify ? ' [verify]' : ''}`
}
