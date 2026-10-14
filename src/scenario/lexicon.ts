/* MANDATE — the institutional vocabulary of each desk.
   A council, a state house and the Federation do not sign the same paper. Every slot below
   is filled from the player's own record, so the files read in the register of the seat the
   player actually took: the cabinet is an EXCO or an FEC or a council meeting; the works
   file is signed by a Commissioner, a Minister or a Supervisor; the money is FAAC or the
   FCTA allocation or the joint account; the chamber is a House of Assembly, the National
   Assembly, a Legislative Council — or nothing at all, for a seat that is appointed. */

import type { Tier } from '../profile/types'
import type { Words } from './types'

export interface LexiconContext {
  tier: Tier
  elected: boolean
  post: string
  seat: string
  stateName: string | null
  capital: string | null
  lgaName: string | null
  towns: string[]
  districts: string[]
  councils: number
}

const caps = (s: string) => s.toUpperCase()

/** 'Delta' → 'DELTA'; keeps multi-word names readable. */
function stateCaps(ctx: LexiconContext): string {
  return ctx.stateName ? caps(ctx.stateName) : 'THE FEDERATION'
}

export function wordsFor(ctx: LexiconContext): Words {
  const seatState = ctx.stateName ?? 'the Federation'
  const marketTown = ctx.towns[1] ?? ctx.towns[0] ?? ctx.capital ?? 'the market'
  const roadTown = ctx.towns[0] ?? ctx.capital ?? 'the trunk road'
  const rallyTown = ctx.towns[0] ?? ctx.capital ?? 'the capital'
  const wardTown = ctx.towns[2] ?? ctx.towns[0] ?? ctx.capital ?? 'the ward'

  const electedNote = ctx.elected ? '' : ' Appointed: no ballot put you here, and none can remove you but the one who sent you.'

  if (ctx.tier === 'federal') {
    return {
      tier: 'federal',
      elected: true,
      officeTitle: 'President of the Federal Republic of Nigeria',
      seatNoun: 'the Villa',
      cabinet: 'FEDERAL EXECUTIVE COUNCIL',
      cabinetShort: 'FEC',
      cabinetTrayLine: 'Federal Executive Council — four items await your hand',
      cabinetAuthority: 'Chapter VI · ss.147–159',
      cabinetAuthorityText: 'The Federal Executive Council — ministers appointed by the President (s.147), collectively responsible through him (s.148). The Council binds you; minutes are the paper proof.',
      chamber: 'NATIONAL ASSEMBLY',
      chamberShort: 'THE NATIONAL ASSEMBLY',
      whipHead: 'WHIP SHEET — NATIONAL ASSEMBLY',
      whipAuthority: 'Constitution (Sixth Alteration) Bill, 2026',
      whipAuthorityText: 'Amending the Constitution requires two-thirds of each chamber and the approval of not less than two-thirds of all State Houses of Assembly — 24 of 36. You carry the federal end; the states carry the rest.',
      whipHoldouts: 'Holdouts: the Senate caucus wants the funding clause ring-fenced; the House caucus is watching the derivation states; the North-East bloc has not declared.',
      worksOfficer: 'Minister of Works',
      educationOfficer: 'Minister of Education',
      chiefOfStaff: 'Chief of Staff',
      attorney: 'Attorney-General of the Federation',
      policeHead: 'Inspector-General of Police',
      securityHead: 'Director-General, State Services',
      securityFoot: 'Prepared for the President by the Director-General, State Services · 06:00',
      fundTitle: 'Consolidated Revenue Fund — Federation',
      allocation: 'the federation account',
      allocationFull: 'Federation Account — Federal Government share',
      appropriationAuthority: 'ss.80–89 — FEDERAL APPROPRIATION',
      employer: 'the federal universities',
      union: 'ASUU (federal branches)',
      unionPaper: 'NIGERIAN LABOUR CONGRESS — NATIONAL SECRETARIAT',
      unionSignatory: 'President, Nigeria Labour Congress',
      market: `${marketTown} Road`,
      road: `${roadTown}–${wardTown} Expressway`,
      rallyTown,
      stadium: `${rallyTown} Township Stadium`,
      station: 'the police command',
      wardLabel: 'the ward',
      topJob: 'President',
      oppositionJob: 'the presidency',
      digestHead: 'NATIONAL SECURITY DIGEST',
      gazetteRole: 'Authorized Signatory',
      ticketTitle: 'Deputy Ticket — Zoning Check',
      ticketSubHead: 'VICE-PRESIDENT · ZONE · FAITH · MACHINE · MONEY · BAGGAGE',
      ticketRows: [
        ['North-West', 'Muslim', 'Arewa consultative bloc', '₦1.2b', 'none'],
        ['North-Central', 'Christian', 'Middle-belt governors', '₦840m', 'keeps copies'],
        ['South-South', 'Christian', 'Niger Delta leaders', '₦600m', 'NRA sightings'],
      ],
      ticketRedNote: 'South-South balances the ticket — but he is the one shopping an NRA ticket',
      ticketAuthorityText: 'No constitutional force; binding only by patronage. A running mate shares the ticket, not the term — you may drop him, but the zone remembers.',
      termNote: '4-year term; Commander-in-Chief by convention.',
      electionLine: 'PRESIDENTIAL POLL',
      briefingLine: `PRESIDENT OF THE FEDERATION · SEAT ${caps(ctx.seat)}`,
    }
  }

  if (ctx.tier === 'fct') {
    return {
      tier: 'fct',
      elected: false,
      officeTitle: 'Minister of the Federal Capital Territory',
      seatNoun: 'the FCTA secretariat',
      cabinet: 'FCT EXECUTIVE COMMITTEE',
      cabinetShort: 'FCTA',
      cabinetTrayLine: 'FCT Executive Committee — four items await your hand',
      cabinetAuthority: 's.299 · FCT administration',
      cabinetAuthorityText: 'The territory is administered by the President through a Minister (s.299): you sign for the President, and the mandate is his until he takes it back.',
      chamber: 'NATIONAL ASSEMBLY',
      chamberShort: 'THE NATIONAL ASSEMBLY',
      whipHead: 'WHIP SHEET — FCT MATTERS IN THE NATIONAL ASSEMBLY',
      whipAuthority: 'Constitution (Sixth Alteration) Bill, 2026',
      whipAuthorityText: 'The territory does not vote on constitutional amendment as a state does; its interest is carried by its senator and its representatives, and by you.',
      whipHoldouts: 'Holdouts: the senator wants the area-council clause rewritten; the AMAC chairman wants the land title line moved; the six councils have not agreed a common position.',
      worksOfficer: 'Executive Secretary, FCDA',
      educationOfficer: 'Secretary for Education',
      chiefOfStaff: 'Chief of Staff',
      attorney: 'the FCT Solicitor-General',
      policeHead: 'Commissioner of Police, FCT',
      securityHead: 'Director of State Services, FCT Command',
      securityFoot: 'Prepared for the Minister by the Director of State Services, FCT Command · 06:00',
      fundTitle: 'FCTA Treasury — Federal Capital Territory',
      allocation: 'the FCTA allocation',
      allocationFull: 'FCTA statutory allocation',
      appropriationAuthority: 's.299 — FCTA APPROPRIATION, LAID BEFORE THE NATIONAL ASSEMBLY',
      employer: "the territory's schools",
      union: 'the FCT teachers',
      unionPaper: 'NIGERIAN UNION OF TEACHERS — FCT CHAPTER',
      unionSignatory: 'Chairman, NUT FCT Chapter',
      market: `${ctx.towns[0] ?? 'Gwagwalada'} Market`,
      road: 'the Abuja–Keffi road',
      rallyTown: ctx.towns[0] ?? 'Gwagwalada',
      stadium: 'the Abuja National Stadium',
      station: 'the FCT police command',
      wardLabel: 'the ward',
      topJob: 'Minister',
      oppositionJob: 'your appointment',
      digestHead: 'FCT SECURITY DIGEST',
      gazetteRole: 'Authorized Signatory',
      ticketTitle: 'The Mandate — Who the President Sends',
      ticketSubHead: 'FCT BOARD · ZONE · FAITH · MACHINE · MONEY · BAGGAGE',
      ticketRows: [
        ['North-Central', 'Christian', 'FCT youth groups', '₦1.2b', 'none'],
        ['North-West', 'Muslim', 'FCT civil service', '₦840m', 'keeps copies'],
        ['South-East', 'Christian', 'Traders’ associations', '₦600m', 'NRA sightings'],
      ],
      ticketRedNote: 'The south-east slate balances the secretariats — but he is the one shopping an NRA platform',
      ticketAuthorityText: `Not a ballot: an appointed seat is a delegation of the President's authority (s.299). You may be moved by a phone call.${electedNote}`,
      termNote: 'Appointed; serves at the pleasure of the President.',
      electionLine: 'APPOINTED SEAT — NO POLL',
      briefingLine: `MINISTER OF THE FCT · SEAT ${caps(ctx.seat)}`,
    }
  }

  if (ctx.tier === 'local') {
    return {
      tier: 'local',
      elected: true,
      officeTitle: `Chairman, ${ctx.lgaName ?? 'Local Government'} Local Government Council`,
      seatNoun: 'the council secretariat',
      cabinet: `${caps(ctx.lgaName ?? 'COUNCIL')} COUNCIL MEETING`,
      cabinetShort: 'COUNCIL',
      cabinetTrayLine: 'Council meeting — four items await your hand',
      cabinetAuthority: 's.7 · Fourth Schedule',
      cabinetAuthorityText: 'The local government is the third tier (s.7): a council with its own chairman and legislative council, functions listed in the Fourth Schedule. The Council binds you; minutes are the paper proof.',
      chamber: `${caps(ctx.lgaName ?? 'COUNCIL')} LEGISLATIVE COUNCIL`,
      chamberShort: 'THE COUNCIL',
      whipHead: 'WHIP SHEET — COUNCIL RESOLUTION',
      whipAuthority: 'Constitution (Sixth Alteration) Bill, 2026',
      whipAuthorityText: 'A council cannot amend the Constitution; it can resolve, and it can instruct its representatives. Your resolution is a paper in the state assembly’s hand.',
      whipHoldouts: 'Holdouts: the councillor for the ward wants the market clause in the text; the opposition councillors will support anything that names the state; your own side wants the credit.',
      worksOfficer: 'Supervisor for Works',
      educationOfficer: 'Supervisor for Education',
      chiefOfStaff: 'Council Secretary',
      attorney: 'the council Solicitor',
      policeHead: 'Divisional Police Officer',
      securityHead: 'Divisional Police Officer and the council security officer',
      securityFoot: 'Prepared for the Chairman by the Divisional Police Officer and the council security officer · 06:00',
      fundTitle: `${ctx.lgaName ?? 'Council'} Council Treasury — Joint Account`,
      allocation: 'the joint account',
      allocationFull: 'joint account allocation (JAAC)',
      appropriationAuthority: 's.7 & s.162(6) — JOINT ACCOUNT, JAAC APPROPRIATION',
      employer: 'the primary schools',
      union: 'the teachers’ union, council chapter',
      unionPaper: `NIGERIAN UNION OF TEACHERS — ${caps(ctx.lgaName ?? 'COUNCIL')} CHAPTER`,
      unionSignatory: `Chairman, NUT ${ctx.lgaName ?? 'Council'} Chapter`,
      market: `${ctx.lgaName ?? wardTown} Market`,
      road: `${ctx.lgaName ?? wardTown}–${rallyTown} road`,
      rallyTown,
      stadium: `${rallyTown} Township Stadium`,
      station: 'the divisional police station',
      wardLabel: 'the ward',
      topJob: 'Chairman',
      oppositionJob: 'the council chair',
      digestHead: `${caps(ctx.lgaName ?? 'COUNCIL')} SECURITY NOTE`,
      gazetteRole: 'Authorized Signatory',
      ticketTitle: 'Councillor Slate — Who Balances the Council',
      ticketSubHead: 'VICE-CHAIRMAN · WARD · FAITH · MACHINE · MONEY · BAGGAGE',
      ticketRows: [
        [ctx.districts[0] ?? 'Ward I', 'Christian', 'Ward captains', '₦1.2b', 'none'],
        [ctx.districts[1] ?? 'Ward II', 'Christian', 'Market women', '₦840m', 'keeps copies'],
        [ctx.districts[2] ?? 'Ward III', 'Christian', 'Youth groups', '₦600m', 'NRA sightings'],
      ],
      ticketRedNote: 'The third ward balances the slate — but he is the one shopping an NRA ticket',
      ticketAuthorityText: 'No constitutional force; binding only by patronage. The vice-chairman shares the slate, not the term.',
      termNote: '3-year term; the third tier — funds arrive through the state joint account.',
      electionLine: 'COUNCIL POLL',
      briefingLine: `CHAIRMAN, ${caps(ctx.lgaName ?? 'COUNCIL')} LGC · SEAT ${caps(ctx.seat)}`,
    }
  }

  // state tier — the governor of any of the 36 states
  return {
    tier: 'state',
    elected: true,
    officeTitle: `Executive Governor of ${seatState}${ctx.stateName ? ' State' : ''}`,
    seatNoun: 'the secretariat',
    cabinet: `${stateCaps(ctx)} STATE EXECUTIVE COUNCIL`,
    cabinetShort: 'EXCO',
    cabinetTrayLine: 'State Executive Council — four items await your hand',
    cabinetAuthority: 'Part V · ss.192–194',
    cabinetAuthorityText: 'Executive Council of a State — commissioners appointed by the Governor under s.192, collectively responsible through the Governor (s.193). The Council binds you; minutes are the paper proof.',
    chamber: `${stateCaps(ctx)} STATE HOUSE OF ASSEMBLY`,
    chamberShort: 'THE HOUSE OF ASSEMBLY',
    whipHead: `WHIP SHEET — ${stateCaps(ctx)} STATE HOUSE OF ASSEMBLY`,
    whipAuthority: 'Constitution (Sixth Alteration) Bill, 2026',
    whipAuthorityText: 'Amending the Constitution requires approval by the National Assembly and by not less than two-thirds of all State Houses of Assembly — 24 of 36. Every assembly is a bloc; yours is one of them.',
    whipHoldouts: 'Holdouts: the member for the second town wants a local-protocol clause in the text; the member for the port is under parish pressure on tenure; the member for the capital has been silent since the primaries.',
    worksOfficer: 'Works Commissioner',
    educationOfficer: 'Commissioner for Education',
    chiefOfStaff: 'Chief of Staff',
    attorney: 'Attorney-General',
    policeHead: 'Commissioner of Police',
    securityHead: `Director of State Services, ${stateCaps(ctx)} Command`,
    securityFoot: `Prepared for His Excellency by the Director of State Services, ${stateCaps(ctx)} Command · 06:00`,
    fundTitle: `Consolidated Revenue Fund — ${seatState} State Treasury`,
    allocation: 'FAAC',
    allocationFull: 'FAAC allocation',
    appropriationAuthority: 'ss.121–125 — STATE APPROPRIATION',
    employer: 'the state university',
    union: 'ASUU State Chapter',
    unionPaper: `NIGERIAN LABOUR CONGRESS — ${stateCaps(ctx)} STATE COUNCIL`,
    unionSignatory: `Chairman, NLC ${seatState} State Council`,
    market: `${marketTown} Market`,
    road: `${roadTown} Road`,
    rallyTown,
    stadium: `${rallyTown} City Stadium`,
    station: 'the police command',
    wardLabel: 'the ward',
    topJob: 'Governor',
    oppositionJob: 'the governorship',
    digestHead: `${stateCaps(ctx)} STATE SECURITY DIGEST`,
    gazetteRole: 'Authorized Signatory',
    ticketTitle: 'Deputy Ticket — Zoning Check',
    ticketSubHead: 'DEPUTY GOVERNOR · ZONE · FAITH · MACHINE · MONEY · BAGGAGE',
    ticketRows: [
      [ctx.districts[0] ?? 'Zone A', 'Christian', 'Party list', '₦1.2b', 'none'],
      [ctx.districts[1] ?? 'Zone B', 'Christian', 'Party women', '₦840m', 'keeps copies'],
      [ctx.districts[2] ?? 'Zone C', 'Christian', 'Ward captains', '₦600m', 'NRA sightings'],
    ],
    ticketRedNote: `The third district balances the ticket — but he is the one shopping an NRA ticket`,
    ticketAuthorityText: 'No constitutional force; binding only by patronage. A deputy shares the ticket, not the term — you may drop him, but the zone remembers (s.187).',
    termNote: '4-year term; Chief Executive of the State; appoints Commissioners under s.192.',
    electionLine: 'GUBERNATORIAL POLL',
    briefingLine: `GOVERNOR OF ${stateCaps(ctx)}${ctx.stateName ? ' STATE' : ''} · SEAT ${caps(ctx.seat)}`,
  }
}
