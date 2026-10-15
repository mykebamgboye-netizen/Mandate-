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

export const WEEK = {
  dateLine: 'THURSDAY · 8 OCTOBER 2026',
  weekLine: 'EXCO WEEK 41 · ASABA',
  player: 'M. A. Bamgboye',
  office: 'Executive Governor of Delta State',
}

const AUDIT_STD = [
  '08 Oct 2026 · 06:40 — assembled (desk phase 9) from events #4471–#4488',
  '08 Oct 2026 · 06:41 — delivered to the in-tray · visibility: private',
]

export const DOCS: Doc[] = [
  {
    id: 'exco-minutes',
    kind: 'minutes',
    title: 'Exco Minutes — 8 Oct 2026',
    trayLine: 'State Executive Council — four items await your hand',
    stock: 'lined', clip: 'binder', stain: 'ring', mark: 'urgent',
    date: '8 OCT 2026',
    head: ['MINUTES —', 'DELTA STATE EXECUTIVE COUNCIL —', '8 OCT 2026'],
    items: [
      { n: 1, text: 'ASUU threat — offer 12% salary adjustment?' },
      { n: 2, text: 'Works Commissioner (Agoro) likely defecting to NRA — call 8pm.' },
      { n: 3, text: 'FAAC shortfall: ₦214,371,000.' },
      { n: 4, text: 'Okpe Road protest — deploy task force?' },
    ],
    sketch: true,
    authority: 'Part V · ss.192–194',
    authorityText: 'Executive Council of a State — commissioners appointed by the Governor under s.192, collectively responsible through the Governor (s.193). The Council binds you; minutes are the paper proof.',
    recordId: 'MANDATE/2026/W41/EXCO',
    audit: AUDIT_STD,
  },
  {
    id: 'sapele-gazette',
    kind: 'gazette',
    title: 'Gazette No. 147 — Sapele Market',
    trayLine: 'Sign before FAAC drops — ₦84,700,000',
    stock: 'memo', clip: 'paperclip', stain: 'spatter', mark: 'urgent',
    date: '8 OCT 2026',
    fedHead: 'FEDERAL REPUBLIC OF NIGERIA',
    gazetteLine: '— OFFICIAL GAZETTE No. 147',
    memoDate: '8 OCT 2026',
    memorandum: 'MEMORANDUM: Sapele Market Renovation.',
    appropriation: 'Appropriation: ₦84,700,000.',
    authorityPara: 'Authority: Section 162, Constitution of the Federal Republic of Nigeria 1999 (as amended).',
    faacLine: 'FAAC allocation shortfall noted.',
    note: 'urgent — sign before FAAC drops',
    footer: 'DOCUMENT VALID · RECORD ID: MANDATE/2026/147/SAP',
    signName: 'M. Bamgboye',
    role: 'Authorized Signatory',
    authority: 's.162',
    authorityText: 'Section 162 — the Federation Account: revenues paid in and distributed, including the 13% derivation on the margin. The memo cites it because this is federal money moving through your hands.',
    recordId: 'MANDATE/2026/147/SAP',
    audit: [...AUDIT_STD, '08 Oct 2026 · 06:41 — red-pen note applied by the Chief of Staff'],
  },
  {
    id: 'faac-communique',
    kind: 'faac',
    title: 'FAAC Communiqué — September',
    trayLine: 'Gross ₦2.338 trillion shared · Delta net ₦43,475,220,000',
    stock: 'ledger', clip: 'none', stain: 'ring', mark: 'opened',
    date: '8 OCT 2026',
    docHead: 'FEDERATION ACCOUNT ALLOCATION COMMITTEE',
        lines: [
      { label: 'GROSS DISTRIBUTED (FEDERATION ACCOUNT)', value: '₦2,338,000,000,000', strong: true, rule: true },
      { label: '— Federal Government (as published)', value: '₦805,000,000,000', indent: true },
      { label: '— States (as published)', value: '₦794,000,000,000', indent: true },
      { label: '— Local Councils (via Joint Account)', value: '₦555,000,000,000', indent: true },
      { label: '— 13% Derivation (oil-mineral states)', value: '₦184,000,000,000', indent: true },
      { label: 'DELTA STATE — SEPTEMBER 2026', value: '', strong: true, rule: true },
      { label: 'Statutory allocation', value: '₦12,812,345,679', indent: true },
      { label: 'VAT share', value: '₦11,799,995,679', indent: true },
      { label: 'Derivation tranche', value: '₦21,500,056,789', indent: true },
      { label: 'Gross share (stat + VAT + derivation)', value: '₦46,112,398,147', indent: true },
      { label: 'Deductions at source (loan & bailout repayments)', value: '–₦2,637,177,207', indent: true },
      { label: 'NET TO STATE TREASURY', value: '₦43,475,220,940', strong: true, rule: true },
      { label: 'October projection (net + shortfall)', value: '₦43,689,591,940', indent: true },
      { label: 'SHORTFALL AGAINST PROJECTION', value: '–₦214,371,000', strong: true },
    ],

    foot: "Collated in Asaba from the FAAC communiqué of the September 2026 meeting. Figures carried to the naira; the gap is the gap.",
    authority: 's.162 · 13% derivation',
    authorityText: 'Section 162(1)–(10): revenue paid into the Federation Account and distributed on the approved basis; the 13% derivation for oil-mineral producing states (s.162(2)). Your state lives on this line.',
    recordId: 'FAAC/2026/09/DELTA',
    audit: AUDIT_STD,
  },
  {
    id: 'state-police-whip',
    kind: 'whip',
    title: 'Whip Sheet — State Police',
    trayLine: 'Ratification count in the House of Assembly',
    stock: 'memo', clip: 'none', stain: 'none', mark: 'fresh',
    date: '8 OCT 2026',
    docHead: 'WHIP SHEET — DELTA STATE HOUSE OF ASSEMBLY',
    counts: [
      { label: 'FIRM — YEA', value: '16' },
      { label: 'LEANING — YEA', value: '5' },
      { label: 'UNMARKED', value: '8' },
      { label: 'HARD NO', value: '0' },
      { label: 'NATIONAL PICTURE', value: '12 passed · 6 awaiting · 18 not called (24 needed)' },
    ],
    bullets: [
      'The Clerk wants a plenary date before 21 Oct. The governors’ count closes Friday.',
      'Holdouts: Hon. U. M. Egbu (Ughelli North I) wants a local-protocol clause in the text; Hon. Pastor F. Isioye (Sapele II) is under parish pressure on tenure; Hon. B. Okegie (Oshimili South) has been silent since the primaries.',
      'Your word decides three of the eight unmarked.',
    ],
    foot: 'Office of the Majority Leader · internal · not for press.',
    authority: 'Constitution (Sixth Alteration) Bill, 2026',
    authorityText: 'Amending the Constitution requires approval by the National Assembly and by not less than two-thirds of all State Houses of Assembly — 24 of 36. Every assembly is a bloc; yours is one of them.',
    recordId: 'HA/2026/ALTER6/WHIP',
    audit: AUDIT_STD,
  },
  {
    id: 'running-mate',
    kind: 'table',
    title: 'Deputy Ticket — Zoning Check',
    trayLine: 'Who balances the ticket — zone, faith, machine, money, baggage',
    stock: 'photo', clip: 'paperclip', stain: 'spatter', mark: 'opened',
    date: '8 OCT 2026',
    docHead: 'Deputy Ticket — Zoning Check',
    subHead: 'DEPUTY GOVERNOR · ZONE · FAITH · MACHINE · MONEY · BAGGAGE',
    columns: ['Zone', 'Faith', 'Machine', 'Money', 'Baggage'],
    rows: [
      ['Delta North', 'Christian', 'CDM list', '₦1.2b', 'none'],
      ['Delta Central', 'Christian', 'Party women', '₦840m', 'keeps copies'],
      ['Delta South', 'Christian', 'Warri ward captains', '₦600m', 'NRA sightings'],
    ],
    checkRow: 2,
    circleCol: 2,
    redNote: 'South balances the ticket — but he is the one shopping an NRA ticket',
    authority: 'n/a — party paper',
    authorityText: 'No constitutional force; binding only by patronage. A deputy shares the ticket, not the term — you may drop him, but the zone remembers (s.187).',
    recordId: 'PARTY/2026/DEPUTY/SS',
    audit: [...AUDIT_STD, 'received under the door, 07:10 — sender unrecorded'],
  },
  {
    id: 'security-digest',
    kind: 'security',
    title: 'Security Digest — Week 41',
    trayLine: 'RESTRICTED — Okpe Road, Ughelli, flood watch',
    stock: 'memo', clip: 'binder', stain: 'none', mark: 'fresh',
    date: '8 OCT 2026',
    docHead: 'DELTA STATE SECURITY DIGEST — WEEK 41/2026 — RESTRICTED',
    items: [
      { head: 'OKPE ROAD PROTEST — WARRI', body: 'About 400 traders and riders blocked Okpe Road from 06:10. No violence, no damage. Traffic diverted through Edjeba. Organisers: Okpe Road Market Association plus two youth groups. Demand: drainage cleared, 2024 feeder-road promise honoured. No dispersal requested by the LGA.' },
      { head: 'UGHELLI — RIVAL GROUPS', body: 'Campus-linked groups clashed Tuesday night; two injured, three arrested, no firearms recovered. Remanded. Families at the hospital; the local chairman convenes elders at 16:00.' },
      { head: 'PIPELINE — FORCADOS TRUNKLINE', body: 'Attempted vandalism near Otu-Jeremi; Joint Task Force responded, two suspects in custody, no leak recorded.' },
      { head: 'FLOOD WATCH (NIMET ADVISORY)', body: 'Rainfall peak expected 10–13 Oct. Burutu and low-lying Warri wards advised; two camps readied at Osubi and Oghara.' },
      { head: 'CAMPUS GATE MARCH — ASUU', body: 'Peaceful march of 60–80 students to the main gate; no clash; management receives the union Thursday.' },
    ],
    foot: 'Prepared for His Excellency by O. Iriobe, Director of State Services, Delta Command · 06:00, 8 Oct 2026. Copies: Chief of Staff, Attorney-General, Commissioner of Police (courtesy).',
    authority: 'ss.214–216 · convention',
    authorityText: 'The Police Force is federal (s.214). You are chief security officer of the state by convention, not by command: you may ask, fund and coordinate — you may not deploy the Force.',
    recordId: 'DSS/DT/2026/W41',
    audit: AUDIT_STD,
  },
  {
    id: 'nlc-letter',
    kind: 'letter',
    title: 'NLC Letter — Arrears',
    trayLine: 'Consequential adjustment: ₦1,213,450,000 · window closes 20 Oct',
    stock: 'letterhead', clip: 'none', stain: 'coffee', mark: 'opened',
    date: '6 OCT 2026',
    letterhead: 'NIGERIAN LABOUR CONGRESS — DELTA STATE COUNCIL',
    to: 'The Executive Governor of Delta State, Asaba.',
    subject: 'RE: CONSEQUENTIAL ADJUSTMENT ARREARS — AUGUST 2024 TO AUGUST 2026',
    paras: [
      'Your Excellency, the State Executive of Congress met on Tuesday 6 October 2026 and reviewed the payment schedule of August 2024. It finds that the consequential adjustment for grade levels 07–14 remains unpaid after twenty-five months.',
      'The sum outstanding, computed from the payroll desk, is ₦1,213,450,000 covering 14,612 workers across fourteen councils and the state service.',
      'Congress notes the shortfall in the month’s federal allocation and the many calls on the wage bill. We nevertheless ask for two tranches: ₦606,725,000 on or before 20 October 2026, and the balance with November salaries.',
      'We would rather negotiate than close our offices. The window closes on 20 October 2026.',
    ],
    signName: 'Comrade S. E. Obarisiagbon',
    signTitle: 'Chairman, NLC Delta State Council',
    dateLine: '6 October 2026',
    authority: 'n/a — correspondence',
    authorityText: 'Not an instrument of state. Leverage: the Labour Act (collective bargaining) and your obligation as employer. A letter that becomes a strike notice with one signature.',
    recordId: 'NLC/DT/2026/CA-14',
    audit: AUDIT_STD,
  },
  {
    id: 'rival-dossier',
    kind: 'dossier',
    title: 'Dossier fragment — on YOU',
    trayLine: 'Photocopy. Somebody is keeping a file.',
    stock: 'photo', clip: 'paperclip', stain: 'spatter', mark: 'urgent',
    date: '8 OCT 2026',
    subject: 'EXTRACT — FILE DG/7/26 — SUBJECT: “M. A. B.”',
    lines: [
      { label: 'Promise record (own tally)', value: '41 made · 17 kept · 12 delayed · 12 dead' },
      { label: 'Sapele Market award', value: '₦84,700,000 — direct; Halcyon Marine & Estates Ltd (brother-in-law on the 2023 filing)' },
      { label: 'Okpe Road variation', value: '₦1,377,540,000 — signature on W2; threshold pattern' },
      { label: 'Political class — Price', value: '58 → 64 (rising)', pencil: true },
      { label: 'Political class — Reliability', value: '47', pencil: true },
      { label: 'The People — Closeness', value: '61 → 52 (since June)', pencil: true },
    ],
    whispers: [
      'The Works Commissioner is shopping an NRA ticket. He has read this file.',
      'Copy 2 of 3 — watermark not removed.',
    ],
    margin: 'who else has this?',
    authority: 'n/a — seized fragment',
    authorityText: 'Informal until someone files it. Filed in a petition it becomes an exhibit; leaked it becomes a story. Reference: Fifth Schedule (declaration) and Sixth Schedule (tribunal exhibits).',
    recordId: 'LEAK/DG7/2026/COPY2',
    audit: ['08 Oct 2026 · 05:52 — slipped under the kitchen door, Asaba residence', 'source unknown · visibility: sealed (nominally)'],
  },
  {
    id: 'tribunal-summons',
    kind: 'tribunal',
    title: 'Tribunal Summons — Ughelli North I',
    trayLine: 'Petition EPT/DTHA/2026/07 — you are joined as 3rd respondent',
    stock: 'form', clip: 'binder', stain: 'ring', mark: 'urgent',
    date: '7 OCT 2026',
    docHead: 'IN THE STATE ELECTION TRIBUNAL HOLDEN AT ASABA',
    caseNo: 'PETITION No. EPT/DTHA/2026/07',
    parties: [
      { role: 'PETITIONER', name: 'Hon. P. E. Uboh' },
      { role: '1ST RESPONDENT', name: 'INEC' },
      { role: '2ND RESPONDENT', name: 'Hon. R. O. Igho' },
      { role: '3RD RESPONDENT (JOINED)', name: 'M. A. Bamgboye — funding witness' },
    ],
    grounds: [
      'Over-voting alleged in Ward 4, Ughelli North I — 1,842 of 9,117 votes challenged.',
      'Non-compliance: six of fourteen units opened after 08:30 without explanation; Forms EC8A withheld.',
      'Witnesses marked: 22. Four have withdrawn since filing.',
    ],
    relief: 'Relief sought: the seat declared vacant and a fresh election ordered in Ughelli North I.',
    listing: 'PRE-HEARING CONFERENCE — 15 OCT 2026, 10:00 — TRIBUNAL HALL, ASABA. Subpoena for the funding record attached.',
    stampText: 'SUMMONS',
    authority: 'Sixth Schedule · s.285',
    authorityText: 'Election Tribunals — Sixth Schedule (jurisdiction, practice, procedure) and s.285 (establishment). Your name is on the funding line; the paper does not care that you are Governor.',
    recordId: 'EPT/DTHA/2026/07/J3',
    audit: ['07 Oct 2026 · 14:22 — served on the Secretary to the State Government', '07 Oct 2026 · 17:05 — acknowledged; 21 days to answer'],
  },
  {
    id: 'clipping-asuu',
    kind: 'clipping',
    title: 'Clipping — ASUU 7-day ultimatum',
    trayLine: 'Daily Sentinel — talks stall over 12% offer',
    stock: 'newsprint', clip: 'none', stain: 'coffee', mark: 'opened',
    date: '8 OCT 2026',
    outlet: 'DAILY SENTINEL · LAGOS · THURSDAY, 8 OCTOBER 2026 · ₦300',
    kicker: 'INDUSTRIAL RELATIONS',
    headline: 'ASUU gives state 7 days on 12% offer as talks stall',
    byline: 'Staff Reporter, Asaba',
    paras: [
      'The union for teachers at the state university has given the government until 15 October to improve an offer of a 12 per cent salary adjustment, adjourning talks after four hours at the Secretariat on Wednesday.',
      'The state team, led by the Commissioner for Education, said the offer was the best possible against a shortfall of ₦214,371,000 in the month’s federal allocation. Union leaders said members were still owed the consequential adjustment due since August 2024 and would consult chapters on Friday.',
    ],
    briefs: [
      '— Council chairmen meet in Asaba on the autonomy clause, Friday.',
      '— Naira steadies near ₦1,331/$ as reserves hold near $55bn.',
    ],
    authority: 'n/a — press',
    authorityText: 'Press cutting. Outlet reach and bias feed the perception mirrors; it carries no constitutional weight, only consequences.',
    recordId: 'PRESS/DS/2026/10/08/A3',
    audit: AUDIT_STD,
  },
  {
    id: 'nra-leaflet',
    kind: 'leaflet',
    title: 'Rally leaflet (torn)',
    trayLine: 'NRA — Renewal Rally, Warri, Sat 11 Oct',
    stock: 'newsprint', clip: 'none', stain: 'none', mark: 'forwarded',
    date: '7 OCT 2026',
    party: 'NATIONAL RENEWAL ALLIANCE (NRA)',
    colorA: '#1F5D3A',
    colorB: '#D8A12E',
    event: 'THE RENEWAL RALLY',
    when: 'SATURDAY, 11 OCTOBER · 10:00 AM',
    where: 'WARRI CITY STADIUM',
    lines: [
      'Security. Naira. Tomorrow.',
      'Buses and refreshments leave from the ward secretariat at 8:00 — bring your PVC.',
    ],
    smear: 'Ask the Governor where the ₦84,700,000 went.',
    authority: 'n/a — campaign literature',
    authorityText: 'Campaign season: presidential and NASS opened 19 August 2026; governorship 9 September 2026. Spend rules under the Electoral Act 2026 — [verify] before citing in play.',
    recordId: 'LEAFLET/NRA/WR/1110',
    audit: ['picked off the road at Effurun Roundabout', 'folded twice — forwarded to the campaign file'],
  },
  {
    id: 'cos-note',
    kind: 'note',
    title: 'Note from the Chief of Staff',
    trayLine: 'RE: the 8pm call — he is not picking.',
    stock: 'pad', clip: 'none', stain: 'ring', mark: 'urgent',
    date: '8 OCT 2026',
    from: 'A. N. W.',
    re: '8PM CALL — WORKS',
    lines: [
      'Felix is not picking. His SA says two men from Kano landed yesterday — NRA ticket people.',
      'Do not sign anything else from Works until we know. The Sapele file is with the AG for clearance anyway.',
      'Protocol holds the 8pm slot. Say the word and I move it to Friday.',
    ],
    authority: 'n/a — aide note',
    authorityText: 'Private. Visibility: private. It becomes Evidence only if it is leaked, subpoenaed or photographed by somebody with a phone.',
    recordId: 'COS/2026/10/08/NOTE3',
    audit: ['08 Oct 2026 · 06:55 — written in biro, handed over the desk'],
  },
]

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
  requiresPolice?: boolean
}
export const DECISIONS: Decision[] = [
  {
    id: 'asuu', docId: 'clipping-asuu',
    question: 'ASUU State Chapter — what do you offer by Friday?',
    hours: 2,
    deadline: 'DEADLINE — 15 OCT · STRIKE BALLOT FRIDAY',
    options: [
      {
        key: '12', label: 'Offer 12% now',
        sub: 'ASUU suspends · Treasury −₦2.1bn · Public +5',
        ledger: 'writes: promises kept · public goods · ₦ cost on the wage bill',
        marg: 'lawful · open · public · fast', level: 3,
      },
      {
        key: '8', label: 'Offer 8% + arrears in two tranches',
        sub: 'Talks continue · NLC watches',
        ledger: 'writes: promise (delayed) · structural debt · grudges small',
        marg: 'lawful · quiet · formal · slow', level: 2,
      },
    ],
  },
  {
    id: 'gazette', docId: 'sapele-gazette',
    question: 'Gazette No.147 — Sapele Market',
    hours: 1,
    deadline: 'SIGN BEFORE FAAC DROPS — 21 OCT',
    special: 'gazette',
    options: [
      {
        key: 'sign', label: 'Sign quietly',
        sub: 'No protest · −₦84.7m · Integrity −2',
        ledger: 'writes: evidence ledger · public goods · Halcyon Marine paid',
        marg: 'grey · quiet · informal', level: 2,
      },
      {
        key: 'refer', label: 'Refer to EXCO',
        sub: 'Delay · market women angry',
        ledger: 'writes: promise delayed · market agitation · Works lobby watches',
        marg: 'grey · quiet · formal', level: 2,
      },
    ],
  },
  {
    id: 'works', docId: 'cos-note',
    question: 'Works Commissioner Agoro',
    hours: 1,
    deadline: 'HE CALLS AT 8PM — TONIGHT',
    options: [
      {
        key: 'back', label: 'Back him publicly',
        sub: 'He stays · ties you to his file',
        ledger: 'writes: favours · evidence if he is dirty · NRA reads it as war',
        marg: 'lawful · closed', level: 3,
      },
      {
        key: 'file', label: 'Ask for his file',
        sub: 'He stalls · you learn what the AG holds',
        ledger: 'writes: intel · standing + · he knows you are looking',
        marg: 'lawful · quiet · formal', level: 2,
      },
    ],
  },
  {
    id: 'okpe', docId: 'exco-minutes',
    question: 'Okpe Road protest — task force, dialogue, or wait?',
    hours: 3,
    deadline: 'TRADERS STILL ON THE ROAD — RAINS FROM 10 OCT',
    options: [
      {
        key: 'force', label: 'Deploy the task force',
        sub: 'Road cleared · photographs · grudges',
        ledger: 'writes: public goods withheld · grudges · press photographs',
        marg: 'grey · open · force', level: 3,
      },
      {
        key: 'talk', label: 'Open dialogue — works team to the road',
        sub: 'Street calms · a promise lands in weeks',
        ledger: 'writes: standing with the street · promise due in weeks',
        marg: 'lawful · open · slow', level: 2,
      },
    ],
  },
]

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
export const ALLIES: Ally[] = [
  {
    id: 'agoro', name: 'Hon. Felix Agoro', office: 'Works Commissioner', zone: 'Delta South',
    initials: 'FA', badge: 'LOYAL', trust: 3,
    whisper: 'Two NRA men were seen at his gate Wednesday — he called you first.',
  },
  {
    id: 'nwachukwu', name: 'Chief (Mrs.) A. N. Nwachukwu', office: 'Chief of Staff', zone: 'Delta North',
    initials: 'AN', badge: 'NEGOTIABLE', trust: 2,
    whisper: 'Keeps three copies of everything. Yours are in the safe.',
  },
  {
    id: 'danjuma', name: 'Alhaji Bala Danjuma', office: 'CDM Chairman', zone: 'Delta North',
    initials: 'BD', badge: 'LEVERAGE', trust: 1,
    whisper: 'Wants his nephew in procurement. Asks every Friday.',
  },
  {
    id: 'owhonda', name: 'Elder Tom Owhonda', office: 'Traditional Council', zone: 'Delta South',
    initials: 'TO', badge: 'NEGOTIABLE', trust: 2,
    whisper: 'Will back you if you fund the youth hall.',
  },
]

const AUTHORITY_F5 = 'Fifth Schedule — declaration of assets by public officers. Printed facts are filed; pencilled figures are yours, sourced and dated, and they decay without refresh.'

export const ASSET_DOCS: AssetDoc[] = [
  {
    id: 'asset-agoro', kind: 'asset',
    title: 'Declaration — Hon. F. Agoro', trayLine: 'Fifth Schedule form · pencilled estimates',
    stock: 'form', clip: 'paperclip', stain: 'coffee', mark: 'opened', date: 'FILE COPY',
    formHead: 'DECLARATION OF ASSETS AND LIABILITIES — FIFTH SCHEDULE',
    fields: [
      { label: 'NAME', value: 'Hon. Felix Osareme Agoro' },
      { label: 'OFFICE', value: 'Commissioner for Works & Transport' },
      { label: 'LGA / STATE', value: 'Warri South / Delta' },
      { label: 'DATE OF BIRTH', value: '14 March 1971' },
      { label: 'BEFORE OFFICE', value: 'Contractor — roads & fuel supply' },
      { label: 'DECLARED ASSETS', value: '4 properties, 2 vehicles (as filed 2023)' },
      { label: 'LIABILITIES', value: 'Declared: nil. Estimated: ₦? (bank whisper)' },
    ],
    ranges: [
      { label: 'competence', lo: 45, hi: 65, src: 'aide · medium confidence' },
      { label: 'loyalty', lo: 30, hi: 55, src: 'hostile press · low confidence' },
      { label: 'ambition', lo: 72, hi: 88, src: 'two sightings, same week' },
      { label: 'price', lo: 55, hi: 75, src: 'derived · greed + needs' },
      { label: 'machine', lo: 60, hi: 80, src: 'ward captains in Warri' },
    ],
    margin: 'defecting? confirm before Friday',
    authority: 'Fifth Schedule', authorityText: AUTHORITY_F5,
    recordId: 'DOSSIER/2026/AGORO/F5',
    audit: ['compiled from 4 intel actions', 'last refreshed 06 Oct 2026'],
  },
  {
    id: 'asset-nwachukwu', kind: 'asset',
    title: 'Declaration — Chief (Mrs.) Nwachukwu', trayLine: 'Fifth Schedule form · pencilled estimates',
    stock: 'form', clip: 'paperclip', stain: 'none', mark: 'fresh', date: 'FILE COPY',
    formHead: 'DECLARATION OF ASSETS AND LIABILITIES — FIFTH SCHEDULE',
    fields: [
      { label: 'NAME', value: 'Chief (Mrs.) Adaeze Ngozi Nwachukwu' },
      { label: 'OFFICE', value: 'Chief of Staff to the Governor' },
      { label: 'LGA / STATE', value: 'Oshimili North / Delta' },
      { label: 'DATE OF BIRTH', value: '2 September 1976' },
      { label: 'BEFORE OFFICE', value: 'Senior counsel; civil-service union adviser' },
      { label: 'DECLARED ASSETS', value: '2 properties, 1 vehicle (as filed 2023)' },
      { label: 'LIABILITIES', value: 'Declared: mortgage, First Meridian' },
    ],
    ranges: [
      { label: 'competence', lo: 70, hi: 85, src: 'watched for 3 years' },
      { label: 'loyalty', lo: 80, hi: 95, src: 'kept 6 of 6 secrets' },
      { label: 'discretion', lo: 65, hi: 80, src: 'one leak she could not explain' },
      { label: 'ambition', lo: 55, hi: 70, src: 'wants Chief Secretary next' },
    ],
    margin: 'reliable — but she keeps copies',
    authority: 'Fifth Schedule', authorityText: AUTHORITY_F5,
    recordId: 'DOSSIER/2026/NWACHUKWU/F5',
    audit: ['compiled from 9 intel actions', 'last refreshed 07 Oct 2026'],
  },
  {
    id: 'asset-danjuma', kind: 'asset',
    title: 'Declaration — Alhaji B. Danjuma', trayLine: 'Fifth Schedule form · pencilled estimates',
    stock: 'form', clip: 'paperclip', stain: 'ring', mark: 'opened', date: 'FILE COPY',
    formHead: 'DECLARATION OF ASSETS AND LIABILITIES — FIFTH SCHEDULE',
    fields: [
      { label: 'NAME', value: 'Alhaji Bala Musa Danjuma' },
      { label: 'OFFICE', value: 'State Chairman, CDM Delta' },
      { label: 'LGA / STATE', value: 'home base outside the state / party man' },
      { label: 'DATE OF BIRTH', value: '11 January 1964' },
      { label: 'BEFORE OFFICE', value: 'Transport union; two terms in the House' },
      { label: 'DECLARED ASSETS', value: '6 properties, 5 vehicles (as filed 2023)' },
      { label: 'LIABILITIES', value: 'Declared: ₦? to the party trust' },
    ],
    ranges: [
      { label: 'competence', lo: 50, hi: 70, src: 'won a hard primary in 2023' },
      { label: 'loyalty', lo: 45, hi: 65, src: 'party first, you second' },
      { label: 'greed', lo: 60, hi: 80, src: 'list-making is his trade' },
      { label: 'machine', lo: 70, hi: 85, src: 'chair controls ward money' },
    ],
    margin: 'wants the 2027 list through his office',
    authority: 'Fifth Schedule', authorityText: AUTHORITY_F5,
    recordId: 'DOSSIER/2026/DANJUMA/F5',
    audit: ['compiled from 5 intel actions', 'last refreshed 02 Oct 2026'],
  },
  {
    id: 'asset-owhonda', kind: 'asset',
    title: 'Declaration — Elder T. Owhonda', trayLine: 'Fifth Schedule form · pencilled estimates',
    stock: 'form', clip: 'paperclip', stain: 'spatter', mark: 'opened', date: 'FILE COPY',
    formHead: 'DECLARATION OF ASSETS AND LIABILITIES — FIFTH SCHEDULE',
    fields: [
      { label: 'NAME', value: 'Elder Thomas Ogban Owhonda' },
      { label: 'OFFICE', value: 'Party elder — holds no office, holds them all' },
      { label: 'LGA / STATE', value: 'Ughelli South / Delta' },
      { label: 'DATE OF BIRTH', value: '30 November 1955' },
      { label: 'BEFORE OFFICE', value: 'Shipping, oil services, three governors' },
      { label: 'DECLARED ASSETS', value: '11 properties, 7 vehicles (as filed 2019, stale)' },
      { label: 'LIABILITIES', value: 'Declared: nil. Estimate: companies in 3 names' },
    ],
    ranges: [
      { label: 'competence', lo: 65, hi: 80, src: 'built two careers from nothing' },
      { label: 'loyalty', lo: 40, hi: 60, src: 'keeps nobody long' },
      { label: 'machine', lo: 85, hi: 95, src: 'ward captains call him first' },
      { label: 'price', lo: 75, hi: 90, src: 'the “derivation quiet” line' },
    ],
    margin: 'circled on the ticket sheet — ask what he wants',
    authority: 'Fifth Schedule', authorityText: AUTHORITY_F5,
    recordId: 'DOSSIER/2026/OWHONDA/F5',
    audit: ['compiled from 11 intel actions — two sources paid', 'last refreshed 05 Oct 2026'],
  },
]

export interface LedgerRow { date: string; memo: string; amount: number; pending?: boolean }
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

export const BUDGET: LedgerRow[] = [
  { date: '01 Oct', memo: 'FAAC net to treasury — September shortfall month', amount: 43475220940 },
  { date: '02 Oct', memo: 'Teachers payroll, September, GL 07-15 (14,612 staff)', amount: -2571712000 },
  { date: '02 Oct', memo: 'Pension payroll — September', amount: -2466931300 },
  { date: '03 Oct', memo: 'Other civil service — September', amount: -6700000003 },
  { date: '03 Oct', memo: 'Health and parastatals — September', amount: -2865815521 },
  { date: '04 Oct', memo: 'Gratuity flow — monthly schedule', amount: -1900000003 },
  { date: '04 Oct', memo: 'Debt service — state bond & facility', amount: -8060000003 },
  { date: '04 Oct', memo: 'Council transfer — state-funded LGA line (~10% of IGR) [verify]', amount: -986127491 },
  { date: '05 Oct', memo: 'Overheads and subventions — September', amount: -8000000003 },
  { date: '05 Oct', memo: 'IGR — September', amount: 9861274880 },
  { date: '05 Oct', memo: 'Contractor variation orders, certified', amount: -8292859873 },
  { date: '06 Oct', memo: 'Capital works in progress, certified (equipment folded in)', amount: -8292859874 },
  { date: '07 Oct', memo: 'Federation refund — excess deductions recovered, payroll balancing', amount: 1240880000 },
  { date: '06 Oct', memo: 'Road variation W2 — Okpe Road (awaiting sanction)', amount: -1377540000, pending: true },
  { date: '07 Oct', memo: 'NLC arrears tranche 1 — window closes 20 Oct', amount: -606725000, pending: true },
  { date: '08 Oct', memo: 'Sapele Market Renovation — Gazette 147', amount: -84700000, pending: true },
  { date: '08 Oct', memo: 'Revenue shortfall against October projection', amount: -214371000 },
]


export function formatNaira(n: number): string {
  const neg = n < 0
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '–' : '') + '₦' + s
}

export function nairaDisplay(n: number): string {
  // plain number with commas and a leading minus for negatives; no currency glyph, for inline UI sentences
  return formatNaira(n).replace(/^₦/, '')
}

export const HANDOVER: NoteDoc = {
  id: 'handover',
  kind: 'note',
  title: 'Handover Note',
  trayLine: 'From the outgoing aide — read before you touch anything',
  stock: 'pad', clip: 'none', stain: 'ring', mark: 'urgent',
  date: '7 OCT 2026',
  from: 'G.O. — outgoing Chief of Staff',
  re: 'HANDOVER — YOUR FIRST WEEK',
  lines: [
    'You are eighteen months into a four-year term. The general election is fifteen months away — every file from here is read against it.',
    'Two items expire this week: ASUU on 15 October, the NLC window on 20 October. The gazette wants your stamp; the FAAC shortfall is real.',
    'The treasury opened October with ₦3,834,790,251 — about one week of payroll. The wage bill eats most of this month’s FAAC.',
    'You have 14 Desk Hours this week. Every action burns some — spend them like money, because on Friday they are gone.',
    'Nothing irreversible is a tap. Hold the stamp, hold the decision — the circle fills, then it lands. One life, no reload.',
    'Tap the ℹ on any file to see the section of the Constitution it leans on. Pencil figures are estimates; printed figures are facts.',
    'The dictionary is on the shelf. Ask me nothing — I am no longer on the payroll.',
  ],
  authority: 'n/a — handover note',
  authorityText: 'Conventions of the office, not law. Filed with your service record on day one and kept forever.',
  recordId: 'HANDOVER/2026/W41',
  audit: ['07 Oct 2026 · 18:40 — left on the desk with the keys'],
}

/* §48/§51.3 — ONE EVENT, TEN DESKS: the same grid collapse at three offices,
   with native jargon, tap-to-gloss and the chain of hands that delivered it. */
export const SECTOR_BRIEF: SectorDoc = {
  id: 'sector-brief',
  kind: 'sector',
  title: 'Sector Brief — the grid collapsed',
  trayLine: 'One event, three desks — who dropped which line',
  stock: 'form', clip: 'binder', stain: 'ring', mark: 'fresh',
  date: '6 OCT 2026',
  docHead: 'SECTOR BRIEF — POWER — NATIONAL GRID EVENT',
  event: 'Monday 6 October 2026, 03:12 — system-wide trip; restoration by 05:40.',
  desks: [
    {
      id: 'ward', label: 'WARD EXCO', sub: 'a voice note in the market group',
      lines: [
        '“Light don go since Sunday night. Fish for freezer don spoil. Generator [[petrol]] na [[₦1,380]] a litre. Dem say na [[trip]] but everybody don sleep.” — market woman, 06:14',
        'Written on the back of a [[stall ticket]]: “no light 2 nights — Cold Room closing.”',
      ],
    },
    {
      id: 'gov', label: 'GOVERNOR', sub: 'one-page brief, Chief of Staff copy',
      lines: [
        'Frequency excursion at 03:12; system-wide [[trip]]; restoration in progress; sections [[islanded]].',
        'Two plants on diesel at [[attendant cost]]; three hospitals on generator. The opposition is calling it a failure of federal and state alike.',
        'Your derivation-linked [[remittance]] is unaffected; IGR collections will dip on [[estimated billing] complaints.',
      ],
    },
    {
      id: 'min', label: 'MINISTER', sub: 'regulator’s incident report, 2 pages',
      lines: [
        'Gas constraint at two plants; system operator reports [[grid collapse]]; [[tariff shortfall]] remains at the same level; the [[bulk trader]]’s [[receivables]] aging at 90 days.',
        'Distribution companies [[load rejection]] after restoration; system operator [[redispatch]] directive in force for 72 hours.',
      ],
    },
  ],
  glossary: {
    'trip': { gloss: 'the grid’s automatic self-disconnect when frequency wanders off 50Hz — a fuse, not a journey.', misread: 'a journey or a visit' },
    'petrol': { gloss: 'street price of a litre of petrol in the ward that week.', misread: 'a fixed official price' },
    '₦1,380': { gloss: 'what the filling station actually charges — above the official band that week.', misread: 'the government rate' },
    'stall ticket': { gloss: 'the market association’s daily levy receipt; it doubles as note paper.', misread: 'a licence to trade' },
    'islanded': { gloss: 'a section that kept running while cut off from the national network.', misread: 'evacuated to an island' },
    'attendant cost': { gloss: 'diesel and petrol burned by private generators while the grid is down.', misread: 'a cost the grid operator pays' },
    'remittance': { gloss: 'money the joint venture sends upstream — it can lag months.', misread: 'money already in the state account' },
    'estimated billing': { gloss: 'charging customers by estimate rather than meter — the fastest way to anger a feedertown.', misread: 'an accurate bill' },
    'grid collapse': { gloss: 'the national network falling to near-zero frequency, nationwide — not a local fault.', misread: 'a transformer that blew' },
    'tariff shortfall': { gloss: 'money the order promises generators per kWh that nobody has paid — the real story today.', misread: 'a discount for consumers' },
    'bulk trader': { gloss: 'the single company that buys power from generators and sells to distributors.', misread: 'a market trader' },
    'receivables': { gloss: 'bills sent but not paid; 90 days old means three months of IOUs.', misread: 'cash in hand' },
    'load rejection': { gloss: 'the grid refusing power it cannot carry.', misread: 'a light workload' },
    'redispatch': { gloss: 'an order to run different plants first to keep the system standing.', misread: 're-sending the same power twice' },
  },
  chain: [
    { step: 'TRUTH — frequency fell at 03:12; near zero for 41 minutes', lag: 't + 0', detail: 'sector state; no observer yet', minLiteracy: 4 },
    { step: 'MEASUREMENT — system operator log', lag: '+12 min', detail: 'automatic, accurate', minLiteracy: 3 },
    { step: 'STATE REGULATOR CLERK — incident note typed for the ministry', lag: '+1 day', detail: 'two lines dropped: the tariff-shortfall line', minLiteracy: 2 },
    { step: 'PERM SECRETARY — one-page summary; the receivables sentence removed', lag: '+2 days', detail: 'gatekeeper bias: bad news travels slow', minLiteracy: 1 },
    { step: 'YOUR DOCUMENT — what arrived on your desk', lag: '+3 days', detail: 'you are reading step 4, not step 1', minLiteracy: 0 },
  ],
  authority: 's.162 · sector lens (43.2)',
  authorityText: 'Federal power institutions are real; the lens decides what reaches your office, with lag, noise and gatekeeper bias (§43.2–43.3). Cutting the chain — a site visit, a second source — creates a second observation and shows the discrepancy.',
  recordId: 'SECTOR/POWER/2026/10/06',
  audit: ['06 Oct 2026 · 07:50 — lens assembly (phase 9c) · resolution: state · delay: 1 day', 'received with the Wednesday bundle'],
}

/* §36.5 — Spot the Tell: the red pen as a detective tool. */
export const TELL_PACK: TellDoc = {
  id: 'tell-pack',
  kind: 'tell',
  title: 'Committee bundle — three bids, one phone',
  trayLine: 'Mark the inconsistencies — a wrong mark costs you',
  stock: 'photo', clip: 'paperclip', stain: 'spatter', mark: 'fresh',
  date: '5 OCT 2026',
  docHead: 'SUB-COMMITTEE BUNDLE — OKPE ROAD DRAINAGE, THREE BIDS',
  brief: 'Circle what does not belong with red pen. Every mark must be defensible.',
  files: [
    {
      name: 'BID 1 — HALCYON MARINE & ESTATES LTD',
      lines: [
        { id: 'a1', text: 'Ref: OKP/DRN/2026/114-A' },
        { id: 'a2', text: 'Quoted sum: ₦1,377,540,000' },
        { id: 'a3', text: 'Date of bid: 29 September 2026' },
        { id: 'a4', text: 'Typing & contact: Grace Ventures, Tel 0803 441 7788', tell: true },
      ],
    },
    {
      name: 'BID 2 — NIGER DELTA DRAINAGE JOINT',
      lines: [
        { id: 'b1', text: 'Ref: OKP/DRN/2026/114-B' },
        { id: 'b2', text: 'Quoted sum: ₦1,371,206,000' },
        { id: 'b3', text: 'Date of bid: 29 September 2026' },
        { id: 'b4', text: 'Typing & contact: Grace Ventures, Tel 0803 441 7788', tell: true },
      ],
    },
    {
      name: 'BID 3 — BENEDICT O. & SONS CONCERN',
      lines: [
        { id: 'c1', text: 'Ref: OKP/DRN/2026/114-C' },
        { id: 'c2', text: 'Quoted sum: ₦1,380,115,000' },
        { id: 'c3', text: 'Date of bid: 30 September 2026' },
        { id: 'c4', text: 'Typing & contact: Grace Ventures, Tel 0803 441 7788', tell: true },
      ],
    },
  ],
  hitNote: 'Three bids, one typist, one phone — the cover story just cracked.',
  missNote: 'Wrong line. The committee notices; the innocent explain themselves twice; your hours are gone.',
  authority: 'Sixth Schedule · audit rules (20.3)',
  authorityText: 'A correct mark builds a Receipt (strength 35); a wrong mark wastes hours and can defame an innocent party — a legal and perception risk (§36.5).',
  recordId: 'COMMITTEE/OKP/2026/BIDS',
  audit: ['05 Oct 2026 · bundle printed at the secretariat', 'photocopy 2 of 2 — smells of toner'],
}

/* Question 3 — the 2027 presidential substitution moves off the desk sheet and
   onto an unlocked Abuja Scenario, so the calendar no longer contradicts. */
export const ABUJA_SCENARIO = {
  id: 'abuja',
  title: 'Abuja Scenario — the substitution',
  line: 'LOCKED — unlocks after one successful term',
  detail: 'Who the party sends to Abuja in 2027, and whether your zone is owed the slot. Not on this desk yet.',
}

/* Question 1 — first term, eighteen months in, 2027 general election 15 months out. */
export const TERM = {
  line: 'FIRST TERM · 18 MONTHS IN · POLL 15 MONTHS AWAY',
  monthsToElection: 15,
  note: 'Lose the election and the term ends there. One life, no reload.',
}
