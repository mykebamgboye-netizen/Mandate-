/* MANDATE — the pressure model.
   A desk is not a to-do list; it is a queue of things done to you. Five external shocks a
   quarter, of five kinds, and the office decides which of them you can answer and which of
   them you can only be blamed for.

   The shocks below are real events with their real figures, checked against the published
   series — and where the design's number was wrong, the corrected one is used and the
   correction is recorded. */

export type ShockType = 'global_oil' | 'national_faac' | 'security' | 'climate' | 'judicial'

export const SHOCKS_PER_QUARTER = 5

export const SHOCK_TYPES: { id: ShockType; label: string; line: string }[] = [
  { id: 'global_oil', label: 'Global oil', line: 'Brent moves; derivation and FAAC move with it, weeks later.' },
  { id: 'national_faac', label: 'National FAAC', line: 'The pool shrinks or a deduction appears at source.' },
  { id: 'security', label: 'Security', line: 'An attack, an abduction, a sit-at-home — and the police are not yours.' },
  { id: 'climate', label: 'Climate', line: 'Flood, desertification, or the dam upstream deciding for you.' },
  { id: 'judicial', label: 'Judicial', line: 'A judgment, a tribunal ruling, a subpoena with your name on it.' },
]

export interface Shock {
  id: string
  type: ShockType
  label: string
  period: string
  /** what actually happened, in sourced figures */
  what: string
  /** how it reaches a desk at each tier */
  federal: string
  state: string
  local: string
  /** where the design's figure was wrong, or could not be verified */
  correction?: string
}

export const SHOCK_DECK: Shock[] = [
  {
    id: 'oil_crash_2016',
    type: 'global_oil',
    label: 'The oil price collapse',
    period: '2014–2016',
    what: 'Brent averaged $111.80 a barrel in June 2014 and $30.70 in January 2016 (EIA monthly averages).',
    federal: 'Revenue halves; the answer is borrowing, and the borrowing becomes a deduction at source for years.',
    state: 'The FAAC share shrinks while the wage bill does not. Derivation states feel it first and hardest.',
    local: 'The Joint Account arrives late, then short. The council’s rates cannot fill the hole.',
    correction: 'The design’s “$111.8 → $30.7” is right as monthly averages. Its 2016 GDP figure of −1.61% is not the contemporaneous NBS estimate: full-year 2016 was −1.51%, with December inflation at 18.55% y/y.',
  },
  {
    id: 'flood_2022',
    type: 'climate',
    label: 'The floods',
    period: 'September–October 2022',
    what: 'Over 600 dead, with an estimated 1.3–1.4 million displaced (UNICEF 21 October 2022; OCHA response update).',
    federal: 'NEMA and the ecological funds move; the political cost is spread across every tier.',
    state: 'You fund the camps and the resettlement, and you are blamed for the drainage you did not build.',
    local: 'The ward floods first and the clinic is in it. No state team is coming today.',
    correction: '“600 dead, 1.4m displaced” is defensible, but it is an evolving situation-report estimate at a date, not a final census. Do not print it as a settled count.',
  },
  {
    id: 'asuu_2022',
    type: 'security',
    label: 'The university strike',
    period: '14 February – 14 October 2022',
    what: 'ASUU shut the federal universities for eight months (242 days) on funding and the revitalisation of public universities.',
    federal: 'Your file, your failure, and you cannot order the lecturers back — the strike is the union’s decision.',
    state: 'Your schools are open and the federal ones are shut, and every parent still blames the nearest government.',
    local: 'Primary school teachers cite the same arrears the federal strike is about, and ask you why theirs are late.',
    correction: 'The design types this shock as “education”; it is filed here as a national industrial action that lands on every desk — it is not a lever any sub-national office holds.',
  },
  {
    id: 'subsidy_2023',
    type: 'national_faac',
    label: 'Subsidy removal',
    period: '29 May 2023',
    what: 'The subsidy was ended by announcement in the inauguration address; pump prices moved from an administered ₦185 to roughly ₦488–₦577 within days, and inflation reached 34.19% y/y by June 2024 (NBS, original CPI series).',
    federal: 'The saving is real and the backlash is immediate; the naira and the price of everything are yours to defend.',
    state: 'Transport, food and the wage bill rise together. Any state palliatives are read as an admission.',
    local: 'Market prices move the day the pumps do, and the council meeting is where the traders’ anger arrives.',
    correction: 'The design’s “₦190 → ₦850+” collapses two years into one move. The first move was ₦185 → about ₦488–₦577; the ₦800+ band came later, in 2024.',
  },
  {
    id: 'autonomy_judgment_2024',
    type: 'judicial',
    label: 'The local government judgment',
    period: '11 July 2024',
    what: 'The Supreme Court ordered council allocations paid directly, held that a state cannot retain or disburse them, and rejected caretaker committees in place of elected councils.',
    federal: 'The judgment binds the Federation’s disbursement practice, not your politics.',
    state: 'A channel of control you had is now unlawful — and the councils know it before your officials do.',
    local: 'Your money can no longer wait on a state signature. It can still wait on a payment run.',
    correction: 'No correction: this is the design’s strongest verified fact, and it is a lever change, not a shock — it should fire once and stay fired.',
  },
  {
    id: 'insecurity_sit_at_home',
    type: 'security',
    label: 'The sit-at-home',
    period: 'since 9 August 2021',
    what: 'The IPOB sit-at-home closed markets and schools in the South-East one day a week; banditry and mass abductions escalated in the North-West in the same period.',
    federal: 'The police and the army are the answer and the answer keeps failing in public.',
    state: 'You cannot order a deployment, and the economy you are blamed for dies one Monday at a time.',
    local: 'The market does not open, the levy is not collected, and the traders want a statement you cannot make.',
  },
]

/** What the pressure model says, for the desk brief: the five kinds, and the paradox. */
export function pressureBrief(): string[] {
  return [
    `${SHOCKS_PER_QUARTER} shocks a quarter arrive from outside the desk: ${SHOCK_TYPES.map((t) => t.label).join(' · ')}.`,
    ...SHOCK_TYPES.map((t) => `• ${t.label}: ${t.line}`),
    'The executive paradox: a Governor is chief security officer in name only — the Commissioner of Police answers to the Inspector-General, not to him.',
  ]
}

export interface ExpectedPressure {
  axis: 'economy' | 'legitimacy' | 'capacity' | 'security' | 'works'
  line: string
}

export interface ScriptedScenario {
  id: string
  officeId: string
  title: string
  state?: string
  lga?: string
  /** deck ids, in the order they land */
  shocks: string[]
  expectedPressure: ExpectedPressure[]
  playerActions: string[]
  win?: string
  lose?: string
  postlessRisk?: string
  cannotControl?: string[]
}

/** The design’s four triple-shock runs: the same quarter hitting four different seats. */
export const SCRIPTED_SCENARIOS: ScriptedScenario[] = [
  {
    id: 'triple_shock_president',
    officeId: 'federal/president',
    title: 'Triple shock — the President',
    shocks: ['oil_crash_2016', 'flood_2022', 'asuu_2022'],
    expectedPressure: [
      { axis: 'economy', line: 'FAAC falls sharply and the answer is external credit, with conditions attached.' },
      { axis: 'legitimacy', line: 'Youth approval collapses; the memory of the 2020 protests colours every decision.' },
      { axis: 'capacity', line: 'The universities are federal but the strike is national: you cannot force ASUU back.' },
    ],
    playerActions: ['security_vote', 'influencer_pay', 'external_loan', 'labour_negotiation'],
    win: 'Survive two years without an impeachment count and keep approval above 35%.',
  },
  {
    id: 'triple_shock_governor',
    officeId: 'state/governor',
    title: 'Triple shock — the Governor of Delta',
    state: 'Delta',
    shocks: ['oil_crash_2016', 'flood_2022', 'asuu_2022'],
    expectedPressure: [
      { axis: 'economy', line: 'Derivation drops before FAAC does; the wage bill is the first casualty and NLC is the second.' },
      { axis: 'security', line: 'Blamed for flood displacement while NEMA holds the response.' },
      { axis: 'capacity', line: 'State schools open, federal universities shut — parents blame the government in front of them.' },
    ],
    playerActions: ['igr_drive', 'traditional_ruler_appeal', 'patron_loan'],
    lose: 'Salary arrears past three months, and the House starts counting for an impeachment.',
    cannotControl: ['the oil price', 'the naira', 'ASUU'],
  },
  {
    id: 'triple_shock_fct',
    officeId: 'fct/minister',
    title: 'Triple shock — the FCT Minister',
    shocks: ['oil_crash_2016', 'flood_2022', 'asuu_2022'],
    expectedPressure: [
      { axis: 'works', line: 'Abuja floods, and a 1% earmark cannot drain a capital built on a flood plain.' },
      { axis: 'legitimacy', line: 'No mandate: demolitions and resettlements are answered to residents who never voted for you.' },
      { axis: 'capacity', line: 'The President can end the appointment at will, and the ministry can overrule your order.' },
    ],
    playerActions: ['drainage_priority', 'resettlement_plan', 'presidential_cover'],
  },
  {
    id: 'triple_shock_lga',
    officeId: 'local/chairman',
    title: 'Triple shock — the Chairman of Abeokuta North',
    state: 'Ogun',
    lga: 'Abeokuta North',
    shocks: ['oil_crash_2016', 'flood_2022', 'asuu_2022'],
    expectedPressure: [
      { axis: 'works', line: 'Primary clinics are flooded and there is no state team coming.' },
      { axis: 'economy', line: 'Markets close, levies stop, and IGR for the month is nil.' },
      { axis: 'capacity', line: 'The allocation is direct after the 2024 judgment but still arrives on the state’s timing.' },
    ],
    playerActions: ['clinic_emergency', 'market_negotiation', 'state_liaison'],
    lose: 'Two quarters without a payment run and the council becomes a rumour.',
    postlessRisk: 'Fail here and the market association will still take your calls — a godfather with no office.',
  },
]
