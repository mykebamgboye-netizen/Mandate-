/* MANDATE — Situation Desk (compact + expanded layouts).
   Input → Command → Sim → Events → ViewModel (Section 17.3); the prototype
   renders view-models directly from the content pack. */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DOCS, ASSET_DOCS, DECISIONS, BUDGET, OPENING_BALANCE, OPENING_NOTE,
  WEEK, TERM, HANDOVER, SECTOR_BRIEF, TELL_PACK,
  SHORTFILL_NAIRA, SAPELE_AWARD_NAIRA, PENDING_TOTAL,
  BUDGET_CLOSING, CLOSING_AFTER_SANCTION, nairaDisplay,
  type Doc, type Decision,
} from './content'

import { ORIGINS, BRINGERS, FIRST_SCARS, nextSheetState } from './profile/onboarding'
import type { FederationState, FederationOffice, FederationLga } from "./profile"
import {
  ANCHOR_WEEK,
  closeWeek as closeWeekSim,
  createDeskSim,
  
  
  orientationNote,
  weekDateLine,
  weekLine as simWeekLine,
  type DeskIdentity,
  type SimSnapshot,
} from './desk-sim'
import { effectChips } from './profile/prologue'
import {
  ensureReferenceOffices, FALLBACK_OFFICES, postRoute, stateChoicesFor } from './profile/profile-state'
import { TIER_LABEL, TIER_ORDER } from './profile/playable-offices'
import { PatronageStrip } from './PatronageStrip'
import DeskShell from './components/desk/DeskShell'
import FolderShell from './components/desk/FolderShell'
import type { DeskLevel } from './components/desk/FederalHeader'
import type { Patron } from './components/desk/PatronRow'
import type { GazetteContent } from './components/desk/Gazette'
import PatronsScreen from './components/desk/PatronsScreen'
import PressScreen from './components/desk/PressScreen'
import OpsScreen, { type OpResult } from './components/desk/OpsScreen'
import CabinetScreen, { type CabinetRow } from './components/desk/CabinetScreen'
import TreasuryScreen from './components/desk/TreasuryScreen'
import {
  listStates,
  listOffices,
  listParties,
  listLgas,
  publicClient,
  createProfile,
  defaultFederationReference,
} from './profile/client'

const isSupabaseConfigured = (): boolean =>
  typeof import.meta.env.VITE_SUPABASE_URL === 'string' &&
  typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string'

import { DELTA_TUTORIAL_STATE, DELTA_TUTORIAL_OFFICE } from './profile/delta-tutorial'
import { GameContext, DEFAULT_SETTINGS, type GameSettings, type GameHooks } from './game-context'
import { DocumentView, type DocMarkState } from './DocumentView'
import AtlasScreen, { type AtlasLife } from './components/atlas/AtlasScreen'
import { POSITIONS } from './sim/positions'
import { createNewLife, lifeList, lifeSummary, loadLives, saveLives, syncLivesToSupabase, loadLivesFromSupabase } from './profile/lives'
import type { LifeRegistry } from './sim/game-state'
import {
  closeLivingWeek, livingCast, loadWorld, seatIdForIdentity, upcomingPolls,
  restorePlayerFromSave,
  type CastMember, type LivingPlayerInput,
} from './living-desk'
import { executeOp } from './desk-sim'
import type { DirtyTrick, GazetteStory } from './types'
import { HoldToCommit } from './hold'
import { IcSlip } from './icons'
import { signInWithPassword, signUpWithPassword, signOut, getCurrentUser } from './profile/auth'

type Tab = 'desk' | 'patrons' | 'press' | 'ops' | 'budget' | 'files' | 'atlas'

const VITE_ENABLE_DESK_V2 = import.meta.env.VITE_ENABLE_DESK_V2
/* Defaults to on: the DeskCard surface is the desk now. The flag only keeps the
   authored Week 41 paper desk reachable for comparison. */
const deskV2 = VITE_ENABLE_DESK_V2 ? VITE_ENABLE_DESK_V2 === 'true' : true


/* The first-open flow, in the order the player walks it. The number printed on the
   shell comes from this list, so a step can never claim to be step 3 of 7 while
   sitting sixth in the path. 'landing' is the door, not a step. */
type OnboardingPhase =
  | 'landing' | 'none' | 'pick-post' | 'pick-state' | 'pick-lga'
  | 'pick-identity' | 'pick-party' | 'prologue' | 'profile-sheet' | 'entering-desk'

const ONBOARD_FLOW: { phase: OnboardingPhase; kicker: string; title: string }[] = [
  { phase: 'pick-post', kicker: 'STEP 1 OF 7 · THE POST', title: 'WHAT OFFICE WILL YOU HOLD?' },
  { phase: 'pick-state', kicker: 'STEP 2 OF 7 · THE JURISDICTION', title: 'WHICH STATE?' },
  { phase: 'pick-lga', kicker: 'STEP 3 OF 7 · THE COUNCIL', title: 'WHICH LOCAL GOVERNMENT?' },
  { phase: 'pick-identity', kicker: 'STEP 4 OF 7 · THE PERSON', title: 'WHO ARE YOU?' },
  { phase: 'pick-party', kicker: 'STEP 5 OF 7 · THE BANNER', title: 'WHICH PARTY CARRIES YOU?' },
  { phase: 'prologue', kicker: 'STEP 6 OF 7 · THE RECORD', title: 'WHERE DID YOU COME FROM?' },
  { phase: 'profile-sheet', kicker: 'STEP 7 OF 7 · THE RECORD', title: 'YOUR RECORD — INFORMANCE CF001' },
]

const ONBOARD_DOOR = { kicker: 'MANDATE · A LIFE IN OFFICE', title: 'WHERE DOES THIS DESK LIVE?' }

/** 1-based position of a phase in the path; the door is not a step. */
function indexOfStep(phase: OnboardingPhase): number {
  return ONBOARD_FLOW.findIndex(s => s.phase === phase) + 1
}

const STORE_KEY = 'mandate.desk.v1'
interface Persist {
  marks: Record<string, DocMarkState>
  decisions: Record<string, string>
  /** decision ids whose approval consequence has already been paid at a week close */
  decisionsApplied?: Record<string, true>
  handoverDone?: boolean
  /** the sim week on the desk — week 41 is the authored pack; later weeks are sim-fed */
  weekNumber: number
  /** the persisted simulation (a snapshot of sim-core state, restored per session) */
  sim?: SimSnapshot
  /** the accepted profile as the desk renders it — who is sitting at this desk */
  identity?: DeskIdentity
  /** papers generated for the sim weeks (shocks → digests, stories → clippings, polls → memo) */
  inTray: Doc[]
  /** what the living country's press printed this week — read by the press folder */
  livingPress?: GazetteStory[]
  /** decisions whose desk hours were charged this week (hours reset at the rollover) */
  hoursBook: Record<string, true>
  /** off-the-books results, keyed by trick — one run each per week */
  ops: Record<string, { ok: boolean; effect: string; approval: number; efcc: boolean }>
  weathered?: string[]
  settings?: GameSettings
  glossQuarters?: number
  /** gates the onboarding shell; set the moment the profile sheet is accepted */
  profileHandle?: string
  publicApproval?: number // 0-100, dynamic polling reflected on the desk
  /** the currently selected tab: desk, patrons, press, ops */
  tab: Tab
}

function emptyPersist(): Persist {
  return { marks: {}, decisions: {}, weekNumber: ANCHOR_WEEK, inTray: [], hoursBook: {}, ops: {}, weathered: [], publicApproval: 50, tab: 'desk' }
}

function load(): Persist {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Persist
      if (p && typeof p === 'object' && p.marks && p.decisions) {
        return {
          ...emptyPersist(),
          ...p,
          weekNumber: p.weekNumber ?? ANCHOR_WEEK,
          inTray: p.inTray ?? [],
          hoursBook: p.hoursBook ?? {},
          ops: p.ops ?? {},
          publicApproval: p.publicApproval ?? 50,
          tab: p.tab ?? 'desk',
        }
      }
    }
  } catch { /* corrupt store — start clean */ }
  return emptyPersist()
}

/* ---------- transfer slip: one-time export that burns the desk it left (§3.7) ---------- */
const SLIP_PREFIX = 'MANDATE-SLIP-1.'
function encodeSlip(p: Persist): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p))
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b ^ 0x5a) })
  return SLIP_PREFIX + btoa(bin)
}
function decodeSlip(code: string): Persist | null {
  try {
    const body = code.trim().replace(SLIP_PREFIX, '').replace(/\s+/g, '')
    const bin = atob(body)
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0) ^ 0x5a)
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Persist
    if (p && typeof p === 'object' && p.marks && p.decisions) return p
  } catch { /* not a slip */ }
  return null
}

const EMPTY_MARK: DocMarkState = { stamps: [], annotations: [] }
const ORDER: Record<Doc['mark'], number> = { urgent: 0, fresh: 1, opened: 2, forwarded: 3 }

/* the council line in the desk header — the authored pack prints 'EXCO WEEK 41 · ASABA';
   an accepted profile prints its own tier's council, week and seat. */
function deskWeekLine(identity: DeskIdentity | undefined, week: number): string {
  if (!identity) return simWeekLine(week)
  if (identity.isDeltaTutorial) return simWeekLine(week)
  const seat = identity.capital.toUpperCase()
  if (identity.post.startsWith('President')) return `FEDERAL EXECUTIVE COUNCIL · WEEK ${week} · ${seat}`
  if (identity.post.startsWith('Minister')) return `FCT EXECUTIVE COUNCIL · WEEK ${week} · ${seat}`
  if (identity.lga) return `LGA EXECUTIVE COUNCIL · WEEK ${week} · ${identity.lga.toUpperCase()}`
  return `EXCO WEEK ${week} · ${seat}`
}

/* the one-line live status under the clock: what the simulation currently has open */
function simLiveLine(sim?: SimSnapshot): string {
  if (!sim) return 'THE SIM IS BARELY AWAKE — CLOSE THE WEEK AND IT BREATHES'
  const s = sim.state
  const live = s.shocks.filter(k => sim.shockWeek - k.startWeek < (k.durationWeeks || 1)).length
  return `LIVE EVENTS ${live} · INFLATION ${s.money.inflation.toFixed(1)} · WEEK ${41 + s.turn} OF THE TERM`
}

function allDocs(): Doc[] { return [...DOCS, SECTOR_BRIEF, TELL_PACK, ...ASSET_DOCS] }
function findDoc(id: string, tray: Doc[] = []): Doc | undefined {
  return id === HANDOVER.id ? HANDOVER : [...allDocs(), ...tray].find(d => d.id === id)
}

/* ---------- the DeskCard surface (deskV2) ----------
   Everything the shell prints is read off the save: the tier of the office, the
   seat it reports from, the patrons owing and owed, the live decision. Nothing
   below assumes Delta — the same desk serves the Federation, a state or an LGA. */
function deskLevelOf(identity?: DeskIdentity): DeskLevel {
  if (!identity) return 'state'
  if (identity.lga) return 'lga'
  const label = (identity.officeLabel ?? '').toUpperCase()
  if (label.includes('FEDERAL') || label.includes('FCT')) return 'federal'
  return 'state'
}

/** The authored Week 41 pack in tray order — the old desk and the shell share it. */
function authoredTrayDocs(p: Persist): Doc[] {
  const base = [...DOCS, SECTOR_BRIEF, TELL_PACK].sort((a, b) => ORDER[a.mark] - ORDER[b.mark])
  return p.handoverDone ? base : [HANDOVER, ...base]
}

/** The patron row's data: the desk's own patrons, or none (the row demos itself). */
function shellPatrons(identity?: DeskIdentity): Patron[] {
  return (identity?.patrons ?? []).map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    loyalty: p.loyalty,
    ROI_due_weeks: p.ROI_due_weeks,
  }))
}

/** The living world's view of whoever sits at this desk. Null before a profile has been
    accepted: the country does not start running until somebody is sitting at the desk. */
function livingInputFor(identity: DeskIdentity | undefined, approval: number): LivingPlayerInput | null {
  if (!identity) return null
  return {
    name: identity.name,
    positionId: seatIdForIdentity({
      positionId: identity.positionId,
      post: identity.post,
      state: identity.state,
      lga: identity.lga,
    }),
    partyCode: identity.party,
    approval,
    /* The record's patronage bank is the only sum the desk's own accounting calls the
       player's money. The treasury's balance belongs to the state, not to the person. */
    bank: identity.patronageBank ?? 0,
  }
}

/** This week's gazette story, when the simulation has printed one. */
function gazetteFor(p: Persist): GazetteContent | null {
  const story = p.sim?.state?.media?.gazetteStories?.[0]
  if (!story) return null
  return { headline: story.title, date: weekDateLine(p.weekNumber ?? ANCHOR_WEEK), body: story.description }
}

function decStatus(dec: Decision, p: Persist): { done: boolean; choice?: string; ledger?: string } {
  if (dec.special === 'gazette') {
    const st = p.marks[dec.docId]?.stamps[0]
    if (st) {
      return st.label === 'APPROVED'
        ? { done: true, choice: 'Signed quietly — ' + nairaDisplay(SAPELE_AWARD_NAIRA) + ' committed', ledger: 'writes: evidence ledger · public goods · Halcyon Marine paid' }
        : { done: true, choice: 'Declined — stamped and returned', ledger: 'writes: promise broken to the contractor · Works lobby angry' }
    }
    if (p.decisions[dec.id] === 'refer') {
      return { done: true, choice: 'Referred to EXCO — the market waits', ledger: 'writes: promise delayed · market agitation · Works lobby watches' }
    }
    return { done: false }
  }
  const key = p.decisions[dec.id]
  if (!key) return { done: false }
  const opt = dec.options.find(o => o.key === key)
  return { done: true, choice: opt?.label, ledger: opt?.ledger }
}

/* ---------- tray card ---------- */
function TrayCard({ doc, mark, decided, pending, weathered, onOpen }: {
  doc: Doc; mark?: DocMarkState; decided: boolean; pending: boolean; weathered: boolean; onOpen: () => void
}) {
  const stamped = mark?.stamps[0]
  const acted = Boolean(stamped || (mark?.annotations.length ?? 0) > 0 || decided)
  const status = stamped ? `STAMPED ${stamped.label}`
    : decided ? 'DECIDED'
    : pending ? 'DECISION DUE'
    : (mark?.annotations.length ?? 0) > 0 ? 'ANNOTATED'
    : doc.mark === 'urgent' ? 'NEEDS YOUR HAND'
    : doc.mark === 'forwarded' ? 'FORWARDED' : 'UNTOUCHED'
  /* a coffee ring is a record of thinking — it only shows once a file has held you a while */
  const stain = weathered ? doc.stain : 'none'
  return (
    <button className={`paper-card stock-${doc.stock}`} onClick={onOpen}>
      {doc.clip === 'binder' && (
        <svg className="pc-clip" width="56" height="30" viewBox="0 0 74 46" aria-hidden>
          <rect x="8" y="14" width="58" height="26" rx="4" fill="#C9C4BC" stroke="#5c5852" strokeWidth="2" />
          <path d="M20 15 V8 a5 5 0 0 1 5-5 h24 a5 5 0 0 1 5 5 v7" fill="none" stroke="#5c5852" strokeWidth="3" />
          <rect x="8" y="14" width="58" height="7" fill="#8f8a82" />
        </svg>
      )}
      {doc.clip === 'paperclip' && (
        <svg className="pc-clip paperclip" width="26" height="56" viewBox="0 0 34 74" aria-hidden>
          <path d="M10 60 V16 a8 8 0 0 1 16 0 v44 a12 12 0 0 1-24 0 V20"
            fill="none" stroke="#7d7d7d" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      )}
      <span className="pc-date">{doc.date}</span>
      <div className="pc-title">{doc.title}</div>
      <p className="pc-line">{doc.trayLine}</p>
      {doc.mark === 'urgent' && !acted && <span className="pc-mark urgent">← urgent</span>}
      {stain === 'ring' && <span className="pc-ring" />}
      {stain === 'coffee' && <span className="pc-coffee" />}
      {doc.mark === 'forwarded' && <span className="pc-fold" />}
      <span className={`pc-status${acted ? ' done' : ''}`}>{status}</span>
    </button>
  )
}

/* ---------- Briefings: the Situation Desk ---------- */
const DESK_HOURS_TOTAL = 14

/* Desk Hours: fourteen a week, spent by the decisions taken THIS week and by
   the aide's glosses. Closing the week resets the book, which is why a leftover
   hour is worth nothing in the morning (§13.1). */
function deskHoursLeft(p: Persist): number {
  const spent = DECISIONS.reduce((sum, d) => sum + (p.hoursBook[d.id] ? d.hours : 0), 0)
  const left = DESK_HOURS_TOTAL - spent - (p.glossQuarters ?? 0) / 4
  return Math.max(0, Math.floor(left + 1e-9))
}

function DeskScreen({ p, onOpen, ticking, onCloseWeek }: {
  p: Persist; onOpen: (id: string) => void; ticking: boolean; onCloseWeek: () => void
}) {
  const week = p.weekNumber ?? ANCHOR_WEEK
  const identity = p.identity
  /* The authored Week 41 pack is the Delta tutorial: written for the Executive
     Governor of Delta State. Legacy saves (no identity on file) keep it; a
     non-tutorial profile runs the sim-fed desk from day one, in its own name. */
  const authored = deskV2 ? false : (week <= ANCHOR_WEEK && (identity?.isDeltaTutorial ?? true))
  const docs = useMemo(() => {
    if (!authored) return p.inTray
    return authoredTrayDocs(p)
  }, [authored, p])
  const urgentOpen = docs.filter(d =>
    d.mark === 'urgent' &&
    !p.marks[d.id]?.stamps.length &&
    !DECISIONS.some(x => x.docId === d.id && decStatus(x, p).done),
  ).length
  /* desk hours charge only for decisions taken THIS week (hoursBook resets at
     the rollover); decisions decided in earlier weeks stay decided but free. */
  const decisionHours = DECISIONS.reduce((sum, d) => sum + (p.hoursBook[d.id] ? d.hours : 0), 0)
  const hoursSpent = decisionHours + (p.glossQuarters ?? 0) / 4
  const hoursLeft = Math.max(0, DESK_HOURS_TOTAL - hoursSpent)
  const wholeLeft = Math.floor(hoursLeft + 1e-9)
  const frac = ['', '¼', '½', '¾'][Math.round((hoursLeft - wholeLeft) * 4)] ?? ''
  const weathered = p.weathered ?? []
  return (
    <>
      <div className="desk-head">
        <span className="desk-date">{authored ? WEEK.dateLine : weekDateLine(week)}</span>
        <span className="desk-week">{authored ? WEEK.weekLine : deskWeekLine(identity, week)}</span>
        <div className="desk-tag">
          {urgentOpen > 0 ? `${urgentOpen} URGENT` : 'TRIAGE DONE'} · {docs.length} DOCUMENTS
        </div>
        <div className="desk-term">{TERM.line}</div>
        <PatronageStrip sim={p.sim} identity={identity} />
        <div className="desk-hours" aria-label={`Desk Hours: ${wholeLeft} of ${DESK_HOURS_TOTAL} left`}>
          <span className="dh-label">DESK HOURS</span>
          <span className="dh-ticks">
            {Array.from({ length: DESK_HOURS_TOTAL }, (_, i) => (
              <span key={i} className={`dh-tick${i < wholeLeft ? '' : ' spent'}`} />
            ))}
          </span>
          <span className="dh-count">{wholeLeft}{frac} / {DESK_HOURS_TOTAL} LEFT — USE OR LOSE</span>
        </div>
        <div className="desk-approval" aria-label={`Public Approval: ${p.publicApproval ?? 50}%`}>
          <span className="da-label">PUBLIC APPROVAL</span>
          <span className="da-value">{p.publicApproval ?? 50}%</span>
        </div>
        <div className="desk-deadlines">
          {authored
            ? 'ASUU ultimatum 15 Oct · NLC window closes 20 Oct · FAAC drops 21 Oct'
            : simLiveLine(p.sim)}
        </div>
      </div>
      <div className="tray">
        <div className="tray-lip" />
        <div className="tray-list">
          {docs.map(d => {
            const linked = DECISIONS.filter(x => x.docId === d.id)
            const decided = linked.some(x => decStatus(x, p).done)
            const pending = linked.length > 0 && !decided
            return (
              <TrayCard key={d.id} doc={d} mark={p.marks[d.id]}
                decided={decided} pending={pending}
                weathered={weathered.includes(d.id)}
                onOpen={() => onOpen(d.id)} />
            )
          })}
        </div>
      </div>

      <div className="desk-close">
        <HoldToCommit
          level={2}
          ariaLabel="Close the week — tap to begin, hold 2s to confirm"
          onStart={() => {}}
          onCommit={() => {
            onCloseWeek()
          }}
          onEarly={() => {}}
        >
          {ticking
            ? 'FILING…'
            : week < ANCHOR_WEEK + 1
              ? 'CLOSE THE WEEK — THE DESK TIDIES ITSELF, THE SIM ADVANCES'
              : `CLOSE THE WEEK — THE SIM ADVANCES, MONDAY'S PAPERS FOLLOW`}
        </HoldToCommit>
        <div className="close-hint">Autosave runs on commit, never before (§3.7)</div>
      </div>
    </>
  )
}

/* ---------- Allies: the deputy-ticket zoning board ---------- */



// ---- onboarding step components (first-open shell) ----

/* ---------- cold-open landing: where does this desk live? ----------
   v1 keeps saves on-device; the transfer slip is the portable path (§3.7).
   The landing names all three roads honestly instead of hiding them behind a
   new file: resume what is on this device, receive a slip, or start clean. */
function LandingStep({ week, approval, hasSave, onNew, onResume, onSlip,                  authUser, supabaseConfigured, onSignIn, onSignUp, onSignOut, authLoading, email, setEmail, password, setPassword, authAction, setAuthAction, authError, setAuthError }: {
  week: number
  approval: number
  hasSave: boolean
  onNew: () => void
  onResume: () => void
  onSlip: (code: string) => boolean
  authUser: { id: string; email: string | null; name: string | null } | null
  supabaseConfigured: boolean
  onSignIn: () => void
  onSignUp: () => void
  onSignOut: () => void
  authLoading: boolean
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  authAction: 'signin' | 'signup'
  setAuthAction: (v: 'signin' | 'signup') => void
  authError: string | null
  setAuthError: (v: string | null) => void
}) {
  const [incoming, setIncoming] = useState('')
  const badSlip = incoming.trim().length > 8 && onSlip(incoming)
  return (
    <div className="dv2-step">
      {/* Signed-in account panel: the player's ledger identity, with sign-out. */}
      {supabaseConfigured && authUser ? (
        <div className="dv2-landing-account">
          <div className="dv2-landing-account-row">
            <span className="dv2-landing-account-id">{authUser.email ?? authUser.id}</span>
            <button className="dv2-act ghost" onClick={onSignOut} disabled={authLoading}>
              {authLoading ? 'SIGNING OUT…' : 'SIGN OUT'}
            </button>
          </div>
          <div className="dv2-landing-note">
            Signed in · your desk and your lives are on the ledger server. The transfer slip still works for one-time exports.
          </div>
        </div>
      ) : supabaseConfigured ? (
        <div className="dv2-landing-auth">
          <div className="dv2-landing-auth-title">SIGN IN TO YOUR ACCOUNT</div>
          <div className="dv2-landing-auth-sub">
            {authAction === 'signin'
              ? 'Enter your email and password to reach your saved desk.'
              : 'Create an account to keep your desk on the ledger server.'}
          </div>
          <div className="dv2-landing-auth-switch">
            <button
              className={`dv2-landing-auth-switch-btn${authAction === 'signin' ? ' on' : ''}`}
              onClick={() => { setAuthAction('signin'); setAuthError(null) }}
            >
              Sign in
            </button>
            <span className="dv2-landing-auth-switch-sep">/</span>
            <button
              className={`dv2-landing-auth-switch-btn${authAction === 'signup' ? ' on' : ''}`}
              onClick={() => { setAuthAction('signup'); setAuthError(null) }}
            >
              New account
            </button>
          </div>
          <div className="dv2-field">
            <label className="dv2-label">EMAIL</label>
            <input
              className="dv2-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email"
            />
          </div>
          <div className="dv2-field">
            <label className="dv2-label">PASSWORD</label>
            <input
              className="dv2-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="at least 6 characters" autoComplete={authAction === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>
          {authError && <div className="dv2-error">{authError}</div>}
          <button
            className="dv2-accept"
            onClick={authAction === 'signin' ? onSignIn : onSignUp}
            disabled={authLoading || !email.trim() || password.length < 6}
          >
            {authLoading
              ? 'WAITING…'
              : authAction === 'signin' ? 'SIGN IN'
              : 'CREATE ACCOUNT'}
          </button>
          <div className="dv2-landing-note">
            No account yet? One sign-up, one desk on the server. When accounts and shared lives arrive, they lift this desk there.
          </div>
        </div>
      ) : (
        <div className="dv2-landing-note">
          MANDATE keeps its desks on-device — one life, no reload. A transfer slip carries a desk between phones.
          Accounts come later; when they do, they lift this desk to the ledger server.
        </div>
      )}
      {hasSave && (
        <button className="dv2-accept" onClick={onResume}>
          RESUME THIS DESK — WEEK {week} · APPROVAL {approval}%
        </button>
      )}
      <button className="dv2-choice" onClick={onNew}>
        <div className="dv2-choice-label">Begin a new file</div>
        <div className="dv2-choice-sub">Pick a post, type your record, take the desk.</div>
      </button>
      <div className="dv2-field">
        <label className="dv2-label">RECEIVE A TRANSFER SLIP</label>
        <input
          className="dv2-input" value={incoming} onChange={e => setIncoming(e.target.value)}
          placeholder="paste a MANDATE-SLIP-1. code"
          aria-label="Paste a transfer slip"
        />
        {badSlip && <div className="dv2-step-sub">Not a valid slip — check the code.</div>}
      </div>
    </div>
  )
}

function PickStateStep({ states, stateCode, onState, onBack, sub }: {
  states: import('./profile').FederationState[]
  stateCode: string | null
  onState: (code: string) => void
  onBack: () => void
  sub?: string
}) {
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">{sub ?? 'Pick the state you will govern. The 36 states, or the FCT as its Minister.'}</div>
      <div className="dv2-list">
        {states.map((s: FederationState) => (
          <button
            key={s.code}
            className="dv2-list-row"
            data-selected={stateCode === s.code}
            onClick={() => onState(s.code)}
          >
            <span>
              <span className="dv2-list-name">{s.name}</span>
              <span className="dv2-list-meta">{s.capital} · {s.tier === 'fct' ? 'FCT' : 'State'}</span>
            </span>
            {stateCode === s.code && <span className="dv2-list-flag">CHOSEN</span>}
          </button>
        ))}
      </div>
      <div className="dv2-foot">
        <button className="dv2-back-link" onClick={onBack}>back</button>
      </div>
    </div>
  )
}

/* ---------- post picker: only offices the catalogue marks playable (§federation) ---------- */
function PostStep({ offices, onPost, onBack }: {
  offices: FederationOffice[]
  onPost: (office: FederationOffice) => void
  onBack: () => void
}) {
  const groups = TIER_ORDER
    .map(tier => ({ tier, items: offices.filter(o => o.tier === tier) }))
    .filter(g => g.items.length > 0)
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">Pick the office you will hold. The constitution fixes what it can do — the rest is yours.</div>
      {groups.map(g => (
        <div className="dv2-step-group" key={g.tier}>
          <div className="dv2-step-label">{TIER_LABEL[g.tier] ?? g.tier}</div>
          <div className="dv2-list">
            {g.items.map(o => (
              <button key={o.id} className="dv2-list-row" onClick={() => onPost(o)}>
                <span>
                  <span className="dv2-list-name">{o.post}</span>
                  <span className="dv2-list-meta">{o.route.toUpperCase()} · {o.jurisdiction.replace(/_/g, ' ').toUpperCase()}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="dv2-foot">
        <button className="dv2-back-link" onClick={onBack}>back to the desk</button>
      </div>
    </div>
  )
}

/* ---------- LGA step: only the Chairman tier needs a third-level jurisdiction ---------- */
function LgaStep({ state, onLga, onBack }: {
  state: import('./profile').FederationState
  onLga: (lga: FederationLga) => void
  onBack: () => void
}) {
  const [lgas, setLgas] = useState<FederationLga[] | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    let live = true
    listLgas(state.code)
      .then(rows => { if (live) setLgas(rows) })
      .catch(() => { if (live) setLgas([]) })
    return () => { live = false }
  }, [state.code])
  const needle = query.trim().toLowerCase()
  const shown = (lgas ?? []).filter(l => l.name.toLowerCase().includes(needle))
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">Which local government? {state.name} council — the third tier, funded through the state joint account.</div>
      <div className="dv2-field">
        <label className="dv2-label">FILTER</label>
        <input
          className="dv2-input" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="start typing a council name"
        />
      </div>
      {lgas === null ? (
        <div className="dv2-step-sub">Reading the council register…</div>
      ) : shown.length === 0 ? (
        <div className="dv2-step-sub">No council matches “{query}”.</div>
      ) : (
        <div className="dv2-list">
          {shown.map(l => (
            <button key={l.id} className="dv2-list-row" onClick={() => onLga(l)}>
              <span>
                <span className="dv2-list-name">{l.name}</span>
                <span className="dv2-list-meta">{state.name} · LGA</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="dv2-foot">
        <button className="dv2-back-link" onClick={onBack}>back</button>
      </div>
    </div>
  )
}

/* ---------- blank-first identity form ----------
   The player types their own record. Nothing here is pre-filled from an NPC; the Delta
   tutorial is only the scenario you land in AFTER you have chosen office + identity. */
function IdentityStep({ stateName, office, name, age, pronouns, locale, bio, altName, setName, setAge, setPronouns, setLocale, setBio, setAltName, onDone, onBack }: {
  stateName: string
  office: import('./profile').FederationOffice
  name: string
  age: string
  pronouns: string
  locale: string
  bio: string
  altName: string
  setName: (v: string) => void
  setAge: (v: string) => void
  setPronouns: (v: string) => void
  setLocale: (v: string) => void
  setBio: (v: string) => void
  setAltName: (v: string) => void
  onDone: () => void
  onBack: () => void
}) {
  const postLine = office.tier === 'fct'
    ? `${office.post.toUpperCase()} · ${stateName.toUpperCase()}`
    : `${office.post.toUpperCase()} OF ${stateName.toUpperCase()}`
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">You picked {postLine}. Now choose who you are — this is your record, typed by you, not pulled from a file.</div>
      <div className="dv2-step-post">POST — {postLine}</div>
      <div className="dv2-field">
        <label className="dv2-label">NAME</label>
        <input className="dv2-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. M. A. Bamgboye" />
      </div>
      <div className="dv2-field">
        <label className="dv2-label">AGE</label>
        <input className="dv2-input" type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 52" />
      </div>
      <div className="dv2-field">
        <label className="dv2-label">PRONOUNS</label>
        <input className="dv2-input" value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="e.g. he/him" />
      </div>
      <div className="dv2-field">
        <label className="dv2-label">PHONE LOCALE</label>
        <input className="dv2-input" value={locale} onChange={e => setLocale(e.target.value)} placeholder="e.g. +234" />
      </div>
      <div className="dv2-field">
        <label className="dv2-label">OTHER NAME</label>
        <input className="dv2-input" value={altName} onChange={e => setAltName(e.target.value)} placeholder="e.g. an alias, a former name" />
      </div>
      <div className="dv2-field">
        <label className="dv2-label">BIO / NOTES</label>
        <textarea className="dv2-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="optional — your own note to yourself" rows={4} />
      </div>
      <div className="dv2-foot">
        <button className="dv2-next" disabled={!name.trim()} onClick={() => { onDone() }}>continue to my party</button>
        <button className="dv2-back-link" onClick={onBack}>back</button>
      </div>
    </div>
  )
}

/* ---------- player-chosen party picker ----------
   The player picks their own party before the prologue now. The godfather / grassroots /
   technocrat step still shapes axes and patronage, but the party the desk travels under
   is the player's choice, not an NPC's. */
function PartyStep({ parties, partyCode, onParty, onNext, onBack }: {
  parties: import('./profile').FederationParty[]
  partyCode: string | null
  onParty: (code: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">Pick the party you will travel under. The prologue still shapes who brought you — this is the banner you choose.</div>
      <div className="dv2-step-group">
        {parties.map((p: import('./profile').FederationParty) => (
          <button
            key={p.code}
            className="dv2-choice"
            data-selected={partyCode === p.code}
            onClick={() => onParty(p.code)}
          >
            <div className="dv2-choice-label">{p.name}{partyCode === p.code ? ' · chosen' : ''}</div>
            <div className="dv2-choice-sub">{p.note}</div>
          </button>
        ))}
      </div>
      <div className="dv2-foot">
        <button className="dv2-next" disabled={!partyCode} onClick={onNext}>continue to my prologue</button>
        <button className="dv2-back-link" onClick={onBack}>back</button>
      </div>
    </div>
  )
}

function PrologueStep({ origin, bringer, scar, name, stateName, office, onOrigin, onBringer, onScar, onDone, onBack }: {
  origin: 'civil-service' | 'party-youth' | 'business' | 'activist' | null
  bringer: 'godfather' | 'grassroots' | 'technocrat' | null
  scar: 'none' | 'contract-query' | 'protest' | null
  name: string
  stateName: string
  office: import('./profile').FederationOffice
  onOrigin: (o: 'civil-service' | 'party-youth' | 'business' | 'activist') => void
  onBringer: (b: 'godfather' | 'grassroots' | 'technocrat') => void
  onScar: (s: 'none' | 'contract-query' | 'protest') => void
  onDone: () => void
  onBack: () => void
}) {
  /* The FCT has no governorship (s.299): its post is the appointed ministership, and the
     territory is not named after the office the way a state is. */
  const postLine = office.tier === 'fct'
    ? `${office.post.toUpperCase()} · ${stateName.toUpperCase()}`
    : `${office.post.toUpperCase()} OF ${stateName.toUpperCase()}`
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">Who are you, {name || 'Governor'}? A short prologue sets your starting record.</div>
      <div className="dv2-step-post">POST — {postLine}</div>
      <div className="dv2-step-group">
        <div className="dv2-step-label">Where did you come from?</div>
        {ORIGINS.map((o: typeof ORIGINS[number]) => (
          <button key={o.id} className="dv2-choice" data-selected={origin === o.id} onClick={() => onOrigin(o.id)}>
            <div className="dv2-choice-label">{o.label}</div>
            <div className="dv2-choice-sub">{o.sub}</div>
            <div className="dv2-effects">
              {effectChips(o.deltas, o.patron).map((c, i) => <span key={i} className="dv2-effect">{c}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div className="dv2-step-group">
        <div className="dv2-step-label">Who brought you?</div>
        {BRINGERS.map((b: typeof BRINGERS[number]) => (
          <button key={b.id} className="dv2-choice" data-selected={bringer === b.id} onClick={() => onBringer(b.id)}>
            <div className="dv2-choice-label">{b.label}</div>
            <div className="dv2-choice-sub">{b.sub}</div>
            <div className="dv2-effects">
              {effectChips(b.deltas).map((c, i) => <span key={i} className="dv2-effect">{c}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div className="dv2-step-group">
        <div className="dv2-step-label">Your first scar?</div>
        {FIRST_SCARS.map((s: typeof FIRST_SCARS[number]) => (
          <button key={s.id} className="dv2-choice" data-selected={scar === s.id} onClick={() => onScar(s.id)}>
            <div className="dv2-choice-label">{s.label}</div>
            <div className="dv2-choice-sub">{s.sub}</div>
            <div className="dv2-effects">
              {effectChips(s.deltas).map((c, i) => <span key={i} className="dv2-effect">{c}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div className="dv2-foot">
        <button
          className="dv2-next"
          disabled={!origin || !bringer || !scar}
          onClick={() => { onDone() }}
        >review your record</button>
        <button className="dv2-back-link" onClick={onBack}>back</button>
      </div>
    </div>
  )
}

function ProfileSheetStep({ sheet, onAccept, onBack }: {
  sheet: import('./profile').ProfileSheet
  onAccept: () => void
  onBack: () => void
}) {
  return (
    <div className="dv2-step">
      <div className="dv2-step-sub">Your record — INFORMANCE CF001 + security vetting. Signing this begins your life.</div>
      <div className="dv2-record">
        <div className="dv2-record-row"><span className="dv2-record-k">NAME</span><span className="dv2-record-v">{sheet.name}</span></div>
        <div className="dv2-record-row"><span className="dv2-record-k">HANDLE</span><span className="dv2-record-v">{sheet.handle}</span></div>
        <div className="dv2-record-row"><span className="dv2-record-k">{sheet.stateLabel}</span><span className="dv2-record-v">{sheet.state} ({sheet.capital})</span></div>
        {sheet.lga && <div className="dv2-record-row"><span className="dv2-record-k">LGA</span><span className="dv2-record-v">{sheet.lga}</span></div>}
        {sheet.district && <div className="dv2-record-row"><span className="dv2-record-k">SENATORIAL DISTRICT</span><span className="dv2-record-v">{sheet.district}</span></div>}
        <div className="dv2-record-row"><span className="dv2-record-k">AGE</span><span className="dv2-record-v">{sheet.age}</span></div>
        <div className="dv2-record-row"><span className="dv2-record-k">OFFICE</span><span className="dv2-record-v">{sheet.office} · {sheet.post} · {sheet.route}</span></div>
        <div className="dv2-record-row"><span className="dv2-record-k">PARTY</span><span className="dv2-record-v">{sheet.party} · defection risk {sheet.defectionRisk}</span></div>
        <div className="dv2-record-row"><span className="dv2-record-k">PATRONAGE BANK</span><span className="dv2-record-v">{sheet.patronageBank}</span></div>
      </div>

      <div className="dv2-step-label">THE AXES OF THIS RECORD</div>
      <div className="dv2-axes">
        {sheet.axes.map((a: { label: string; value: string; band: string }, i: number) => (
          <div key={i} className="dv2-axis">
            <span className={`dv2-axis-band ${a.band.toLowerCase()}`}>{a.band}</span>
            <span className="dv2-axis-label">{a.label}</span>
            <span className="dv2-axis-value">{a.value}</span>
          </div>
        ))}
      </div>
      <div className="dv2-legend">
        BANDS — LOW · WEAK · EVEN · STRONG · HIGH (press tone runs HOSTILE → SUPPORTIVE). Every band below is already shaped by your origin, who brought you, and your first scar.
      </div>

      {sheet.patrons.length > 0 && (
        <>
          <div className="dv2-step-label">THE PATRONAGE NETWORK</div>
          <div className="dv2-rows">
            {sheet.patrons.map((p: { name: string; role: string; loyalty: string }, i: number) => (
              <div className="dv2-row" key={i} data-tone={Number(p.loyalty) >= 4 ? 'loyal' : Number(p.loyalty) >= 2 ? 'wavering' : 'angry'}>
                <span className="dv2-row-main">
                  <span className="dv2-row-title">{p.name}</span>
                  <span className="dv2-row-line">{p.role}</span>
                </span>
                <span className="dv2-row-facts">
                  <span className="dv2-row-state">loyalty {p.loyalty}/5</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="dv2-foot">
        <button className="dv2-accept" onClick={onAccept}>accept and enter the desk</button>
        <button className="dv2-back-link" onClick={onBack}>revise my record</button>
      </div>
    </div>
  )
}


/* ---------- root ---------- */
function useExpanded(): boolean {
  const query = '(min-width: 1100px)'
  const [expanded, setExpanded] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setExpanded(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return expanded
}

function SettingsDrawer({ settings, onChange, onClose, persist, onImport, onIssue }: {
  settings: GameSettings
  onChange: (patch: Partial<GameSettings>) => void
  onClose: () => void
  persist: Persist
  onImport: (p: Persist) => void
  onIssue: () => void
}) {
  const [slip, setSlip] = useState('')
  const [incoming, setIncoming] = useState('')
  const [issued, setIssued] = useState(false)

  const issue = () => { setSlip(encodeSlip(persist)); setIssued(true) }
  const burn = () => { onIssue(); setSlip(''); setIssued(false); onClose() }
  const receive = () => {
    const p = decodeSlip(incoming)
    if (!p) return
    onImport(p)
    setIncoming('')
    onClose()
  }

  return (
    <div className="dv2-drawer" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="dv2-drawer-sheet">
        <div className="dv2-drawer-handle" />
        <div className="dv2-drawer-title">THE DRAWER — SETTINGS</div>

        <div className="dv2-drawer-label">ACCESSIBILITY</div>
        <div className="dv2-drawer-row">
          <div className="dv2-drawer-copy">
            <b>Plain-language mode (Learner Mode)</b>
            <span>Glosses appear free — for anyone new to Nigerian public finance. It does not change the simulation.</span>
          </div>
          <button
            className={`dv2-switch${settings.learnerMode ? ' on' : ''}`}
            role="switch" aria-checked={settings.learnerMode}
            aria-label="Plain-language mode"
            onClick={() => onChange({ learnerMode: !settings.learnerMode })}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="dv2-drawer-row">
          <div className="dv2-drawer-copy">
            <b>Text size</b>
            <span>Scales documents and screens; the chrome stays put.</span>
          </div>
          <div className="dv2-seg">
            {([100, 125, 150] as const).map(v => (
              <button
                key={v}
                className={settings.textScale === v ? 'on' : ''}
                aria-pressed={settings.textScale === v}
                onClick={() => onChange({ textScale: v })}
              >{v}%</button>
            ))}
          </div>
        </div>
        <div className="dv2-drawer-row">
          <div className="dv2-drawer-copy">
            <b>Haptics</b>
            <span>Ticks while a hold is charging; the stamp’s thud on supported phones.</span>
          </div>
          <button
            className={`dv2-switch${settings.haptics ? ' on' : ''}`}
            role="switch" aria-checked={settings.haptics}
            aria-label="Haptics"
            onClick={() => onChange({ haptics: !settings.haptics })}
          >
            <span className="knob" />
          </button>
        </div>

        <div className="dv2-drawer-label">THE LIFE — ONE SAVE, NO RELOAD</div>
        <div className="dv2-drawer-copy solo">
          Phones get stolen and data is expensive. A transfer slip is not save-scumming — it is succession:
          one encrypted export, and the desk it came from is burned.
        </div>
        {!issued ? (
          <button className="dv2-act primary" onClick={issue}>
            <IcSlip width={16} height={16} /> ISSUE A TRANSFER SLIP
          </button>
        ) : (
          <div>
            <textarea className="dv2-slip" readOnly value={slip} aria-label="Transfer slip" onFocus={e => e.currentTarget.select()} />
            <div className="dv2-slip-hint">
              COPY THIS TONIGHT — IT WILL NOT BE SHOWN AGAIN. RECEIVING IT BURNS THIS DESK.
            </div>
            <button className="dv2-act danger" onClick={burn}>I HAVE THE SLIP — BURN THIS DESK</button>
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <div className="dv2-drawer-copy"><b>Receive a slip — continue on this phone</b></div>
          <textarea
            className="dv2-slip"
            value={incoming} onChange={e => setIncoming(e.target.value)}
            placeholder="paste a MANDATE-SLIP-1. code here" aria-label="Paste a transfer slip"
          />
          <button className="dv2-act" disabled={!incoming.trim()} onClick={receive}>RECEIVE THE SLIP</button>
        </div>

        <div className="dv2-act-block">
          <button className="dv2-act ghost" onClick={onClose}>CLOSE THE DRAWER</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [persist, setPersist] = useState<Persist>(load)

  // ---- first-open gate: profile + onboarding (Supabase-backed when configured) ----
  const [onboarding, setOnboarding] = useState<{
    phase: OnboardingPhase
    states: import('./profile').FederationState[]
    offices: import('./profile').FederationOffice[]
    parties: import('./profile').FederationParty[]
    stateCode: string | null
    officeId: string | null
    origin: 'civil-service' | 'party-youth' | 'business' | 'activist' | null
    bringer: 'godfather' | 'grassroots' | 'technocrat' | null
    scar: 'none' | 'contract-query' | 'protest' | null
    name: string
    age: string
    pronouns: string
    locale: string
    bio: string
    altName: string
    partyCode: string | null
    lgaName: string | null
    sheet: import('./profile').ProfileSheet | null
    error: string | null
  } | null>(null)
  const [tab, setTab] = useState<Tab>('desk')
  /* bumps whenever a life is written, so the atlas re-reads the registry */
  const [livesVersion, setLivesVersion] = useState(0)
  /* bumps whenever the country advances, so the folders re-read the cast and the calendar */
  const [worldVersion, setWorldVersion] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null)
  const [ticking, setTicking] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [literacy, setLiteracy] = useState(2)
  const [flash] = useState(0)
  // Supabase Auth: when configured, the player signs in and their profile/lives live on the
  // ledger server instead of (or in addition to) this device. When not configured, the app
  // boots to the local fallback unchanged.
  const [authUser, setAuthUser] = useState<{ id: string; email: string | null; name: string | null } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authAction, setAuthAction] = useState<'signin' | 'signup'>('signin')
  const expanded = useExpanded()
  const toastTimer = useRef(0)
  const tickTimer = useRef(0)

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(persist)) } catch { /* storage full/blocked */ }
  }, [persist])

  // First-open: boot the onboarding shell from Supabase when configured, else from the
  // local Delta tutorial fallback. This keeps the prototype bootable without a live DB.
  //
  // The first screen the player sees is the office picker; the NPC delta (M. A. Bamgboye /
  // 52 / Delta governor) is ONLY the fallback scenario the game drops into AFTER the player
  // has chosen office + identity, and only when no Supabase is configured. It is never served
  // as the player's own record on first open.
  useEffect(() => {
    // onboarding opens for a genuinely new file: no profile and no sim yet.
    // Old saves (pre-sim) have marks/decisions but neither — they keep their desk.
    if (persist.profileHandle || persist.sim) return
    let settled = false
    const settle = (onboarding: import('./profile').OnboardingState | null) => {
      if (settled) return
      settled = true
      setOnboarding(onboarding)
    }

    const bootLocalFallback = () => {
      // Local fallback: Delta tutorial reference data, but the player still starts on the
      // office picker with a blank identity. The Delta scenario only becomes the scenario / sheet
      // after the player picks Governor and a state, or after they accept a revised record.
      const states = defaultFederationReference.states
      const offices = defaultFederationReference.offices
      const parties = defaultFederationReference.parties
      settle({
        phase: 'landing',
        states,
        offices,
        parties,
        stateCode: null,
        officeId: null,
        origin: null,
        bringer: null,
        scar: null,
        name: '',
        age: '',
        pronouns: '',
        locale: '',
        bio: '',
        altName: '',
        partyCode: null,
        lgaName: null,
        sheet: null,
        error: null,
      })
    }

    const bootFromSupabase = async () => {
      try {
          if (!(typeof import.meta.env.VITE_SUPABASE_URL === 'string' && typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string')) { bootLocalFallback(); return }
        const [states, officesFromDb, parties] = await Promise.all([
          listStates(),
          listOffices(),
          listParties(),
        ])
        // the FCT has no governorship (s.299); its office row ships in migration 002, so a
        // not-yet-migrated database still gets a working picker rather than an 'Office not found.'
        const offices = ensureReferenceOffices(officesFromDb)
        settle({
          phase: 'landing',
          states,
          offices,
          parties,
          stateCode: null,
          officeId: null,
          origin: null,
          bringer: null,
          scar: null,
          name: '',
          age: '',
          pronouns: '',
          locale: '',
          bio: '',
          altName: '',
          partyCode: null,
          lgaName: null,
          sheet: null,
          error: null,
        })
      } catch (err) {
        // Any Supabase read failure falls back to the local Delta tutorial picker.
        console.warn('profile boot fell back to local Delta tutorial:', err)
        bootLocalFallback()
      }
    }

    // When the player is signed in, the onboarding still opens on the landing step — but
    // the landing step now knows the player is authenticated and can offer account-aware
    // actions (switch life, resume remote save, start new life on the server).
    bootFromSupabase()
  }, [persist.profileHandle, authUser])

  const showToast = (msg: string) => {
    setToast({ id: Date.now(), msg })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(tickTimer.current) }, [])

  // Supabase Auth: keep the session fresh and surface the signed-in user. When Supabase
  // is configured and the player is signed in, the profile + lives live on the ledger
  // server; when it is not, the app stays on the local fallback unchanged.
  useEffect(() => {
    let alive = true
    const refresh = async () => {        if (!(typeof import.meta.env.VITE_SUPABASE_URL === 'string' && typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string')) {
        if (alive) { setAuthLoading(false); setAuthUser(null) }
        return
      }
      try {
        const user = await getCurrentUser()
        if (alive) {
          setAuthLoading(false)
          setAuthUser(user ? { id: user.id, email: user.email ?? null, name: user.email ?? null } : null)
        }
      } catch {
        if (alive) { setAuthLoading(false); setAuthUser(null) }
      }
    }
    refresh()
    const interval = window.setInterval(refresh, 60_000)
    return () => { alive = false; window.clearInterval(interval) }
  }, [])

  // When a user signs in, pull their lives from the ledger server into localStorage so the
  // desk continues from the server state. When they sign out, the on-device lives stay as-is
  // (the transfer slip is still the portable path).
  useEffect(() => {
    if (authUser === null) return
    let cancelled = false
    Promise.resolve().then(async () => {
      const client = publicClient()
      if (!client) return
      const remote = await loadLivesFromSupabase(client, authUser!.id)
      if (cancelled || !remote) return
      const local = loadLives(window.localStorage)
      if (!local) {
        saveLives(window.localStorage, remote)
        setLivesVersion(v => v + 1)
        return
      }
      const localIds = new Set(local.lives.map(l => l.id))
      const merged = [...local.lives]
      for (const rl of remote.lives) {
        if (!localIds.has(rl.id)) merged.push(rl)
      }
      const activeId = remote.activeId ?? local.activeId ?? merged[0]?.id ?? null
      const registry: LifeRegistry = { activeId, lives: merged }
      saveLives(window.localStorage, registry)
      setLivesVersion(v => v + 1)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [authUser])

  const handleAuthAction = async () => {
    if (!email.trim() || password.length < 6) {
      setAuthError('Enter an email and a password of at least 6 characters.')
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    try {
      const result = authAction === 'signin'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password)
      if (result.error) throw result.error
      // signUpWithPassword now signs the user in as part of the call, so the session is
      // immediately visible — no waitForAuth polling, no email confirmation step.
      if (result.data?.user) {
        setAuthUser({ id: result.data.user.id, email: result.data.user.email ?? null, name: result.data.user.email ?? null })
      }
    } catch (err: any) {
      setAuthError(err?.message ?? 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      await signOut()
      setAuthUser(null)
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setAuthError(err?.message ?? 'Sign out failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  /* §: ornaments mean something — a stain only once a file has held your attention */
  useEffect(() => {
    if (!openId || (persist.weathered ?? []).includes(openId)) return
    const id = openId
    const t = window.setTimeout(() => {
      setPersist(pr => ({ ...pr, weathered: [...(pr.weathered ?? []), id] }))
    }, 30_000)
    return () => window.clearTimeout(t)
  }, [openId, persist.weathered])

  /* §13.1: the tick is the desk being tidied overnight — never a spinner.
     Filing the week advances the simulation and produces Monday's papers. */
  const closeWeek = () => {
    if (ticking) return
    setTicking(true)
    tickTimer.current = window.setTimeout(() => {
      // decisions already paid for at an earlier close are not paid again;
      // spillover decisions (e.g. ASUU past its window) stay pending and unpaid
      const applied = persist.decisionsApplied ?? {}
      const freshChoices = Object.fromEntries(
        Object.entries(persist.decisions).filter(([id]) => !applied[id]),
      )
      const prior = persist.sim ?? createDeskSim('state/governor', 'Delta')
      const result = closeWeekSim(prior, freshChoices, persist.identity)
      /* One Monday of the living country, at the same instant the desk's own week closes.
         The cast is 250 actors and the tick is milliseconds, so it runs here rather than in
         a worker. The tray being closed is handed over with its stamps: an approach answered
         on paper is answered to the man who sent it before his Monday is run. A desk that
         cannot reach its storage still closes its week: the world is skipped, never blamed. */
      /* Restore the player's axes/bank from the on-device life save before the living week
         runs, so a reload mid-simulation keeps the player's record rather than snapping back to
         the neutral defaults. */
      let livingInput = livingInputFor(persist.identity, result.approval)
      if (livingInput) {
        restorePlayerFromSave({ currentLifeId: persist.profileHandle ?? null }, livingInput, window.localStorage)
      }
      const living = (() => {
        if (!livingInput) return null
        try {
          return closeLivingWeek({
            storage: window.localStorage,
            player: livingInput,
            tray: persist.inTray,
            marks: persist.marks,
          })
        } catch {
          return null
        }
      })()
      const nextWeek = (persist.weekNumber ?? ANCHOR_WEEK) + 1
      const appliedNext: Record<string, true> = { ...applied }
      for (const id of Object.keys(freshChoices)) appliedNext[id] = true
      setTicking(false)
      setWorldVersion(v => v + 1)
      setPersist(pr => ({
        ...pr,
        sim: result.snapshot,
        /* the answers moved money and standing: the strip shows the bank the world just
           spent from, and a leak the desk let run shows up where every other read of the
           public shows up */
        identity: living && pr.identity && typeof living.bank === 'number'
          ? { ...pr.identity, patronageBank: living.bank }
          : pr.identity,
        publicApproval: Math.max(0, Math.min(100, result.approval + (living?.approvalDelta ?? 0))),
        weekNumber: nextWeek,
        // the sim's own papers, then whatever the country put on the tray this week
        inTray: [...result.documents, ...(living?.papers ?? [])],
        livingPress: living?.stories ?? [],
        decisionsApplied: appliedNext,
        // the new week: fresh hours, fresh reading stains, fresh op book
        hoursBook: {},
        ops: {},
        glossQuarters: 0,
        weathered: [],
      }))
      const urgent = living?.papers.filter(d => d.mark === 'urgent').length ?? 0
      showToast(`WEEK ${nextWeek} FILED — ${result.headline.toUpperCase()}${urgent > 0 ? ` · ${urgent} URGENT FROM THE COUNTRY` : ''}`)
    }, 1900)
  }

  /* accept the profile sheet: persist the file (who survives reload) and open
     the desk on the career the office picker chose. This is where the simulation
     is born — approval 50, allies as NPC targets, one reporter, tenure at week 78.
     Only the Delta tutorial scenario opens on the authored Week 41 pack; every
     other profile opens on its own personalized sim-fed desk. */
  const acceptAndEnter = (o: NonNullable<typeof onboarding>) => {
    const stateRec = o.states.find(s => s.code === o.stateCode)
    const officeRec = o.offices.find(x => x.id === o.officeId)
    const officeId = o.officeId ?? 'state/governor'
    const stateName = stateRec?.name ?? 'Delta'
    const tier = officeRec?.tier ?? 'state'
    const isTutorial = officeId === 'state/governor' && stateRec?.code === 'DT' && !o.lgaName
    const identity: DeskIdentity = {
      name: (o.name || o.sheet?.name || 'The Player').trim(),
      post: officeRec?.post ?? 'Executive Governor of Delta State',
      officeLabel: o.sheet?.office ?? 'STATE GOVERNMENT',
      state: stateName,
      capital: stateRec?.capital ?? 'Asaba',
      lga: o.lgaName,
      /* the catalogue seat this desk sits at, resolved once, here, rather than re-read
         from the identity's prose on every week the country runs */
      positionId: seatIdForIdentity({ post: officeRec?.post, state: stateName, lga: o.lgaName }),
      party: o.parties.find(p => p.code === o.partyCode)?.name ?? o.sheet?.party ?? 'INDEPENDENT',
      honorific: tier === 'local' ? 'The Honourable Chairman'
        : tier === 'fct' ? 'The Honourable Minister'
        : 'His Excellency',
      digestHead: tier === 'federal' ? 'PRESIDENTIAL SECURITY DIGEST'
        : tier === 'fct' ? 'FCT SECURITY DIGEST'
        : tier === 'local' ? `${stateName.toUpperCase()} COUNCIL SECURITY DIGEST`
        : `${stateName.toUpperCase()} STATE SECURITY DIGEST`,
      pollsterTitle: tier === 'federal' ? 'Special Adviser (Polling)'
        : tier === 'local' ? 'PA (Ward Read)'
        : 'SSA (Polling)',
      isDeltaTutorial: isTutorial,
      /* the sheet prints the patronage bank as money; keep the number so the
         patrons folder can carry it across thirteen weeks (§ money is naira) */
      patronageBank: (() => {
        const digits = (o.sheet?.patronageBank ?? '').replace(/[^0-9]/g, '')
        return digits ? Number(digits) : undefined
      })(),
      patrons: [],
    }
    setPersist(pr => pr.sim ? pr : {
      ...pr,
      profileHandle: pr.profileHandle ?? 'local-desk',
      sim: createDeskSim(officeId, stateName),
      identity,
      handoverDone: isTutorial ? pr.handoverDone : true, // the orientation note replaces the authored handover
      inTray: isTutorial ? pr.inTray : [orientationNote(ANCHOR_WEEK, identity)],
      publicApproval: 50,
    })
    setOnboarding({ ...o, phase: 'entering-desk' })
    // When signed in, persist the profile row on the ledger server so it survives across
    // devices. The row is keyed on auth.uid() so RLS scopes it to this account.
    if (authUser && isSupabaseConfigured()) {
      const client = publicClient()
      if (client) {
        const profileAxes: import('./profile/types').ProfileAxes = {
          competence: 5000, integrity: 5000, popularSupport: 5000, partyLoyalty: 5000,
          eliteTrust: 5000, pressTone: 0, constituencyAlignment: 5000, patronageBank: identity.patronageBank ?? 0,
          mandateLegitimacy: 6000, institutionalMemory: 3000,
        }
        const profileParty: import('./profile/types').ProfileParty = {
          current: o.partyCode ?? identity.party,
          history: [],
          defectionRisk: 0.18,
        }
        const profileOffice: import('./profile/types').ProfileOffice = {
          tier: tier as import('./profile/types').Tier,
          post: identity.post,
          elected: true,
          termStart: '2026-10-08',
          officeId: officeId,
        }
        createProfile({
          handle: identity.name.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'PLAYER',
          identity: {
            name: identity.name,
            stateCode: stateRec?.code ?? null,
            lgaName: identity.lga,
            senatorialDistrict: null,
            pronouns: null,
            locale: null,
            phoneHome: null,
            altName: null,
            bio: null,
            age: 52,
            chosenParty: profileParty.current,
          },
          office: profileOffice,
          party: profileParty,
          axes: profileAxes,
          powers: DELTA_TUTORIAL_OFFICE.powers,
          patronageBank: identity.patronageBank ?? 0,
          profileId: authUser.id,
        }).catch(() => {
          /* silent: the desk stays on device even if the server profile write fails */
        })
      }
    }
  }

  /* resume: an existing desk stays on its device — mark the gate so the boot
     landing doesn't re-open next cold start, then straight to the desk. */
  const resumeDesk = () => {
    setPersist(pr => ({ ...pr, profileHandle: pr.profileHandle ?? 'local-desk' }))
    setOnboarding(null)
  }

  const openDoc = (id: string) => setOpenId(id)
  const doc = openId ? findDoc(openId, persist.inTray) : undefined

  const setMark = (id: string, m: DocMarkState) =>
    setPersist(p => ({ ...p, marks: { ...p.marks, [id]: m } }))

  /* off the books — run one dirty trick through the real sim machinery. It
     costs no desk hours (that is the point of off the books), but the approval
     swing lands immediately and the exposure shows up as events, not as text. */

  const settings = persist.settings ?? DEFAULT_SETTINGS
  const setSettings = (patch: Partial<GameSettings>) =>
    setPersist(pr => ({ ...pr, settings: { ...(pr.settings ?? DEFAULT_SETTINGS), ...patch } }))

  const hooks: GameHooks = {
    settings,
    askAide: () => {
      setPersist(pr => ({ ...pr, glossQuarters: (pr.glossQuarters ?? 0) + 1 }))
      showToast('THE AIDE EXPLAINS — ¼ DESK HOUR (loyalty may colour this)')
    },
    literacy,
    setLiteracy,
  }

  /* ---------- the DeskCard surface (deskV2) ---------- */
  const deskWeek = persist.weekNumber ?? ANCHOR_WEEK
  const liveDec = DECISIONS.find(d => !decStatus(d, persist).done)
  const liveCard = liveDec
    ? {
        title: liveDec.question,
        status: 'PENDING',
        description: `On the desk now: ${liveDec.options[0]?.sub ?? 'no terms recorded'}.`
          + (liveDec.options[1] ? ` The other hand is ${liveDec.options[1].sub}.` : ''),
        impacts: liveDec.options
          .flatMap(o => o.sub.split('·'))
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 4),
      }
    : null
  const signKey = liveDec?.options[0]?.key
  const rejectKey = liveDec ? liveDec.options[liveDec.options.length - 1]?.key : undefined

  /* signing and rejecting write the decision the week-close already knows how to
     read; deferring leaves it pending, which is exactly what a deferral is. */
  const takeDecision = (key: string | undefined) => {
    if (!liveDec || !key) {
      showToast('NO LIVE DECISION ON THIS DESK — THE FILE IS A STAND-IN')
      return
    }
    const opt = liveDec.options.find(o => o.key === key)
    setPersist(pr => ({
      ...pr,
      decisions: { ...pr.decisions, [liveDec.id]: key },
      hoursBook: { ...pr.hoursBook, [liveDec.id]: true },
    }))
    showToast(`RECORDED — ${(opt?.label ?? key).toUpperCase()} · ${liveDec.hours} DESK HOURS`)
  }

  const deferDecision = () => {
    showToast(liveDec
      ? 'DEFERRED — THE FILE STAYS ON THE DESK AND THE CLOCK KEEPS RUNNING'
      : 'NOTHING TO DEFER — THE CARD IS A STAND-IN')
  }

  /* Choosing a seat in the atlas starts a NEW LIFE: it appends a save row and leaves the
     desk, the profile and every earlier life untouched. Nothing is ever wiped. */
  const runForSeat = (positionId: string) => {
    const seat = POSITIONS.find(p => p.id === positionId)
    const registry = createNewLife(window.localStorage, {
      playerName: persist.identity?.name || 'The Player',
      positionId,
      // the largest machine is the default until the party picker reads the catalogue
      partyCode: 'PA',
      startDate: '2026-01-01',
      bank: 0,
    })
    const life = registry.lives.find(l => l.id === registry.activeId)
    setLivesVersion(v => v + 1)
    showToast(`NEW LIFE — ${life?.playerName ?? 'the player'} files for ${seat?.title ?? positionId}. ${registry.lives.length} on file.`)
    setTab('desk')
    // When signed in, push the lives registry to the ledger server so it survives across
    // devices for this account. RLS scopes saves to profile_id = auth.uid().
    if (authUser && typeof import.meta.env.VITE_SUPABASE_URL === 'string' && typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string') {
      const client = publicClient()
      if (client) {
        syncLivesToSupabase(client, authUser.id, registry).catch(() => {
          /* silent: the desk stays on device even if the server sync fails */
        })
      }
    }
  }

  /* Urgent first, then the order they arrived. The desk shows five files, so a week with a
     request for money and a paper from the country must not bury the request under the
     week's digest. Array.prototype.sort is stable, so equal marks keep their order. */
  const shellTray = (deskV2 ? persist.inTray : authoredTrayDocs(persist))
    .slice()
    .sort((a, b) => (b.mark === 'urgent' ? 1 : 0) - (a.mark === 'urgent' ? 1 : 0))
    .slice(0, 5)
    .map(d => ({ id: d.id, title: d.title, trayLine: d.trayLine, mark: d.mark }))

  /* ---------- the folders, all of them, in the desk's own clothes ---------- */
  const seatLevel = deskLevelOf(persist.identity)
  const seatCapital = persist.identity?.capital ?? 'Abuja'
  const seatName = persist.identity?.name
  const goTab = (t: Tab) => { setOpenId(null); setTab(t) }
  const backToDesk = () => { setOpenId(null); setTab('desk') }

  /* the treasury is read through the purse in the folders bar, not by leaving the desk */
  const treasury = (
    <TreasuryScreen
      title="Consolidated Revenue Fund — State Treasury"
      sub={`OCTOBER 2026 · WEEK ${deskWeek} · ALL FIGURES TO THE NAIRA`}
      opening={OPENING_BALANCE}
      openingLabel="OPENING, 1 OCT"
      openingNote={OPENING_NOTE}
      rows={BUDGET}
      closing={BUDGET_CLOSING}
      closingLabel="CLOSING"
      pendingTotal={PENDING_TOTAL}
      afterSanction={CLOSING_AFTER_SANCTION}
      authority="ss.121–125 — STATE APPROPRIATION (ANALOG OF ss.80–89)"
      shortfall={SHORTFILL_NAIRA}
    />
  )

  /* the cabinet is built from the save: anything stamped, annotated or decided */
  const cabinetRows: CabinetRow[] = (() => {
    const rows: CabinetRow[] = []
    if (persist.handoverDone) {
      rows.push({ id: HANDOVER.id, title: HANDOVER.title, recordId: HANDOVER.recordId, state: 'FILED AWAY', tone: 'good' })
    }
    for (const d of [...DOCS, ...(persist.inTray ?? [])]) {
      const mark = persist.marks[d.id]
      const stamp = mark?.stamps[0]
      const decided = DECISIONS.some(x => x.docId === d.id && decStatus(x, persist).done)
      const annotated = (mark?.annotations.length ?? 0) > 0
      if (!stamp && !decided && !annotated) continue
      rows.push({
        id: d.id,
        title: d.title,
        recordId: d.recordId,
        state: stamp ? `STAMPED ${stamp.label}` : decided ? 'DECIDED' : 'ANNOTATED',
        tone: stamp?.label === 'APPROVED' || decided ? 'good' : 'plain',
      })
    }
    return rows
  })()
  const referenceDocs = allDocs().filter(d => d.kind !== 'tell').slice(0, 8)
    .map(d => ({ id: d.id, title: d.title, authority: d.authority }))

  /* the country this desk is running, read from its own key so the folders can show the
     cast and the calendar without waiting for a week to close. Before the first close there
     is no world on file: the calendar still answers, the cast is empty, and the folder says
     so rather than inventing names. */
  const { cast: livingCastNow, polls: livingPolls } = useMemo(() => {
    try {
      const world = loadWorld(window.localStorage)
      if (!world) return { cast: [] as CastMember[], polls: upcomingPolls('2026-01-01', 4) }
      return { cast: livingCast(world, 8), polls: upcomingPolls(world.date, 4) }
    } catch {
      return { cast: [] as CastMember[], polls: upcomingPolls('2026-01-01', 4) }
    }
  }, [worldVersion, tab])

  /* the century: every life on file, newest first, read when the atlas opens */
  const atlasLives: AtlasLife[] = useMemo(() => {
    try {
      const registry = loadLives(window.localStorage)
      return lifeList(window.localStorage).map(life => ({
        id: life.id,
        summary: lifeSummary(life),
        active: life.id === registry?.activeId,
        ended: Boolean(life.retiredAt),
      }))
    } catch {
      return []
    }
  }, [livesVersion, tab])

  /* off the books — one run through the real machinery, recorded on the ops book.
     The approval swing lands immediately; the probe, if it lands at all, becomes
     an event the next week has to live with. No desk hours are charged: that is
     the whole temptation, and the ops folder says so at the top. */
  const runOp = (trick: DirtyTrick) => {
    const snapshot = persist.sim ?? createDeskSim('state/governor', persist.identity?.state ?? 'Delta')
    const outcome = executeOp(snapshot, trick)
    const recorded: OpResult = { ok: outcome.ok, effect: outcome.effect, approval: outcome.approval, efcc: outcome.efcc }
    setPersist(pr => ({
      ...pr,
      sim: outcome.snapshot,
      ops: { ...(pr.ops ?? {}), [trick]: recorded },
      publicApproval: Math.max(0, Math.min(100, (pr.publicApproval ?? 50) + outcome.approval)),
    }))
    showToast(`OFF THE BOOKS — ${outcome.effect.toUpperCase()}`)
  }

  /* The week's paper: the simulation's own stories, then what the living country's press
     printed. A leak on a rival is as much of the week's paper as a shock is, and both are
     read the same way — as clippings. */
  const pressStories: GazetteStory[] = [
    ...(persist.sim?.state?.media?.gazetteStories ?? []),
    ...(persist.livingPress ?? []),
  ]

  const screens: Record<Tab, React.ReactNode> = {
    desk: deskV2 ? (
      <DeskShell
        level={seatLevel}
        week={deskWeek}
        capital={seatCapital}
        budget={BUDGET_CLOSING}
        patrons={livingCastNow.length > 0 ? livingCastNow : shellPatrons(persist.identity)}
        card={liveCard}
        cardDeadline={liveDec?.deadline}
        signNote={liveDec?.options[0]?.label}
        deferNote="stays on the desk"
        rejectNote={liveDec?.options[liveDec.options.length - 1]?.label}
        onSign={() => takeDecision(signKey)}
        onDefer={deferDecision}
        onReject={() => takeDecision(rejectKey)}
        gazette={gazetteFor(persist)}
        tray={shellTray}
        onOpenDoc={openDoc}
        onOpenCabinet={() => goTab('files')}
        onOpenTreasury={() => goTab('budget')}
        activeTab="desk"
        onTabChange={goTab}
        onCloseWeek={closeWeek}
        ticking={ticking}
      />
    ) : <DeskScreen p={persist} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />,

    budget: (
      <FolderShell
        tab="desk"
        kicker="FOLDER · THE TREASURY"
        title="THE CONSOLIDATED REVENUE FUND"
        sub={`Every posted line, the pending items called out separately, and the closing balance. Week ${deskWeek} — no figure here is rounded.`}
        level={seatLevel} week={deskWeek} capital={seatCapital} budget={BUDGET_CLOSING}
        onTabChange={goTab} onBack={backToDesk} backLabel="BACK TO THE DESK"
        onOpenTreasury={() => goTab('budget')}
      >
        {treasury}
      </FolderShell>
    ),

    files: (
      <FolderShell
        tab="desk"
        kicker="FOLDER · THE CABINET"
        title="WHAT THE PAPER REMEMBERS"
        sub="Every file you stamped, signed, annotated or decided, in the order the tray worked it — plus the reference shelf, which is never worked."
        level={seatLevel} week={deskWeek} capital={seatCapital} budget={BUDGET_CLOSING}
        onTabChange={goTab} onBack={backToDesk} backLabel="BACK TO THE DESK"
        onOpenTreasury={() => goTab('budget')}
      >
        <CabinetScreen
          rows={cabinetRows}
          reference={referenceDocs}
          onOpen={openDoc}
          onOpenDrawer={() => setDrawer(true)}
        />
      </FolderShell>
    ),

    patrons: (
      <FolderShell
        tab="patrons"
        kicker="FOLDER · THE BOOK OF OWED"
        title="PATRONAGE"
        sub="Who put you here, what they are owed, and when the returns fall due. Loyalty decides what the desk never has to say out loud."
        level={seatLevel} week={deskWeek} capital={seatCapital} budget={BUDGET_CLOSING}
        onTabChange={goTab} onOpenTreasury={() => goTab('budget')}
      >
        <PatronsScreen
          patrons={livingCastNow.length > 0 ? livingCastNow : shellPatrons(persist.identity)}
          cast={livingCastNow}
          patronageBank={persist.identity?.patronageBank}
          seatName={seatName}
          approval={persist.publicApproval}
        />
      </FolderShell>
    ),

    press: (
      <FolderShell
        tab="press"
        kicker="FOLDER · THE PRESS"
        title="WHAT THE PAPERS SAY"
        sub="This week's paper, printed as the desk prints it. A story is not the truth and it is not a lie — it is what survives the second day."
        level={seatLevel} week={deskWeek} capital={seatCapital} budget={BUDGET_CLOSING}
        onTabChange={goTab} onOpenTreasury={() => goTab('budget')}
      >
        <PressScreen
          stories={pressStories}
          week={deskWeek}
          seatName={seatName}
        />
      </FolderShell>
    ),

    ops: (
      <FolderShell
        tab="ops"
        kicker="FOLDER · OFF THE BOOKS"
        title="THE OTHER LEDGER"
        sub="EFCC and ICPC keep this one. Nothing in here costs a Desk Hour, and that is exactly why every move prints its exposure before you touch it."
        level={seatLevel} week={deskWeek} capital={seatCapital} budget={BUDGET_CLOSING}
        onTabChange={goTab} onOpenTreasury={() => goTab('budget')}
      >
        <OpsScreen
          ops={(persist.ops ?? {}) as Record<string, OpResult>}
          onOrder={runOp}
          approval={persist.publicApproval}
          deskHoursLeft={deskHoursLeft(persist)}
        />
      </FolderShell>
    ),

    atlas: (
      <AtlasScreen
        lives={atlasLives}
        polls={livingPolls}
        onRunFor={runForSeat}
        level={seatLevel}
        week={deskWeek}
        capital={seatCapital}
        budget={BUDGET_CLOSING}
        onTabChange={goTab}
        onOpenTreasury={() => goTab('budget')}
      />
    ),
  }

  const documentView = doc ? (
    <DocumentView
      key={doc.id}
      doc={doc}
      mark={persist.marks[doc.id] ?? EMPTY_MARK}
      weathered={(persist.weathered ?? []).includes(doc.id)}
      signer={(persist.identity && !persist.identity.isDeltaTutorial) ? persist.identity.name : undefined}
      onBack={() => setOpenId(null)}
      onMark={m => setMark(doc.id, m)}
      onToast={showToast}
      pendingDecision={
        doc.id !== 'handover' &&
        DECISIONS.some(x => x.docId === doc.id && !decStatus(x, persist).done)
      }
      onGoDecide={() => { setOpenId(null); setTab('desk') }}
      onFileAway={doc.id === 'handover'
        ? () => {
            setOpenId(null)
            setPersist(pr => ({ ...pr, handoverDone: true }))
            showToast('FILED AWAY — IT WILL NOT COME BACK')
          }
        : undefined}
    />
  ) : null

  const overlays = (
    <>
      {drawer && (
        <SettingsDrawer
          settings={settings} onChange={setSettings} onClose={() => setDrawer(false)}
          persist={persist}
          onImport={p => { setPersist(p); showToast('SLIP RECEIVED — YOUR RECORD CONTINUES HERE') }}
          onIssue={() => {
      setPersist(emptyPersist())
      try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
      showToast('TRANSFER SLIP ISSUED — THIS DESK IS BURNED')
          }}
        />
      )}
      {ticking && (
        <div className="dv2-ticking" aria-live="polite">
          <div className="tick-stack">
            <span className="tick-sheet t1" />
            <span className="tick-sheet t2" />
            <span className="tick-sheet t3" />
            <span className="tick-sheet t4" />
          </div>
          <div className="dv2-ticking-lamp" />
          <div className="dv2-ticking-word">
            TIDYING THE DESK OVERNIGHT — WEEK {deskWeek} → FILED
          </div>
        </div>
      )}
      {flash > 0 && <span className="commit-flash" key={flash} />}
      {toast && <div className="dv2-toast" key={toast.id} role="status" aria-live="polite">{toast.msg}</div>}
    </>
  )

  /* the screen itself, without the phone's own chrome — the wide desk puts it in
     its middle column, the phone renders it inside the surface below */
  const screenNow = documentView ?? screens[tab]

  const surface = (
    <>
      {/* first-open onboarding shell: pick a federation post, run a short prologue, then enter the desk */}
      {onboarding && onboarding.phase !== 'none' && onboarding.phase !== 'entering-desk' ? (
        <main className="app-main dv2" key="onboarding">
          <div className="zoom-layer">
            <div className="dv2-onboard">
              <header className="dv2-onboard-head">
                <span className="dv2-onboard-kicker">{(ONBOARD_FLOW.find(s2 => s2.phase === onboarding.phase) ?? ONBOARD_DOOR).kicker}</span>
                <h1 className="dv2-onboard-title">{(ONBOARD_FLOW.find(s2 => s2.phase === onboarding.phase) ?? ONBOARD_DOOR).title}</h1>
                <span className="dv2-onboard-step">
                  {onboarding.phase === 'landing'
                    ? 'ONE LIFE, NO RELOAD · SAVED ON THIS DEVICE'
                    : `${indexOfStep(onboarding.phase)} OF ${ONBOARD_FLOW.length} — ${ONBOARD_FLOW.length - indexOfStep(onboarding.phase)} TO GO`}
                </span>
                {onboarding.phase !== 'landing' && (
                  <span className="dv2-onboard-track" aria-hidden>
                    {ONBOARD_FLOW.map((step, i) => (
                      <span key={step.phase} className={`dv2-onboard-tick${i < indexOfStep(onboarding.phase) ? ' on' : ''}`} />
                    ))}
                  </span>
                )}
              </header>
              {onboarding.error ? (
                <div className="dv2-error">{onboarding.error}</div>
              ) : onboarding.phase === 'landing' ? (
                <LandingStep
                  week={persist.weekNumber ?? ANCHOR_WEEK}
                  approval={persist.publicApproval ?? 50}
                  hasSave={Object.keys(persist.marks).length > 0 || Object.keys(persist.decisions).length > 0 || (persist.weekNumber ?? 41) > ANCHOR_WEEK}
                  onNew={() => setOnboarding(o => (o ? { ...o, phase: 'pick-post' } : null))}
                  onResume={resumeDesk}
                  onSlip={code => {
                    const p = decodeSlip(code)
                    if (!p) return false
                    setPersist({ ...emptyPersist(), ...p, inTray: p.inTray ?? [], hoursBook: p.hoursBook ?? {}, ops: p.ops ?? {}, weekNumber: p.weekNumber ?? ANCHOR_WEEK, publicApproval: p.publicApproval ?? 50 })
                    setOnboarding(null)
                    showToast('SLIP RECEIVED — YOUR RECORD CONTINUES HERE')
                    return true
                  }}
                  authUser={authUser}
                  supabaseConfigured={typeof import.meta.env.VITE_SUPABASE_URL === 'string' && typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string'}
                  onSignIn={handleAuthAction}
                  onSignUp={handleAuthAction}
                  onSignOut={handleSignOut}
                  authLoading={authLoading}
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  authAction={authAction}
                  setAuthAction={setAuthAction}
                  authError={authError}
                  setAuthError={setAuthError}
                />
              ) : onboarding.phase === 'pick-post' ? (
                <PostStep
                  offices={FALLBACK_OFFICES}
                  onPost={office => setOnboarding(o => {
                    if (!o) return null
                    const route = postRoute(office)
                    if (route.kind === 'direct') {
                      // appointed/nationwide posts need no jurisdiction step (FCT seat = Abuja)
                      return { ...o, phase: 'pick-identity', officeId: office.id, stateCode: route.stateCode, lgaName: null }
                    }
                    return { ...o, phase: 'pick-state', officeId: office.id, stateCode: null, lgaName: null }
                  })}
                  onBack={() => setOnboarding(null)}
                />
              ) : onboarding.phase === 'pick-state' ? (
                <PickStateStep
                  states={stateChoicesFor(
                    onboarding.offices.find(o => o.id === onboarding.officeId) ?? DELTA_TUTORIAL_OFFICE,
                    onboarding.states,
                  )}
                  stateCode={onboarding.stateCode}
                  sub={onboarding.officeId === 'local/chairman'
                    ? 'Which state is your council in? The 774 LGAs sit under the states and the FCT.'
                    : onboarding.officeId === 'state/governor'
                      ? 'Pick the state you will govern. The 36 states — the FCT has no governorship (s.299).'
                      : undefined}
                  onState={stateCode => setOnboarding(o => {
                    if (!o) return null
                    const office = o.offices.find(x => x.id === o.officeId)
                    const route = office ? postRoute(office) : null
                    if (route?.kind === 'state-then-lga') {
                      return { ...o, phase: 'pick-lga', stateCode }
                    }
                    return { ...o, phase: 'pick-identity', stateCode }
                  })}
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-post', stateCode:null, lgaName:null} : null))}
                />
              ) : onboarding.phase === 'pick-lga' ? (
                <LgaStep
                  state={onboarding.states.find(s => s.code === onboarding.stateCode) ?? DELTA_TUTORIAL_STATE}
                  onLga={lga => setOnboarding(o => (o ? {...o, phase:'pick-identity', stateCode: lga.stateCode, lgaName: lga.name} : null))}
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-state', lgaName:null} : null))}
                />
              ) : onboarding.phase === 'pick-identity' ? (
                <IdentityStep
                  stateName={onboarding.states.find(s => s.code === onboarding.stateCode)?.name ?? 'State'}
                  office={onboarding.offices.find(o => o.id === onboarding.officeId) ?? DELTA_TUTORIAL_OFFICE}
                  name={onboarding.name}
                  age={onboarding.age}
                  pronouns={onboarding.pronouns}
                  locale={onboarding.locale}
                  bio={onboarding.bio}
                  altName={onboarding.altName}
                  setName={v => setOnboarding(o => (o ? {...o, name: v} : null))}
                  setAge={v => setOnboarding(o => (o ? {...o, age: v} : null))}
                  setPronouns={v => setOnboarding(o => (o ? {...o, pronouns: v} : null))}
                  setLocale={v => setOnboarding(o => (o ? {...o, locale: v} : null))}
                  setBio={v => setOnboarding(o => (o ? {...o, bio: v} : null))}
                  setAltName={v => setOnboarding(o => (o ? {...o, altName: v} : null))}
                  onDone={() => setOnboarding(o => (o ? {...o, phase:'pick-party'} : null))}
                  onBack={() => setOnboarding(o => {
                    if (!o) return null
                    // back goes to the step BEFORE this one: a post that needs a
                    // jurisdiction returns to the jurisdiction, an appointed one to the list
                    const office = o.offices.find(x => x.id === o.officeId)
                    const route = office ? postRoute(office) : null
                    return { ...o, phase: route?.kind === 'direct' ? 'pick-post' : 'pick-state', lgaName: null }
                  })}
                />
              ) : onboarding.phase === 'pick-party' ? (
                <PartyStep
                  parties={onboarding.parties}
                  partyCode={onboarding.partyCode}
                  onParty={code => setOnboarding(o => (o ? {...o, partyCode: code} : null))}
                  onNext={() => setOnboarding(o => (o ? {...o, phase:'prologue'} : null))}
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-identity'} : null))}
                />
              ) : onboarding.phase === 'prologue' ? (
                <PrologueStep
                  origin={onboarding.origin}
                  bringer={onboarding.bringer}
                  scar={onboarding.scar}
                  name={onboarding.name}
                  stateName={onboarding.states.find(s => s.code === onboarding.stateCode)?.name ?? 'State'}
                  office={onboarding.offices.find(o => o.id === onboarding.officeId) ?? DELTA_TUTORIAL_OFFICE}
                  onOrigin={id => setOnboarding(o => (o ? {...o, origin: id} : null))}
                  onBringer={id => setOnboarding(o => (o ? {...o, bringer: id} : null))}
                  onScar={id => setOnboarding(o => (o ? {...o, scar: id} : null))}
                  onDone={() => setOnboarding(o => (o ? nextSheetState(o as import('./profile').OnboardingState) : null))}
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-party'} : null))}
                />
              ) : onboarding.phase === 'profile-sheet' && onboarding.sheet ? (
                <ProfileSheetStep
                  sheet={onboarding.sheet}
                  onAccept={() => { if (onboarding) acceptAndEnter(onboarding) }}
                  /* revise: back to the post picker — the record you are revising starts with the office */
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-post', origin:null,bringer:null,scar:null,lgaName:null} : null))}
                />
              ) : null}
            </div>
          </div>
        </main>
      ) : (
        /* the folders bar belongs to the folder screen itself (FolderShell / DeskShell),
           so the surface never paints a second one underneath it */
        <main className="app-main" key={tab}>
          <div className="zoom-layer">{screenNow}</div>
        </main>
      )}
    </>
  )

  return (
    <GameContext.Provider value={hooks}>
      <div className="desk-bg">
        <div className="phone grain" data-scale={settings.textScale}>
          {expanded ? (
            /* The wide desk: the same three columns it always had, but wearing the
               new furniture — the in-tray and the handover papers on the left, the
               surface in the middle, the reference shelf and the clock on the right. */
            <div className="app-body expanded">
              <div className="dv2-cols">
                <aside className="dv2-col" aria-label="In-tray">
                  <div className="dv2-col-head">
                    IN-TRAY
                    <small>{deskWeekLine(persist.identity, deskWeek)}</small>
                  </div>
                  <div className="dv2-col-scroll">
                    <section className="dv2-panel tight">
                      <div className="dv2-panel-head">
                        <span className="dv2-panel-title">ON THE DESK</span>
                        <span className="dv2-panel-hint">{shellTray.length} file{shellTray.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="dv2-rows">
                        {shellTray.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            className="dv2-row"
                            data-tone={d.mark === 'urgent' ? 'urgent' : 'none'}
                            onClick={() => openDoc(d.id)}
                          >
                            <span className="dv2-row-main">
                              <span className="dv2-row-title">{d.title}</span>
                              <span className="dv2-row-line">{d.trayLine}</span>
                            </span>
                            <span className="dv2-row-facts">
                              <span className="dv2-row-state" data-tone={d.mark === 'urgent' ? 'bad' : undefined}>
                                {d.mark === 'urgent' ? 'URGENT' : 'OPEN'}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="dv2-panel tight">
                      <span className="dv2-panel-title">THE BOOK OF OWED</span>
                      <div className="dv2-rows">
                        {shellPatrons(persist.identity).slice(0, 4).map((patron, i) => (
                          <button
                            key={patron.id ?? i}
                            type="button"
                            className="dv2-row"
                            data-tone={patron.loyalty >= 4 ? 'loyal' : patron.loyalty >= 2 ? 'wavering' : 'angry'}
                            onClick={() => setTab('patrons')}
                          >
                            <span className="dv2-row-main">
                              <span className="dv2-row-title">{patron.name}</span>
                              <span className="dv2-row-line">{patron.role}</span>
                            </span>
                            <span className="dv2-row-facts">
                              <span className="dv2-row-state">{patron.loyalty}/5</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="dv2-panel tight">
                      <span className="dv2-panel-title">CLOSE THE WEEK</span>
                      <div className="dv2-act-block">
                        <HoldToCommit
                          level={2}
                          className="dv2-hold"
                          ariaLabel="Close the week — tap to begin, hold 2s to confirm"
                          onCommit={closeWeek}
                        >
                          {ticking ? 'FILING…' : 'CLOSE THE WEEK — THE SIM ADVANCES'}
                        </HoldToCommit>
                      </div>
                    </section>
                  </div>
                </aside>

                <section className="dv2-col" aria-label="Desk surface">
                  <div className="dv2-col-scroll">{screenNow}</div>
                </section>

                <aside className="dv2-col" aria-label="Reference shelf">
                  <div className="dv2-col-head">REFERENCE SHELF</div>
                  <div className="dv2-col-scroll">
                    {referenceDocs.map(d => (
                      <button key={d.id} className="dv2-shelf-card" onClick={() => openDoc(d.id)}>
                        <b>{d.title}</b>
                        <span>{d.authority}</span>
                      </button>
                    ))}

                    <div className="dv2-col-head" style={{ borderRadius: 10 }}>DEADLINES</div>
                    <p className="dv2-shelf-note">
                      {deskWeek <= ANCHOR_WEEK
                        ? <>ASUU ultimatum 15 Oct<br />NLC window closes 20 Oct<br />FAAC drops 21 Oct</>
                        : simLiveLine(persist.sim)}
                    </p>

                    <button className="dv2-act" onClick={() => setDrawer(true)}>OPEN THE DRAWER — SETTINGS</button>
                  </div>
                </aside>
              </div>
              {overlays}
            </div>
          ) : (
            <div className="app-body">
              {surface}
              {overlays}
            </div>
          )}
        </div>
      </div>
    </GameContext.Provider>
  )
}
