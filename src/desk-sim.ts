/* @mandate/desk-sim — the seam between the sim core (src/sim-core.ts) and the
   desk UI (src/App.tsx).

  >The systems in sim-core are stateful classes; the desk persists plain JSON in
   localStorage. This module is the round-trip: snapshot the world, rebuild the
   systems from the snapshot, advance a week, and turn what the sim produced
   into the paper the tray is made of (shocks → security digests, media stories
   → press clippings, polls → the SSA(Polling) memo).

   One deliberate lifecycle fix lives upstream in sim-core (ShockSystem.tick +
   applyToState filtering to ongoing shocks): isOngoing/getActiveShocks always
   expressed a duration window, so a weekly cadence must age the clock and
   expire shocks, or the approval meter sinks forever. Nothing else is
   re-balanced here — the sim's own numbers are used as-is. */

import type {
  Doc, SecurityDoc, ClippingDoc, NoteDoc,
} from './content'
import { formatNaira } from './content'
import { advanceTurn, executeDirtyTrick, MediaSystem, ShockSystem, createInitialSimState } from './sim-core'
import type { DirtyTrick, DirtyTrickResult, GazetteStory, SimState } from './types'

/* ---------- desk identity — who is sitting at this desk ----------

   The authored Week 41 pack (src/content.ts) is the Delta tutorial: it is written
   for the Executive Governor of Delta State and cannot be reskinned without lying
   (Sapele, Okpe, Asaba, the AG's clearance). Every other profile the player may
   create gets a personalized desk: the header, the week line, the closing name
   and the generated papers all derive from the identity accepted at first-open. */

export interface DeskIdentity {
  name: string
  post: string // 'President' · 'Governor' · 'Minister of the FCT' · 'Chairman, Local Government'
  officeLabel: string // 'FEDERAL GOVERNMENT' · 'STATE GOVERNMENT' · …
  state: string // the state name, 'Federal Capital Territory', or the LGA's state
  capital: string // the seat this desk reports from (Abuja for the federal/FCT tiers)
  lga: string | null
  party: string
  honorific: string // 'His Excellency' · 'The Honourable Minister' · …
  /** the first line of a weekly security digest, as that office's name prints it */
  digestHead: string
  /** who signs the poll memo — titles differ by tier */
  pollsterTitle: string
  /** true only for the authored Delta tutorial scenario */
  isDeltaTutorial: boolean
  /** list of patrons sitting at this desk */
  patrons: { id: string; name: string; role: string; loyalty: number; ROI_due_weeks: number }[]
}

/** The identity the authored content pack was written as — also the pre-onboarding
    default so legacy saves and open tests keep rendering the same desk. */
export const DELTA_TUTORIAL_IDENTITY: DeskIdentity = {
  name: 'M. A. Bamgboye',
  post: 'Executive Governor of Delta State',
  officeLabel: 'STATE GOVERNMENT',
  state: 'Delta',
  capital: 'Asaba',
  lga: null,
  party: 'CDM',
  honorific: 'His Excellency',
  digestHead: 'DELTA STATE SECURITY DIGEST',
  pollsterTitle: 'SSA (Polling)',
  isDeltaTutorial: true,
}

/* ---------- snapshot ---------- */

export interface SimSnapshot {
  state: SimState
  /** ShockSystem's private clock, persisted so restored shocks keep their age */
  shockWeek: number
  /** how many gazette stories the snapshot had already been rendered to paper */
  storiesSeen: number
  /** how many times each off-the-books operation has been run */
  opsCount: Record<string, number>
}

/** The playable office ids from onboarding → career levels (the ladder sides
    the player starts on; promotions come with elections, not with this map). */
export function officeToCareerLevel(officeId: string): 'lgachairman' | 'stategovernor' | 'president' | 'minister' {
  switch (officeId) {
    case 'federal/president': return 'president'
    case 'state/governor': return 'stategovernor'
    case 'fct/minister': return 'minister'
    case 'local/chairman': return 'lgachairman'
    default: return 'stategovernor'
  }
}

const CAREER_OFFICE: Record<string, string> = {
  'federal/president': 'federal/president',
  'state/governor': 'state/governor',
  'fct/minister': 'federal/minister',
  'local/chairman': 'local/chairman',
}

/** Starting world: approval 50, the ally board as the NPC profiles the
    dirty-trick machinery needs targets from, one reporter for the plant path,
    and the career line set by the office chosen at first-open. */
/* A fresh desk that is NOT the Delta tutorial opens on one honest paper: the
   orientation note from the outgoing Chief of Staff, personalized to the office,
   which teaches the one mechanic the sim weeks live on — close the week. */
export function orientationNote(week: number, identity: DeskIdentity): NoteDoc {
  return {
    ...baseDoc(week, `orientation-w${week}`, 'Note from the outgoing Chief of Staff', 'Read once. The desk is yours; the clock is not.', 'urgent', 'ring'),
    kind: 'note',
    from: 'G.O. — outgoing Chief of Staff',
    re: 'HANDOVER — YOUR FIRST WEEK, ' + identity.state.toUpperCase(),
    lines: [
      `You are eighteen months into the ${identity.post.toLowerCase()}'s term, seated at ${identity.capital}. Every file from here is read against the election.`,
      'You have 14 Desk Hours this week. Every ordinary decision spends some — spend them like money, because on Friday they are gone.',
      'Close the week and the simulation advances: shocks land on the security digest, the poll memo tracks the field, and Monday generates its own papers. Nothing here is a script any more.',
      'The Decisions shelf has an off-the-books section. It costs no desk hours — that alone should tell you what it is. EFCC and ICPC keep the other ledger.',
      'The transfer slip is your save. The public-approval meter is your ledger. One life, no reload.',
    ],
    authority: 'n/a — handover note',
    authorityText: 'Conventions of the office, not law. Filed with your service record on day one and kept forever.',
    recordId: `HANDOVER/2026/W${week}`,
  }
}

export function createDeskSim(officeId: string, stateLabel: string): SimSnapshot {
  const state = createInitialSimState(undefined, 50, { faacCurrent: 100, inflation: 0, nairaValue: 1 })
  const careerLevel = officeToCareerLevel(officeId)
  state.career = {
    ...state.career,
    level: careerLevel,
    office: CAREER_OFFICE[officeId] ?? 'state/governor',
    // the desk opens eighteen months into a first term (§content)
    tenure: 78,
  }

  state.media.reporters = [
    {
      id: 'rep-sentinel', name: 'Daily Sentinel', outlet: 'Daily Sentinel (Asaba desk)',
      zone: 'west', price: { smear: 10, positive: 15, deepfake: 20 },
      risk: { efccProbe: true, publicBacklash: true },
    },
  ]
  state.media.influencers = [
    {
      id: 'inf-warri', name: '@WarriVoice', reach: 120000,
      platform: 'twitter' as const, price: { smear: 15, endorsement: 25, deepfake: 30 },
      risk: { efccProbe: false, platformBan: true },
    },
  ]

  state.npcProfiles = {
    agoro: {
      id: 'agoro', name: 'Hon. Felix Agoro', role: 'minister', zone: 'south',
      state: stateLabel, ambition: { type: 'power', level: 3, target: '2027 ticket' },
      memories: [], price: { patronage: 60, threat: 40, appointment: 50, media: 30 },
      stance: 'neutral', riskProfile: 'high',
    },
    danjuma: {
      id: 'danjuma', name: 'Alhaji Bala Danjuma', role: 'godfather', zone: 'east',
      ambition: { type: 'wealth', level: 2, target: 'the 2027 list' },
      memories: [], price: { patronage: 70, threat: 55, appointment: 60, media: 45 },
      stance: 'neutral', riskProfile: 'medium',
    },
    owhonda: {
      id: 'owhonda', name: 'Elder Tom Owhonda', role: 'godfather', zone: 'south',
      ambition: { type: 'legacy', level: 1, target: 'the derivation quiet' },
      memories: [], price: { patronage: 80, threat: 65, appointment: 70, media: 50 },
      stance: 'neutral', riskProfile: 'high',
    },
  }
    return { state, shockWeek: 0, storiesSeen: 0, opsCount: {} }
}

/* ---------- session rebuild ---------- */

export interface SimSession {
  state: SimState
  media: MediaSystem
  shocks: ShockSystem
}

export function rebuildSession(snapshot: SimSnapshot): SimSession {
  const { state } = snapshot
  const media = new MediaSystem(state.media.reporters, state.media.influencers, state.media.gazetteStories)
  const shocks = new ShockSystem(state.shocks, snapshot.shockWeek)
  return { state, media, shocks }
}

/** Freeze a session back into a snapshot. MediaSystem/rebuildSession keep the
    story array identity unless the gazette trims to 20, so read it back through
    the system rather than trusting the snapshot field. */
export function freezeSnapshot(session: SimSession, previous: SimSnapshot): SimSnapshot {
  return {
    state: session.state,
    shockWeek: session.shocks.getWeek(),
    storiesSeen: session.media.getStories().length,
    opsCount: previous.opsCount,
  }
}

/* ---------- the week-close decision ledger ---------- */

/* Approval deltas mapped from the authored options' own consequence lines
   ("Public +5" etc.). Nothing here invents stakes — it is the printed line. */
export const DECISION_APPROVAL: Record<string, Record<string, number>> = {
  asuu: { '12': 5, '8': 2 },
  gazette: { sign: -2, refer: 0 },
  works: { back: 0, file: 1 },
  okpe: { force: -3, talk: 2 },
}

function decisionApproval(chosen: Record<string, string>): number {
  let delta = 0
  for (const [decId, opts] of Object.entries(DECISION_APPROVAL)) {
    const key = chosen[decId]
    if (key && key in opts) delta += opts[key]
  }
  return delta
}

/* ---------- paper generation ---------- */

/** The week the pack belongs to, dates roll from the authored Week 41 anchor:
    Thursday 8 October 2026 (weeks 42, 43, … follow). */
export const ANCHOR_WEEK = 41
const ANCHOR = { y: 2026, m: 9, d: 8 } // month is 0-indexed (October)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function weekDateLine(week: number): string {
  const day = ANCHOR.d + (week - ANCHOR_WEEK) * 7
  return `THURSDAY · ${day} ${MONTHS[ANCHOR.m]} ${ANCHOR.y}`
}

export function weekLine(week: number): string {
  return `EXCO WEEK ${week} · ASABA`
}

const AUDIT_STD = [
  "assembled (desk phase 9) from the week's event log",
  'delivered to the in-tray · visibility: private',
]

function baseDoc(week: number, id: string, title: string, trayLine: string, mark: Doc['mark'], stain: NoteDoc['stain']) {
  return {
    id,
    title,
    trayLine,
    stock: 'memo' as const,
    clip: 'none' as const,
    stain,
    mark,
    date: weekDateLine(week),
    audit: AUDIT_STD,
  }
}

/* A shock becomes the security digest — the analog of the authored Week 41
   one, restricted, item per ongoing event. An EFCC/ICPC investigation (the
   pushed currency crash with playerAccountable) is a private brief, not a
   village rumour: different head, blunter authority line. */
export function shockToDigest(week: number, shocks: SimState['shocks'], identity: DeskIdentity = DELTA_TUTORIAL_IDENTITY): SecurityDoc | null {
  if (shocks.length === 0) return null
  const accountable = shocks.filter(s => s.playerAccountable)
  const external = shocks.filter(s => !s.playerAccountable)
  const items = []
  for (const s of external) {
    items.push({ head: `${s.type.toUpperCase()} — SEVERITY ${s.severity}`, body: s.description + ` Est. fiscal impact: ${formatNaira(s.economicImpact * 1000000)}. Weather window: ${s.durationWeeks} weeks.` })
  }
  for (const s of accountable) {
    items.push({ head: 'EFCC/ICPC INVESTIGATION — SEVERITY ' + s.severity, body: 'Investigators are in the books. The files they want are the files you signed. Until the window closes (' + s.durationWeeks + ' weeks) every signature drawn this term is a question.' })
  }
  return {
    ...baseDoc(week, `digest-w${week}`, `Security Digest — W${week}`, external.length > 0 ? `${external.length} live event(s) — restricted` : 'RESTRICTED — an inquiry is open', 'urgent', 'none'),
    kind: 'security',
    docHead: `${identity.digestHead} — WEEK ${week}/2026 — RESTRICTED`,
    items,
    foot: `Prepared for ${identity.honorific} by O. Iriobe, Director of State Services · ${identity.capital} Command · 06:00. Copies: Chief of Staff, Attorney-General, Commissioner of Police (courtesy).`,
    authority: 'ss.214–216 · convention',
    authorityText: 'The Police Force is federal (s.214). You are chief security officer of the state by convention, not by command: you may ask, fund and coordinate — you may not deploy the Force. The events here come from the simulation, not a script.',
    recordId: `DSS/2026/W${week}`,
  }
}

/* A gazette story is tomorrow's front page — the press cutting analogue. */
export function storyToClipping(week: number, story: GazetteStory): ClippingDoc {
  return {
    ...baseDoc(week, story.id + '-w' + week, `Clipping — ${story.title}`, story.title, 'fresh', 'coffee'),
    kind: 'clipping',
    outlet: 'DAILY SENTINEL · LAGOS · THURSDAY, ' + weekDateLine(week).replace('THURSDAY · ', '').toUpperCase() + ' · ₦300',
    kicker: 'FROM THE GAZETTE · MAGNITUDE ' + story.magnitude,
    headline: story.title,
    byline: 'Staff Reporter, Asaba',
    paras: [story.description],
    briefs: story.affectedSectors.length > 0 ? [`— tags: ${story.affectedSectors.join(', ')}`] : [],
    authority: 'n/a — press',
    authorityText: 'Press cutting. Outlet reach and bias feed the perception mirrors; it carries no constitutional weight, only consequences.',
    recordId: `PRESS/DS/2026/W${week}`,
  }
}

/* The poll per week — the SSA (Polling)'s note with the zone table. */
export function pollsToMemo(week: number, state: SimState, identity: DeskIdentity = DELTA_TUTORIAL_IDENTITY): NoteDoc {
  const latest = new Map<string, number>()
  for (const p of state.polls) latest.set(p.zone, p.approval)
  const lines = [...latest.entries()].map(([zone, approval]) => `${zone.toUpperCase()} — ${approval}% (trend from the field)`)
  return {
    ...baseDoc(week, `polls-w${week}`, 'Poll memo — week ' + week, `The ${identity.pollsterTitle} walked the field. Approval: ${Math.round(state.publicApproval)}%`, 'fresh', 'none'),
    kind: 'note',
    from: identity.pollsterTitle,
    re: 'WK' + week + ' FIELD READ',
    lines: [
      'OVERALL — ' + Math.round(state.publicApproval) + '%',
      ...lines,
      'Inflation biting: ' + state.money.inflation.toFixed(1) + ' on the index. The market reads prices before it reads polls.',
    ],
    authority: 'n/a — aide note',
    authorityText: 'Private, visibility: private. It becomes Evidence only if it is leaked, subpoenaed or photographed by somebody with a phone.',
    recordId: `POLL/2026/W${week}`,
  }
}

/* A biro note confirming this week's off-the-book move, passed over the desk. */
export function opToNote(week: number, trick: DirtyTrick, result: DirtyTrickResult): NoteDoc {
  const trickName = trick.replace('-', ' ')
  return {
    ...baseDoc(week, `op-${trick}-w${week}`, `Note — the ${trickName}`, 'The Chief of Staff says: it is done. Read once, burn.', 'urgent', 'none'),
    kind: 'note',
    from: 'A. N. W.',
    re: 'RE: ' + trickName.toUpperCase(),
    lines: [
      result.effect,
      result.approvalChange !== 0
        ? `Approval moves ${result.approvalChange > 0 ? '+' : ''}${result.approvalChange} when the public reads it.`
        : 'The public never needs to know this one happened.',
      result.efccRisk ? 'Exposure: the money trail exists somewhere. If they pull it, a probe lands.' : 'No EFCC/ICPC exposure on this one.',
    ],
    authority: 'n/a — aide note',
    authorityText: 'Private. Visibility: private. It becomes Evidence only if it is leaked, subpoenaed or photographed by somebody with a phone.',
    recordId: `COS/2026/W${week}/${trick.toUpperCase()}`,
  }
}

/* ---------- the weekly close ---------- */

export interface WeeklyClose {
  snapshot: SimSnapshot
  /** the papers to drop onto the next week's tray */
  documents: Doc[]
  /** one line for the close-the-week toast */
  headline: string
  approval: number
}

/** File the week: apply the decision ledger, tick the sim forward one week with
    its own machinery (advanceTurn: shock clock, shock bites, random new shock,
    zone polls, approval, week counters), then turn what happened into papers. */
export function closeWeek(
  snapshot: SimSnapshot,
  chosen: Record<string, string>,
  identity: DeskIdentity = DELTA_TUTORIAL_IDENTITY,
): WeeklyClose {
  const session = rebuildSession(snapshot)

  // 1. the decision ledger the player is accountable for
  const delta = decisionApproval(chosen)
  session.state.publicApproval = Math.max(0, Math.min(100, session.state.publicApproval + delta))

  // 2. the sim moves one week — its own numbers, unchanged
  const preStories = session.media.getStories().length
  session.state = advanceTurn(session.state, session.shocks, session.media)
  const postStories = session.media.getStories()

  // 3. tenure: the desk counts weeks in office
  session.state.career = { ...session.state.career, tenure: session.state.career.tenure + 1 }

  // 4. keep the snapshot arrays bounded (the zone table never needs more)
  session.state.polls = session.state.polls.slice(-25)
  const stories = postStories.slice(-20)
  session.state.media = { ...session.state.media, gazetteStories: stories }

  // 5. the new papers: everything the sim produced this week, in this desk's name
  const week = ANCHOR_WEEK + session.state.turn
  const documents: Doc[] = []
  const active = session.shocks.getActiveShocks()
  const digest = shockToDigest(week, active, identity)
  if (digest) documents.push(digest)
  const newStories = postStories.slice(preStories)
  for (const story of newStories) {
    documents.push(storyToClipping(week, story))
  }
  documents.push(pollsToMemo(week, session.state, identity))

  const headlineParts: string[] = []
  if (delta !== 0) headlineParts.push(`${delta > 0 ? '+' : ''}${delta} from the ledger`)
  if (digest) headlineParts.push('new digest on the tray')
  if (newStories.length > 0) headlineParts.push(newStories.length === 1 ? 'a story broke' : `${newStories.length} stories broke`)
  headlineParts.push('approval ' + Math.round(session.state.publicApproval) + '%')

  return {
    snapshot: freezeSnapshot(session, snapshot),
    documents,
    headline: headlineParts.filter(Boolean).join(' · '),
    approval: Math.round(session.state.publicApproval),
  }
}

/* ---------- off the books ---------- */

export const OPS: { key: DirtyTrick; label: string; sub: string; blurb: string }[] = [
  { key: 'bribe-official', label: 'Bribe an official', sub: 'Cash clears a request', blurb: 'The queue moves when it is greased. EFCC reads accounts, not intent.' },
  { key: 'blackmail-target', label: 'Blackmail a target', sub: 'Their file becomes a lever', blurb: 'You learned something about somebody. ICPC watches this street.' },
  { key: "sponsor-protest", label: 'Sponsor a protest', sub: 'A crowd of your own', blurb: "Cheaper than a broadcast. The dispersal order is somebody else's problem." },
  { key: 'plant-story', label: 'Plant a story', sub: 'The Gazette prints', blurb: 'Pay the press and the story is whatever you said it was.' },
  { key: 'deepfake-rival', label: 'Deepfake a rival', sub: 'A video that never happened', blurb: 'The most damaging artefact that can be printed tonight.' },
  { key: 'suppress-vote', label: 'Suppress the vote', sub: 'Turnout, thinned', blurb: 'It only works until it is seen. Seen, it is a scandal.' },
]

export interface OpOutcome {
  ok: boolean
  effect: string
  approval: number
  efcc: boolean
  snapshot: SimSnapshot
}

/** Execute one dirty trick through the sim core — the real systems, the real
    EFCC/ICPC machinery, the real shock if a probe lands. */
export function executeOp(snapshot: SimSnapshot, trick: DirtyTrick): OpOutcome {
  const session = rebuildSession(snapshot)
  const result = executeDirtyTrick(trick, {
    state: session.state,
    mediaSystem: session.media,
    shockSystem: session.shocks,
    npcProfiles: session.state.npcProfiles,
  })

  // keep the snapshot in sync with whatever the systems did to their internals
  session.state.media = { ...session.state.media, gazetteStories: session.media.getStories().slice(-20) }
  session.state.polls = session.state.polls.slice(-25)

  const next: SimSnapshot = {
    ...freezeSnapshot(session, snapshot),
    opsCount: { ...snapshot.opsCount, [trick]: (snapshot.opsCount[trick] ?? 0) + 1 },
  }

  return {
    ok: result.success,
    effect: result.effect,
    approval: result.approvalChange,
    efcc: result.efccRisk,
    snapshot: next,
  }
}
