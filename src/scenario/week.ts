/* MANDATE — the week's paper, composed from the scenario.
   One function builds the whole tray for whatever seat the player took: the cabinet minutes,
   the gazette, the allocation communiqué, the whip sheet, the ticket, the security digest,
   the labour letter, the dossier on the player, the summons, the clipping, the leaflet, the
   aide's note — plus the four assets on the allies, the handover note and the two teaching
   files. Every institution, place, name, figure and date comes from the scenario. */

import {
  formatNaira, nairaDisplay,
  SAPELE_AWARD_NAIRA, OKPE_VAR, NLC_TRANCH1, NLC_SUM_OUTSTANDING,
  FAAC_GROSS_DISTRIBUTED, FAAC_FEDERAL, FAAC_STATES, FAAC_LGPS, FAAC_DERIV_NATIONAL,
  FAAC_DEDUCTIONS, FAAC_VAT_DELTA, FAAC_DERIV_DELTA, FAAC_GROSS_DELTA,
  type Doc, type Decision, type Ally, type AssetDoc, type NoteDoc, type MinutesDoc,
  type GazetteDoc, type FaacDoc, type WhipDoc, type TableDoc, type SecurityDoc, type LetterDoc,
  type DossierDoc, type TribunalDoc, type ClippingDoc, type LeafletDoc, type SectorDoc, type TellDoc,
} from '../content'
import { postSectorBrief } from '../sectors'
import { revenueBrief, verticalFormulaLine } from '../revenue'
import { pressureBrief } from '../pressure'
import { careerBrief } from '../career'
import { principleBrief } from '../principles'
import { PAYROLL_ANCHOR_STAFF, payrollStaff } from './money'
import { PLACES } from './places'
import { recordId } from './derive'
import type { Pack, Scenario } from './types'

const caps = (x: string) => x.toUpperCase()

export function buildWeek(s: Scenario): Pack {
  const w = s.w
  const cal = s.calendar
  const fmt = formatNaira
  const money = (n: number) => Math.round(n * s.money.scale)
  const award = money(SAPELE_AWARD_NAIRA)
  const roadVar = money(OKPE_VAR)
  const tranche1 = money(NLC_TRANCH1)
  const arrears = money(NLC_SUM_OUTSTANDING)
  const staff = payrollStaff(s.lgaCount ?? 0) || PAYROLL_ANCHOR_STAFF
  const hasOil = Boolean(s.stateCode && PLACES[s.stateCode]?.oil) || s.tier === 'federal'
  const lgaOrSeat = s.lgaName ?? s.seat
  const isCouncil = s.tier === 'local'
  const roadsName = isCouncil ? `${lgaOrSeat} road` : w.road
  const marketName = isCouncil ? `${lgaOrSeat} Market` : w.market
  const auditStd = [
    `${cal.shortDate} · 06:40 — assembled (desk phase 9) from events #4471–#4488`,
    `${cal.shortDate} · 06:41 — delivered to the in-tray · visibility: private`,
  ]

  /* ---------- 1. the cabinet minutes ---------- */
  const minutes: MinutesDoc = {
    id: 'cabinet-minutes',
    kind: 'minutes',
    title: `${w.cabinetShort} Minutes — ${cal.shortDate}`,
    trayLine: w.cabinetTrayLine,
    stock: 'lined', clip: 'binder', stain: 'ring', mark: 'urgent',
    date: cal.shortDate,
    head: ['MINUTES —', w.cabinet, cal.shortDate],
    items: [
      { n: 1, text: `${w.union} threat — offer 12% salary adjustment?` },
      { n: 2, text: `${w.worksOfficer} (Agoro) likely defecting to NRA — call 8pm.` },
      { n: 3, text: `${w.allocation} shortfall: ${fmt(s.money.shortfall)}.` },
      { n: 4, text: `${roadsName} protest — deploy task force?` },
    ],
    sketch: true,
    authority: w.cabinetAuthority,
    authorityText: w.cabinetAuthorityText,
    recordId: recordId(s, w.cabinetShort.replace(/\s+/g, '')),
    audit: auditStd,
  }

  /* ---------- 2. the gazette the desk wants stamped ---------- */
  const gazetteSubject = s.tier === 'federal'
    ? `${s.towns[0] ?? 'the trunk'} road rehabilitation`
    : `${marketName} renovation`
  const gazetteNo = 147
  const gazette: GazetteDoc = {
    id: 'gazette-site',
    kind: 'gazette',
    title: `Gazette No. ${gazetteNo} — ${s.tier === 'federal' ? s.towns[0] ?? 'Trunk Road' : marketName}`,
    trayLine: `Sign before ${w.allocation} drops — ${fmt(award)}`,
    stock: 'memo', clip: 'paperclip', stain: 'spatter', mark: 'urgent',
    date: cal.shortDate,
    fedHead: s.tier === 'federal' ? 'FEDERAL REPUBLIC OF NIGERIA' : caps(s.jurisdictionShort) === 'FEDERATION' ? 'FEDERAL REPUBLIC OF NIGERIA' : `GOVERNMENT OF ${caps(s.stateName ?? s.lgaName ?? 'THE FEDERATION')}`,
    gazetteLine: `— OFFICIAL GAZETTE No. ${gazetteNo}`,
    memoDate: cal.shortDate,
    memorandum: `MEMORANDUM: ${gazetteSubject.charAt(0).toUpperCase() + gazetteSubject.slice(1)}.`,
    appropriation: `Appropriation: ${fmt(award)}.`,
    authorityPara: 'Authority: Section 162, Constitution of the Federal Republic of Nigeria 1999 (as amended).',
    faacLine: `${w.allocationFull} shortfall noted.`,
    note: `urgent — sign before ${w.allocation} drops`,
    footer: `DOCUMENT VALID · RECORD ID: ${recordId(s, `${gazetteNo}/${s.jurisdictionShort.slice(0, 3)}`)}`,
    signName: s.shortName,
    role: w.gazetteRole,
    authority: 's.162',
    authorityText: 'Section 162 — the Federation Account: revenues paid in and distributed, including the 13% derivation on the margin. The memo cites it because this is public money moving through your hands.',
    recordId: recordId(s, `${gazetteNo}/SIGN`),
    audit: [...auditStd, `${cal.shortDate} · 06:41 — red-pen note applied by the ${w.chiefOfStaff}`],
  }

  /* ---------- 3. the allocation communiqué, read from your own tier ---------- */
  const allocationLines: FaacDoc['lines'] = [
    { label: 'GROSS DISTRIBUTED (FEDERATION ACCOUNT)', value: fmt(FAAC_GROSS_DISTRIBUTED), strong: true, rule: true },
    { label: '— Federal Government (as published)', value: fmt(FAAC_FEDERAL), indent: true },
    { label: '— States (as published)', value: fmt(FAAC_STATES), indent: true },
    { label: '— Local Councils (via Joint Account)', value: fmt(FAAC_LGPS), indent: true },
    { label: '— 13% Derivation (oil-mineral states)', value: fmt(FAAC_DERIV_NATIONAL), indent: true },
  ]
  /* The receiver's block, derived at this seat's scale. The three published parts keep the
     anchor's own proportions (so gross − deductions = the net that reached the treasury, at
     every tier), and the 13% derivation appears only for an oil-mineral seat (s.162(2)):
     a seat without derivation sees the nil line and a larger statutory share, which is what
     the constitution actually does. */
  const deductions = money(FAAC_DEDUCTIONS)
  const grossHere = s.money.rows[0].amount + deductions
  const vatShare = Math.round(grossHere * (FAAC_VAT_DELTA / FAAC_GROSS_DELTA))
  const derivShare = Math.round(grossHere * (FAAC_DERIV_DELTA / FAAC_GROSS_DELTA))
  const receivesDerivation = hasOil || s.tier === 'federal'
  const statShare = grossHere - vatShare - (receivesDerivation ? derivShare : 0)
  const receiverLabel = s.tier === 'federal'
    ? 'FEDERATION — FEDERAL GOVERNMENT SHARE'
    : s.tier === 'fct'
      ? `FEDERAL CAPITAL TERRITORY — ${cal.monthLabel}`
      : s.tier === 'local'
        ? `${caps(lgaOrSeat)} — JOINT ACCOUNT (JAAC)`
        : `${caps(s.stateName ?? 'STATE')} STATE — ${cal.monthLabel}`
  allocationLines.push(
    { label: receiverLabel, value: '', strong: true, rule: true },
    { label: 'Statutory allocation', value: fmt(statShare), indent: true },
    { label: 'VAT share', value: fmt(vatShare), indent: true },
    receivesDerivation
      ? { label: '13% Derivation tranche', value: fmt(derivShare), indent: true }
      : { label: '13% Derivation', value: 'nil — this seat is not an oil-mineral one', indent: true },
    { label: 'Gross share', value: fmt(grossHere), indent: true },
    { label: 'Deductions at source (loan & bailout repayments)', value: '–' + nairaDisplay(deductions), indent: true },
    { label: 'NET TO TREASURY', value: fmt(s.money.rows[0].amount), strong: true, rule: true },
    { label: 'Projection (net + shortfall)', value: fmt(s.money.rows[0].amount + s.money.shortfall), indent: true },
    { label: 'SHORTFALL AGAINST PROJECTION', value: '–' + nairaDisplay(s.money.shortfall), strong: true },
  )
  const allocation: FaacDoc = {
    id: 'allocation-communique',
    kind: 'faac',
    title: `${w.allocation === 'FAAC' ? 'FAAC' : s.tier === 'local' ? 'JAAC' : 'Allocation'} Communiqué — ${cal.prevMonth}`,
    trayLine: `${w.allocationFull} — what reached your treasury`,
    stock: 'ledger', clip: 'none', stain: 'ring', mark: 'opened',
    date: cal.shortDate,
    docHead: s.tier === 'local' ? 'JOINT ACCOUNT ALLOCATION COMMITTEE' : 'FEDERATION ACCOUNT ALLOCATION COMMITTEE',
    lines: allocationLines,
    foot: `Collated in ${s.seat} from the FAAC communiqué of the ${cal.prevMonth} meeting. Figures carried to the naira; the gap is the gap.`,
    authority: 's.162 · 13% derivation',
    authorityText: 'Section 162(1)–(10): revenue paid into the Federation Account and distributed on the approved basis; the 13% derivation for oil-mineral producing states (s.162(2)); the joint account for the third tier (s.162(6)). Your seat lives on one of these lines.',
    recordId: `FAAC/${cal.year}/09/${s.jurisdictionShort.slice(0, 6)}`,
    audit: auditStd,
  }

  /* ---------- 4. the whip sheet on the amendment ---------- */
  const seats = s.tier === 'federal' ? 109 + 360 : s.tier === 'fct' ? 3 : (s.lgaCount ?? PLACES[s.stateCode ?? '']?.councils ?? 25)
  const firm = Math.max(2, Math.round(seats * 0.55))
  const leaning = Math.max(1, Math.round(seats * 0.17))
  const hardNo = s.tier === 'local' ? 2 : 0
  const unmarked = Math.max(1, seats - firm - leaning - hardNo)
  const whip: WhipDoc = {
    id: 'ratification-whip',
    kind: 'whip',
    title: 'Whip Sheet — Sixth Alteration',
    trayLine: 'Ratification count — how your bloc stands',
    stock: 'memo', clip: 'none', stain: 'none', mark: 'fresh',
    date: cal.shortDate,
    docHead: `WHIP SHEET — ${w.chamber}`,
    counts: [
      { label: 'FIRM — YEA', value: String(firm) },
      { label: 'LEANING — YEA', value: String(leaning) },
      { label: 'UNMARKED', value: String(unmarked) },
      { label: 'HARD NO', value: String(hardNo) },
      { label: 'NATIONAL PICTURE', value: '12 passed · 6 awaiting · 18 not called (24 needed)' },
    ],
    bullets: [
      `The Clerk wants a date in plenary. The count across the country closes Friday.`,
      w.whipHoldouts,
      `Your word decides ${Math.min(3, unmarked)} of the ${unmarked} unmarked.`,
    ],
    foot: `${w.chamberShort} · internal · not for press.`,
    authority: w.whipAuthority,
    authorityText: w.whipAuthorityText,
    recordId: `${s.jurisdictionShort.slice(0, 6)}/ALTER6/WHIP`,
    audit: auditStd,
  }

  /* ---------- 5. the ticket (or the slate) ---------- */
  const ticket: TableDoc = {
    id: 'running-mate',
    kind: 'table',
    title: w.ticketTitle,
    trayLine: 'Who balances it — zone, faith, machine, money, baggage',
    stock: 'photo', clip: 'paperclip', stain: 'spatter', mark: 'opened',
    date: cal.shortDate,
    docHead: w.ticketTitle,
    subHead: w.ticketSubHead,
    columns: ['Zone', 'Faith', 'Machine', 'Money', 'Baggage'],
    rows: w.ticketRows.map(r => [r[0], r[1], r[2], r[3], r[4]]),
    checkRow: 2,
    circleCol: 2,
    redNote: w.ticketRedNote,
    authority: 'n/a — party paper',
    authorityText: w.ticketAuthorityText,
    recordId: `PARTY/${cal.year}/TICKET/${s.jurisdictionShort.slice(0, 3)}`,
    audit: [...auditStd, `received under the door, 07:10 — sender unrecorded`],
  }

  /* ---------- 6. the security digest ---------- */
  const digestPlaces = [s.towns[0] ?? s.seat, s.towns[2] ?? s.seat, s.towns[1] ?? s.seat]
  const securityItems: SecurityDoc['items'] = [
    {
      head: `${caps(roadsName)} PROTEST — ${caps(s.towns[0] ?? s.seat)}`,
      body: `About 400 traders and riders blocked ${roadsName} from 06:10. No violence, no damage. Traffic diverted. Organisers: the market association plus two youth groups. Demand: drainage cleared, the ${cal.year - 2} feeder-road promise honoured. No dispersal requested by the council.`,
    },
    {
      head: `${caps(digestPlaces[1])} — RIVAL GROUPS`,
      body: 'Campus-linked groups clashed Tuesday night; two injured, three arrested, no firearms recovered. Remanded. Families at the hospital; the ward head convenes elders at 16:00.',
    },
    hasOil
      ? { head: 'PIPELINE — TRUNKLINE', body: 'Attempted vandalism on the trunk line; the Joint Task Force responded, two suspects in custody, no leak recorded.' }
      : { head: 'TRUNK ROAD — TANKER INCIDENT', body: 'A loaded tanker overturned at the junction on Tuesday; no fire, no fatality, the road was closed for four hours. The hauliers are blaming the shoulder, the shoulder is blaming the rain.' },
    {
      head: 'FLOOD WATCH (NIMET ADVISORY)',
      body: `Rainfall peak expected ${cal.floodWindow}. Low-lying wards advised; two camps readied.`,
    },
    {
      head: `GATE MARCH — ${caps(w.union)}`,
      body: 'Peaceful march of 60–80 members to the main gate; no clash; management receives the union Thursday.',
    },
  ]
  const security: SecurityDoc = {
    id: 'security-digest',
    kind: 'security',
    title: `Security Digest — Week ${cal.weekNumber}`,
    trayLine: `RESTRICTED — ${s.towns[0] ?? s.seat}, ${digestPlaces[1]}, flood watch`,
    stock: 'memo', clip: 'binder', stain: 'none', mark: 'fresh',
    date: cal.shortDate,
    docHead: `${w.digestHead} — WEEK ${cal.weekNumber}/${cal.year} — RESTRICTED`,
    items: securityItems,
    foot: `${w.securityFoot}. Copies: ${w.chiefOfStaff}, ${w.attorney}, ${w.policeHead} (courtesy).`,
    authority: 'ss.214–216 · convention',
    authorityText: s.tier === 'local'
      ? 'The Police Force is federal (s.214) and its local arm answers to a DPO, not to you. You may ask, fund and coordinate — you may not deploy the Force.'
      : 'The Police Force is federal (s.214). You are chief security officer by convention, not by command: you may ask, fund and coordinate — you may not deploy the Force.',
    recordId: `DSS/${s.jurisdictionShort.slice(0, 4)}/${cal.year}/W${cal.weekNumber}`,
    audit: auditStd,
  }

  /* ---------- 7. the labour letter ---------- */
  const labour: LetterDoc = {
    id: 'labour-letter',
    kind: 'letter',
    title: `${w.union} Letter — Arrears`,
    trayLine: `Consequential adjustment: ${fmt(arrears)} · window closes ${cal.deadlines[1].date}`,
    stock: 'letterhead', clip: 'none', stain: 'coffee', mark: 'opened',
    date: cal.letterDate,
    letterhead: w.unionPaper,
    to: `The ${w.officeTitle}, ${s.seat}.`,
    subject: 'RE: CONSEQUENTIAL ADJUSTMENT ARREARS',
    paras: [
      `Your office, the union met on ${cal.letterDate} ${cal.year} and reviewed the payment schedule. It finds that the consequential adjustment for grade levels 07–14 remains unpaid after twenty-five months.`,
      `The sum outstanding, computed from the payroll desk, is ${fmt(arrears)} covering ${staff.toLocaleString('en-NG')} ${isCouncil ? 'school staff' : 'workers'} across ${isCouncil ? 'the council' : `${s.lgaCount ?? 'the'} council areas`} and the service.`,
      `We note the shortfall in the ${cal.prevMonth.toLowerCase()} ${w.allocation} and the many calls on the wage bill. We nevertheless ask for two tranches: ${fmt(tranche1)} on or before ${cal.deadlines[1].date}, and the balance with next month's salaries.`,
      `We would rather negotiate than close our offices. The window closes on ${cal.deadlines[1].date}.`,
    ],
    signName: `Comrade ${s.w.tier === 'federal' ? 'B. A. Yusuf' : 'A. O. Bakare'}`,
    signTitle: w.unionSignatory,
    dateLine: `${cal.letterDate} ${cal.year}`,
    authority: 'n/a — correspondence',
    authorityText: 'Not an instrument of state. Leverage: the Labour Act (collective bargaining) and your obligation as employer. A letter that becomes a strike notice with one signature.',
    recordId: `NLC/${s.jurisdictionShort.slice(0, 4)}/${cal.year}/CA-14`,
    audit: auditStd,
  }

  /* ---------- 8. the dossier somebody keeps on you ---------- */
  const dossier: DossierDoc = {
    id: 'rival-dossier',
    kind: 'dossier',
    title: 'Dossier fragment — on YOU',
    trayLine: 'Photocopy. Somebody is keeping a file.',
    stock: 'photo', clip: 'paperclip', stain: 'spatter', mark: 'urgent',
    date: cal.shortDate,
    subject: `EXTRACT — FILE DG/7/${String(cal.year).slice(2)} — SUBJECT: “${s.initials}”`,
    lines: [
      { label: 'Promise record (own tally)', value: '41 made · 17 kept · 12 delayed · 12 dead' },
      { label: `${marketName} award`, value: `${fmt(award)} — direct; Halcyon Marine & Estates Ltd (brother-in-law on the 2023 filing)` },
      { label: `${roadsName} variation`, value: `${fmt(roadVar)} — signature on W2; threshold pattern` },
      { label: 'Political class — Price', value: '58 → 64 (rising)', pencil: true },
      { label: 'Political class — Reliability', value: '47', pencil: true },
      { label: 'The People — Closeness', value: '61 → 52 (since June)', pencil: true },
    ],
    whispers: [
      `The ${w.worksOfficer} is shopping an NRA ticket. He has read this file.`,
      'Copy 2 of 3 — watermark not removed.',
    ],
    margin: 'who else has this?',
    authority: 'n/a — seized fragment',
    authorityText: 'Informal until someone files it. Filed in a petition it becomes an exhibit; leaked it becomes a story. Reference: Fifth Schedule (declaration) and Sixth Schedule (tribunal exhibits).',
    recordId: `LEAK/DG7/${cal.year}/COPY2`,
    audit: [`${cal.shortDate} · 05:52 — slipped under the kitchen door, ${s.seat} residence`, 'source unknown · visibility: sealed (nominally)'],
  }

  /* ---------- 9. the summons (elected) or the mandate (appointed) ---------- */
  const constituency = `${s.towns[2] ?? s.seat} I`
  const tribunal: TribunalDoc = s.tier === 'federal'
    ? {
      id: 'tribunal-summons', kind: 'tribunal',
      title: 'Petition — Presidential Election', trayLine: 'PETITION No. CA/PEPC/2026/03 — you are the 2nd respondent',
      stock: 'form', clip: 'binder', stain: 'ring', mark: 'urgent', date: cal.shortDate,
      docHead: 'IN THE PRESIDENTIAL ELECTION PETITION COURT HOLDEN AT ABUJA',
      caseNo: 'PETITION No. CA/PEPC/2026/03',
      parties: [
        { role: 'PETITIONER', name: 'Sen. D. O. Akande' },
        { role: '1ST RESPONDENT', name: 'INEC' },
        { role: '2ND RESPONDENT', name: `${s.player} — declared winner` },
      ],
      grounds: [
        'Over-voting alleged in three states — 1,842 of 9,117 votes challenged in one ward.',
        'Non-compliance: results uploaded late in fourteen local councils; forms withheld.',
        'Witnesses marked: 22. Four have withdrawn since filing.',
      ],
      relief: 'Relief sought: the election declared void and a fresh poll ordered.',
      listing: `PRE-HEARING CONFERENCE — ${cal.deadlines[0].date} ${cal.year}, 10:00 — COURTROOM 1, ABUJA.`,
      stampText: 'SUMMONS',
      authority: 'Sixth Schedule · s.285',
      authorityText: 'Election Tribunals and the Presidential Election Petition Court — Sixth Schedule (jurisdiction, practice, procedure) and s.285. The petition does not care that you are President.',
      recordId: `PEPC/${cal.year}/03/R2`, audit: [...auditStd],
    }
    : s.tier === 'local'
      ? {
        id: 'tribunal-summons', kind: 'tribunal',
        title: `Petition — ${s.lgaName ?? 'Council'} Chair`, trayLine: `PETITION No. EPT/LGC/${cal.year}/02 — you are joined as 3rd respondent`,
        stock: 'form', clip: 'binder', stain: 'ring', mark: 'urgent', date: cal.shortDate,
        docHead: `IN THE STATE ELECTION TRIBUNAL HOLDEN AT ${caps(s.capital ?? s.seat)}`,
        caseNo: `PETITION No. EPT/LGC/${cal.year}/02`,
        parties: [
          { role: 'PETITIONER', name: `Hon. ${s.towns[1] ?? '—'} ward candidate` },
          { role: '1ST RESPONDENT', name: 'The State Electoral Commission' },
          { role: '2ND RESPONDENT', name: 'The Council Returning Officer' },
          { role: '3RD RESPONDENT (JOINED)', name: `${s.player} — the declared chairman` },
        ],
        grounds: [
          `Over-voting alleged in ${constituency} — 1,842 of 9,117 votes challenged.`,
          'Non-compliance: six of fourteen units opened after 08:30 without explanation.',
          'Witnesses marked: 22. Four have withdrawn since filing.',
        ],
        relief: 'Relief sought: the return declared void and a fresh council election ordered.',
        listing: `PRE-HEARING CONFERENCE — ${cal.deadlines[0].date} ${cal.year}, 10:00 — TRIBUNAL HALL, ${caps(s.capital ?? s.seat)}.`,
        stampText: 'SUMMONS',
        authority: 's.7 · Sixth Schedule · s.285',
        authorityText: 'Council election petitions run on the same rules: the Sixth Schedule and s.285. Funding a ward campaign makes you a respondent, not a spectator.',
        recordId: `EPT/LGC/${cal.year}/02/J3`, audit: [...auditStd],
      }
      : {
        id: 'tribunal-summons', kind: 'tribunal',
        title: `Tribunal Summons — ${constituency}`,
        trayLine: `Petition EPT/${s.jurisdictionShort.slice(0, 4)}HA/${cal.year}/07 — you are joined as 3rd respondent`,
        stock: 'form', clip: 'binder', stain: 'ring', mark: 'urgent', date: cal.shortDate,
        docHead: `IN THE STATE ELECTION TRIBUNAL HOLDEN AT ${caps(s.capital ?? s.seat)}`,
        caseNo: `PETITION No. EPT/${s.jurisdictionShort.slice(0, 4)}HA/${cal.year}/07`,
        parties: [
          { role: 'PETITIONER', name: 'Hon. P. E. Uboh' },
          { role: '1ST RESPONDENT', name: 'INEC' },
          { role: '2ND RESPONDENT', name: 'Hon. R. O. Igho' },
          { role: '3RD RESPONDENT (JOINED)', name: `${s.player} — funding witness` },
        ],
        grounds: [
          `Over-voting alleged in ${constituency} — 1,842 of 9,117 votes challenged.`,
          'Non-compliance: six of fourteen units opened after 08:30 without explanation; Forms EC8A withheld.',
          'Witnesses marked: 22. Four have withdrawn since filing.',
        ],
        relief: `Relief sought: the seat declared vacant and a fresh election ordered in ${constituency}.`,
        listing: `PRE-HEARING CONFERENCE — ${cal.deadlines[0].date} ${cal.year}, 10:00 — TRIBUNAL HALL, ${caps(s.capital ?? s.seat)}. Subpoena for the funding record attached.`,
        stampText: 'SUMMONS',
        authority: 'Sixth Schedule · s.285',
        authorityText: 'Election Tribunals — Sixth Schedule (jurisdiction, practice, procedure) and s.285 (establishment). Your name is on the funding line; the paper does not care that you are Governor.',
        recordId: `EPT/${s.jurisdictionShort.slice(0, 4)}HA/${cal.year}/07/J3`, audit: [...auditStd],
      }
  const mandate: NoteDoc = {
    id: 'mandate-note',
    kind: 'note',
    title: 'Note from the President — your mandate',
    trayLine: 'What you were sent to do, in his words',
    stock: 'pad', clip: 'none', stain: 'ring', mark: 'urgent',
    date: cal.shortDate,
    from: 'THE PRESIDENCY',
    re: 'YOUR MANDATE',
    lines: [
      `You were appointed to administer the territory, not to campaign in it. Land titles, the master plan and the area councils: those three, in that order.`,
      `The six councils are to be audited before the next allocation. Nobody is to be embarrassed; everybody is to be told.`,
      `The ${w.worksOfficer} answers to you and to the ministry. When the two disagree, you carry it to me.`,
      `Serve well and the appointment becomes a career. Serve loudly and it becomes a memory.`,
    ],
    authority: 's.299 · appointment',
    authorityText: 'The territory is administered by the President through a Minister (s.299). Your authority is delegated, revocable, and only as wide as the instrument that created it.',
    recordId: recordId(s, 'MANDATE'),
    audit: [`${cal.shortDate} · 07:20 — delivered by hand from the Villa`],
  }

  /* ---------- 10. the clipping ---------- */
  const clipping: ClippingDoc = {
    id: 'clipping-labour',
    kind: 'clipping',
    title: `Clipping — ${w.union} ultimatum`,
    trayLine: `Daily Sentinel — talks stall over 12% offer`,
    stock: 'newsprint', clip: 'none', stain: 'coffee', mark: 'opened',
    date: cal.shortDate,
    outlet: `DAILY SENTINEL · LAGOS · ${cal.dayLine} · ₦300`,
    kicker: 'INDUSTRIAL RELATIONS',
    headline: `${w.union} gives 7 days on 12% offer as talks stall`,
    byline: `Staff Reporter, ${s.seat}`,
    paras: [
      `The union has given ${isCouncil ? 'the council' : 'the government'} until ${cal.deadlines[0].date} to improve an offer of a 12 per cent salary adjustment, adjourning talks after four hours at ${w.seatNoun} on Wednesday.`,
      `The team, led by the ${w.educationOfficer}, said the offer was the best possible against a shortfall of ${nairaDisplay(s.money.shortfall)} in the month's ${w.allocation}. Union leaders said members were still owed the consequential adjustment due since 2024 and would consult chapters on Friday.`,
    ],
    briefs: [
      `— Council chairmen meet on the autonomy clause, Friday.`,
      `— Naira steadies near ₦1,331/$ as reserves hold near $55bn.`,
    ],
    authority: 'n/a — press',
    authorityText: 'Press cutting. Outlet reach and bias feed the perception mirrors; it carries no constitutional weight, only consequences.',
    recordId: `PRESS/DS/${cal.year}/${cal.weekNumber}/A3`,
    audit: auditStd,
  }

  /* ---------- 11. the opposition's leaflet ---------- */
  const leaflet: LeafletDoc = {
    id: 'nra-leaflet',
    kind: 'leaflet',
    title: 'Rally leaflet (torn)',
    trayLine: `NRA — Renewal Rally, ${w.rallyTown}, Sat`,
    stock: 'newsprint', clip: 'none', stain: 'none', mark: 'forwarded',
    date: cal.shortDate,
    party: 'NATIONAL RENEWAL ALLIANCE (NRA)',
    colorA: '#1F5D3A',
    colorB: '#D8A12E',
    event: 'THE RENEWAL RALLY',
    when: 'SATURDAY, 10:00 AM',
    where: `${caps(w.stadium)}`,
    lines: [
      'Security. Naira. Tomorrow.',
      'Buses and refreshments leave from the ward secretariat at 8:00 — bring your PVC.',
    ],
    smear: `Ask ${s.tier === 'federal' ? 'the President' : s.tier === 'state' ? 'the Governor' : s.tier === 'fct' ? 'the Minister' : 'the Chairman'} where the ${fmt(award)} went.`,
    authority: 'n/a — campaign literature',
    authorityText: 'Campaign season runs on the Electoral Act; the timetable for each tier is set by the commission that conducts it. Spend rules bite on the campaign account, not the rally.',
    recordId: `LEAFLET/NRA/${s.jurisdictionShort.slice(0, 3)}/1110`,
    audit: ['picked off the road at the roundabout', 'folded twice — forwarded to the campaign file'],
  }

  /* ---------- 12. the aide's note ---------- */
  const aideNote: NoteDoc = {
    id: 'aide-note',
    kind: 'note',
    title: `Note from the ${w.chiefOfStaff}`,
    trayLine: 'RE: the 8pm call — he is not picking.',
    stock: 'pad', clip: 'none', stain: 'ring', mark: 'urgent',
    date: cal.shortDate,
    from: 'A. N. W.',
    re: '8PM CALL — WORKS',
    lines: [
      'Felix is not picking. His SA says two men from Kano landed yesterday — NRA ticket people.',
      'Do not sign anything else from Works until we know. The gazette file is with the solicitor for clearance anyway.',
      'Protocol holds the 8pm slot. Say the word and I move it to Friday.',
    ],
    authority: 'n/a — aide note',
    authorityText: 'Private. Visibility: private. It becomes Evidence only if it is leaked, subpoenaed or photographed by somebody with a phone.',
    recordId: `AIDE/${cal.year}/${cal.weekNumber}/NOTE3`,
    audit: [`${cal.shortDate} · 06:55 — written in biro, handed over the desk`],
  }

  /* ---------- 13. the handover note ---------- */
  const handover: NoteDoc = {
    id: 'handover',
    kind: 'note',
    title: 'Handover Note',
    trayLine: 'From the outgoing aide — read before you touch anything',
    stock: 'pad', clip: 'none', stain: 'ring', mark: 'urgent',
    date: cal.shortDate,
    from: 'G.O. — outgoing aide',
    re: 'HANDOVER — YOUR FIRST WEEK',
    lines: [
      `You hold ${w.officeTitle}. ${s.elected ? s.term.line.split(' · ').slice(0, 2).join(' · ') + '.' : `Appointed ${s.term.monthsInOffice} months ago; the appointment is reviewed, not voted.`}`,
      `Two items expire soon: ${cal.deadlines[0].label} on ${cal.deadlines[0].date}, the ${cal.deadlines[1].label.toLowerCase()} on ${cal.deadlines[1].date}. The gazette wants your stamp; the ${w.allocation} shortfall is real.`,
      `The treasury opened the month with ${fmt(s.money.opening)} — about one week of payroll. The wage bill eats most of the ${w.allocation}.`,
      `You have 14 Desk Hours this week. Every action burns some — spend them like money, because on Friday they are gone.`,
      `Nothing irreversible is a tap. Hold the stamp, hold the decision — the circle fills, then it lands. One life, no reload.`,
      `Tap the ℹ on any file to see the section of the Constitution it leans on. Pencil figures are estimates; printed figures are facts.`,
      `The dictionary is on the shelf. Ask me nothing — I am no longer on the payroll.`,
    ],
    authority: 'n/a — handover note',
    authorityText: 'Conventions of the office, not law. Filed with your service record on day one and kept forever.',
    recordId: recordId(s, 'HANDOVER'),
    audit: [`${cal.shortDate} · 18:40 — left on the desk with the keys`],
  }

  /* ---------- 14. the teaching files: sector brief + spot the tell ---------- */
  const sector: SectorDoc = {
    id: 'sector-brief',
    kind: 'sector',
    title: 'Sector Brief — the grid collapsed',
    trayLine: 'One event, three desks — who dropped which line',
    stock: 'form', clip: 'binder', stain: 'ring', mark: 'fresh',
    date: cal.shortDate,
    docHead: 'SECTOR BRIEF — POWER — NATIONAL GRID EVENT',
    event: `Monday ${cal.shortDate}, 03:12 — system-wide trip; restoration by 05:40.`,
    desks: [
      {
        id: 'ward', label: 'WARD EXCO', sub: 'a voice note in the market group',
        lines: [
          '“Light don go since Sunday night. Fish for freezer don spoil. Generator [[petrol]] na [[₦1,380]] a litre. Dem say na [[trip]] but everybody don sleep.” — market woman, 06:14',
          'Written on the back of a [[stall ticket]]: “no light 2 nights — Cold Room closing.”',
        ],
      },
      {
        id: 'gov', label: caps(w.cabinetShort), sub: 'one-page brief, to the aide',
        lines: [
          'Frequency excursion at 03:12; system-wide [[trip]]; restoration in progress; sections [[islanded]].',
          'Two plants on diesel at [[attendant cost]]; three hospitals on generator. The opposition is calling it a failure of federal and state alike.',
          `${s.tier === 'local' ? 'The council’s share of the joint account is unaffected; rates collection will dip.' : 'Your [[remittance]] is unaffected; IGR collections will dip on [[estimated billing]] complaints.'}`,
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
      'remittance': { gloss: 'money the joint venture sends upstream — it can lag months.', misread: 'money already in the account' },
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
      { step: 'REGULATOR CLERK — incident note typed for the ministry', lag: '+1 day', detail: 'two lines dropped: the tariff-shortfall line', minLiteracy: 2 },
      { step: 'PERM SECRETARY — one-page summary; the receivables sentence removed', lag: '+2 days', detail: 'gatekeeper bias: bad news travels slow', minLiteracy: 1 },
      { step: 'YOUR DOCUMENT — what arrived on your desk', lag: '+3 days', detail: 'you are reading step 4, not step 1', minLiteracy: 0 },
    ],
    authority: 's.162 · sector lens (43.2)',
    authorityText: 'Federal power institutions are real; the lens decides what reaches your office, with lag, noise and gatekeeper bias (§43.2–43.3). Cutting the chain — a site visit, a second source — creates a second observation and shows the discrepancy.',
    recordId: `SECTOR/POWER/${cal.year}/${cal.weekNumber}`,
    audit: [`${cal.shortDate} · 07:50 — lens assembly (phase 9c) · resolution: state · delay: 1 day`, 'received with the Wednesday bundle'],
  }

  const bidRef = `${s.jurisdictionShort.slice(0, 3)}/DRN/${cal.year}/114`
  const tell: TellDoc = {
    id: 'tell-pack',
    kind: 'tell',
    title: 'Committee bundle — three bids, one phone',
    trayLine: 'Mark the inconsistencies — a wrong mark costs you',
    stock: 'photo', clip: 'paperclip', stain: 'spatter', mark: 'fresh',
    date: cal.shortDate,
    docHead: `SUB-COMMITTEE BUNDLE — ${caps(roadsName)} DRAINAGE, THREE BIDS`,
    brief: 'Circle what does not belong with red pen. Every mark must be defensible.',
    files: [
      {
        name: 'BID 1 — HALCYON MARINE & ESTATES LTD',
        lines: [
          { id: 'a1', text: `Ref: ${bidRef}-A` },
          { id: 'a2', text: `Quoted sum: ${fmt(roadVar)}` },
          { id: 'a3', text: `Date of bid: 29 September ${cal.year}` },
          { id: 'a4', text: 'Typing & contact: Grace Ventures, Tel 0803 441 7788', tell: true },
        ],
      },
      {
        name: 'BID 2 — RIVERINE DRAINAGE JOINT',
        lines: [
          { id: 'b1', text: `Ref: ${bidRef}-B` },
          { id: 'b2', text: `Quoted sum: ${fmt(Math.round(roadVar * 0.995))}` },
          { id: 'b3', text: `Date of bid: 29 September ${cal.year}` },
          { id: 'b4', text: 'Typing & contact: Grace Ventures, Tel 0803 441 7788', tell: true },
        ],
      },
      {
        name: 'BID 3 — BENEDICT O. & SONS CONCERN',
        lines: [
          { id: 'c1', text: `Ref: ${bidRef}-C` },
          { id: 'c2', text: `Quoted sum: ${fmt(Math.round(roadVar * 1.002))}` },
          { id: 'c3', text: `Date of bid: 30 September ${cal.year}` },
          { id: 'c4', text: 'Typing & contact: Grace Ventures, Tel 0803 441 7788', tell: true },
        ],
      },
    ],
    hitNote: 'Three bids, one typist, one phone — the cover story just cracked.',
    missNote: 'Wrong line. The committee notices; the innocent explain themselves twice; your hours are gone.',
    authority: 'Sixth Schedule · audit rules (20.3)',
    authorityText: 'A correct mark builds a Receipt (strength 35); a wrong mark wastes hours and can defame an innocent party — a legal and perception risk (§36.5).',
    recordId: `COMMITTEE/${s.jurisdictionShort.slice(0, 3)}/${cal.year}/BIDS`,
    audit: [`${cal.shortDate} · bundle printed at ${w.seatNoun}`, 'photocopy 2 of 2 — smells of toner'],
  }

  /* ---------- the tray ---------- */
  const docs: Doc[] = [
    minutes, gazette, allocation, whip, ticket, security, labour, dossier,
    s.tier === 'fct' ? mandate : tribunal,
    clipping, leaflet, aideNote,
  ]

  /* ---------- the decisions that ride on them ---------- */
  const decisions: Decision[] = [
    {
      id: 'labour', docId: clipping.id,
      question: `${w.union} — what do you offer by Friday?`,
      hours: 2,
      deadline: `DEADLINE — ${cal.deadlines[0].date} · BALLOT FRIDAY`,
      options: [
        {
          key: '12', label: 'Offer 12% now',
          sub: 'Union suspends · Treasury ' + fmt(-Math.round(2_100_000_000 * s.money.scale)) + ' · Public +5',
          ledger: 'writes: promises kept · public goods · ₦ cost on the wage bill',
          marg: 'lawful · open · public · fast', level: 3,
        },
        {
          key: '8', label: 'Offer 8% + arrears in two tranches',
          sub: 'Talks continue · the unions watch',
          ledger: 'writes: promise (delayed) · structural debt · grudges small',
          marg: 'lawful · quiet · formal · slow', level: 2,
        },
      ],
    },
    {
      id: 'gazette', docId: gazette.id,
      question: `Gazette No. ${gazetteNo} — ${s.tier === 'federal' ? 'the trunk road' : marketName}`,
      hours: 1,
      deadline: `SIGN BEFORE ${caps(w.allocation)} DROPS — ${cal.deadlines[2].date}`,
      special: 'gazette',
      options: [
        {
          key: 'sign', label: 'Sign quietly',
          sub: `No protest · ${fmt(-award)} · Integrity −2`,
          ledger: 'writes: evidence ledger · public goods · Halcyon Marine paid',
          marg: 'grey · quiet · informal', level: 2,
        },
        {
          key: 'refer', label: `Refer to ${w.cabinetShort}`,
          sub: 'Delay · the market is angry',
          ledger: 'writes: promise delayed · market agitation · Works lobby watches',
          marg: 'grey · quiet · formal', level: 2,
        },
      ],
    },
    {
      id: 'works', docId: aideNote.id,
      question: `${w.worksOfficer} Agoro`,
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
          sub: 'He stalls · you learn what the solicitor holds',
          ledger: 'writes: intel · standing + · he knows you are looking',
          marg: 'lawful · quiet · formal', level: 2,
        },
      ],
    },
    {
      id: 'protest', docId: minutes.id,
      question: `${roadsName} protest — task force, dialogue, or wait?`,
      hours: 3,
      deadline: `TRADERS STILL ON THE ROAD — RAINS FROM ${cal.deadlines[2].date}`,
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

  /* ---------- the four people, and the declarations behind them ---------- */
  const partyChairOffice = s.partyName ? `State Chairman, ${s.partyName}` : 'State Party Chairman'
  const allies: Ally[] = [
    {
      id: 'agoro', name: 'Hon. Felix Agoro', office: w.worksOfficer, zone: w.ticketRows[2][0],
      initials: 'FA', badge: 'LOYAL', trust: 3,
      whisper: 'Two NRA men were seen at his gate Wednesday — he called you first.',
    },
    {
      id: 'nwachukwu', name: `Chief (Mrs.) A. N. Nwachukwu`, office: w.chiefOfStaff, zone: w.ticketRows[0][0],
      initials: 'AN', badge: 'NEGOTIABLE', trust: 2,
      whisper: 'Keeps three copies of everything. Yours are in the safe.',
    },
    {
      id: 'danjuma', name: 'Alhaji Bala Danjuma', office: partyChairOffice, zone: w.ticketRows[0][0],
      initials: 'BD', badge: 'LEVERAGE', trust: 1,
      whisper: 'Wants his nephew in procurement. Asks every Friday.',
    },
    {
      id: 'owhonda', name: 'Elder Tom Owhonda', office: 'Traditional Council', zone: w.ticketRows[1][0],
      initials: 'TO', badge: 'NEGOTIABLE', trust: 2,
      whisper: 'Will back you if you fund the youth hall.',
    },
  ]

  const assetFor = (
    id: string, title: string, name: string, office: string, home: string, before: string,
    declared: string, liabilities: string, ranges: AssetDoc['ranges'], margin: string, audit: string[],
  ): AssetDoc => ({
    id: `asset-${id}`, kind: 'asset', title, trayLine: 'Fifth Schedule form · pencilled estimates',
    stock: 'form', clip: 'paperclip', stain: 'coffee', mark: 'opened', date: 'FILE COPY',
    formHead: 'DECLARATION OF ASSETS AND LIABILITIES — FIFTH SCHEDULE',
    fields: [
      { label: 'NAME', value: name },
      { label: 'OFFICE', value: office },
      { label: 'LGA / STATE', value: home },
      { label: 'BEFORE OFFICE', value: before },
      { label: 'DECLARED ASSETS', value: declared },
      { label: 'LIABILITIES', value: liabilities },
    ],
    ranges, margin,
    authority: 'Fifth Schedule',
    authorityText: 'Fifth Schedule — declaration of assets by public officers. Printed facts are filed; pencilled figures are yours, sourced and dated, and they decay without refresh.',
    recordId: `DOSSIER/${cal.year}/${id.toUpperCase()}/F5`,
    audit,
  })

  const homeState = s.stateName ?? (s.tier === 'federal' ? 'FCT' : 'the Federation')
  const assets: AssetDoc[] = [
    assetFor('agoro', `Declaration — Hon. F. Agoro`, 'Hon. Felix Osareme Agoro', w.worksOfficer,
      `${s.towns[0] ?? s.seat} / ${homeState}`, 'Contractor — roads & fuel supply',
      '4 properties, 2 vehicles (as filed 2023)', 'Declared: nil. Estimated: ₦? (bank whisper)',
      [
        { label: 'competence', lo: 45, hi: 65, src: 'aide · medium confidence' },
        { label: 'loyalty', lo: 30, hi: 55, src: 'hostile press · low confidence' },
        { label: 'ambition', lo: 72, hi: 88, src: 'two sightings, same week' },
        { label: 'price', lo: 55, hi: 75, src: 'derived · greed + needs' },
        { label: 'machine', lo: 60, hi: 80, src: 'ward captains' },
      ], 'defecting? confirm before Friday', ['compiled from 4 intel actions', 'last refreshed 06 Oct']),
    assetFor('nwachukwu', `Declaration — Chief (Mrs.) Nwachukwu`, 'Chief (Mrs.) Adaeze Ngozi Nwachukwu', w.chiefOfStaff,
      `${s.towns[1] ?? s.seat} / ${homeState}`, 'Senior counsel; civil-service union adviser',
      '2 properties, 1 vehicle (as filed 2023)', 'Declared: mortgage, First Meridian',
      [
        { label: 'competence', lo: 70, hi: 85, src: 'watched for 3 years' },
        { label: 'loyalty', lo: 80, hi: 95, src: 'kept 6 of 6 secrets' },
        { label: 'discretion', lo: 65, hi: 80, src: 'one leak she could not explain' },
        { label: 'ambition', lo: 55, hi: 70, src: 'wants the next promotion' },
      ], 'reliable — but she keeps copies', ['compiled from 9 intel actions', 'last refreshed 07 Oct']),
    assetFor('danjuma', `Declaration — Alhaji B. Danjuma`, 'Alhaji Bala Musa Danjuma', partyChairOffice,
      'home base outside the seat / party man', 'Transport union; two terms in the House',
      '6 properties, 5 vehicles (as filed 2023)', 'Declared: ₦? to the party trust',
      [
        { label: 'competence', lo: 50, hi: 70, src: 'won a hard primary in 2023' },
        { label: 'loyalty', lo: 45, hi: 65, src: 'party first, you second' },
        { label: 'greed', lo: 60, hi: 80, src: 'list-making is his trade' },
        { label: 'machine', lo: 70, hi: 85, src: 'chair controls ward money' },
      ], 'wants the next list through his office', ['compiled from 5 intel actions', 'last refreshed 02 Oct']),
    assetFor('owhonda', `Declaration — Elder T. Owhonda`, 'Elder Thomas Ogban Owhonda', 'Party elder — holds no office, holds them all',
      `${s.towns[2] ?? s.seat} / ${homeState}`, 'Shipping, oil services, three administrations',
      '11 properties, 7 vehicles (as filed 2019, stale)', 'Declared: nil. Estimate: companies in 3 names',
      [
        { label: 'competence', lo: 65, hi: 80, src: 'built two careers from nothing' },
        { label: 'loyalty', lo: 40, hi: 60, src: 'keeps nobody long' },
        { label: 'machine', lo: 85, hi: 95, src: 'ward captains call him first' },
        { label: 'price', lo: 75, hi: 90, src: 'the “derivation quiet” line' },
      ], 'circled on the ticket sheet — ask what he wants', ['compiled from 11 intel actions — two sources paid', 'last refreshed 05 Oct']),
  ]

  /* ---------- 15. the desk brief: what the post holds, and what it may not touch ---------- */
  const brief: NoteDoc = {
    id: 'desk-brief',
    kind: 'note',
    title: 'Desk Brief — what this office holds',
    trayLine: `Levers, blame, money and the ladder — ${s.post}`,
    stock: 'form', clip: 'none', stain: 'ring', mark: 'fresh',
    date: cal.shortDate,
    from: 'REFERENCE FILE',
    re: 'WHAT THIS OFFICE HOLDS',
    lines: [
      `${w.officeTitle} — ${s.seat}. ${s.elected ? 'Elected: your mandate is a poll, and it can be petitioned.' : 'Appointed: your mandate is an instrument, and it can be revoked.'}`,
      ...principleBrief(),
      ...postSectorBrief(s.input.officeId),
      ...revenueBrief(s.input.officeId),
      verticalFormulaLine(),
      ...pressureBrief(),
      ...careerBrief(s.input.officeId),
    ],
    authority: 'Second Schedule · Fourth Schedule · s.162',
    authorityText: 'The Exclusive and Concurrent Legislative Lists and the Fourth Schedule divide the twelve sectors between the three tiers of government; s.162 divides the money. This brief is only a map of which of those lines your post can actually move — the blame does not follow the map.',
    recordId: recordId(s, 'BRIEF'),
    audit: [
      `${cal.shortDate} · 07:05 — assembled from the service record of ${s.jurisdictionShort}`,
      `${cal.shortDate} · 07:06 — placed in the in-tray · visibility: private`,
    ],
  }

  return {
    scenario: s,
    docs, assets, decisions, allies, handover,
    extras: [sector, tell, brief],
    award,
    roadVariation: roadVar,
  }
}
