/* MANDATE — Situation Desk (compact + expanded layouts).
   Input → Command → Sim → Events → ViewModel (Section 17.3); the prototype
   renders view-models directly from the content pack. */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DOCS, ASSET_DOCS, DECISIONS, BUDGET, OPENING_BALANCE, OPENING_NOTE,
  WEEK, TERM, HANDOVER, SECTOR_BRIEF, TELL_PACK, formatNaira,
  SHORTFILL_NAIRA, SAPELE_AWARD_NAIRA, PENDING_TOTAL,
  BUDGET_CLOSING, nairaDisplay,
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
import { ensureReferenceOffices, postRoute, selectableOffices, stateChoicesFor } from './profile/profile-state'
import { TIER_LABEL, TIER_ORDER } from './profile/playable-offices'
import { PatronageStrip } from './PatronageStrip'
import { PatronsPanel } from './PatronsPanel'
import {
  supabaseConfigured,
  listStates,
  listOffices,
  listParties,
  listLgas,
  defaultFederationReference,
} from './profile/client'
import { DELTA_TUTORIAL_STATE, DELTA_TUTORIAL_OFFICE } from './profile/delta-tutorial'
import { GameContext, DEFAULT_SETTINGS, type GameSettings, type GameHooks } from './game-context'
import { DocumentView, type DocMarkState } from './DocumentView'
import { PressGazette } from './PressGazette'
import { MediaSystem } from './sim-core'
import { HoldToCommit } from './hold'
import {
  IcBriefings, IcAllies, IcBudget, IcFiles, IcSlip,
} from './icons'

type Tab = 'desk' | 'patrons' | 'press' | 'ops' | 'budget' | 'files'
const TABS: { id: Tab; label: string; Icon: typeof IcBriefings }[] = [
  { id: 'desk', label: 'DESK', Icon: IcBriefings },
  { id: 'patrons', label: 'PATRONS', Icon: IcAllies },
  { id: 'press', label: 'PRESS', Icon: IcBudget },
  { id: 'ops', label: 'OPS', Icon: IcFiles },
]

const VITE_ENABLE_DESK_V2 = import.meta.env.VITE_ENABLE_DESK_V2
// Default to true when not set (e.g. production Vercel), so the new DeskCard UI renders by default
const deskV2 = VITE_ENABLE_DESK_V2 ? VITE_ENABLE_DESK_V2 === 'true' : true

function TabBar({ p, onTabChange }: {
  p: Persist
  onTabChange: (tab: Tab) => void
}) {
  const identity = p.identity
  const patrons = identity?.patrons ?? []
  const hasDueSoon = patrons.some(p => p.ROI_due_weeks <= 2)
  return (
    <nav className="desk-tabs" role="navigation" aria-label="Desk tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={
            `tab${p.tab === t.id ? ' active' : ''}`
          }
          onClick={() => onTabChange(t.id)}
        >
          {t.label}
          {t.id === 'patrons' && hasDueSoon && (
            <span className="tab-badge">!</span>
          )}
        </button>
      ))}
    </nav>
  )
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

function persistTabChange(p: Persist, tab: Tab): Persist {
  return { ...p, tab }
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
    const base = [...DOCS, SECTOR_BRIEF, TELL_PACK].sort((a, b) => ORDER[a.mark] - ORDER[b.mark])
    return p.handoverDone ? base : [HANDOVER, ...base]
  }, [authored, p.handoverDone, p.inTray])
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

/* ---------- Budget ---------- */
function BudgetScreen() {
  // Running balance: sum every posted row that is NOT pending. Pending rows are
  // excluded from the running balance (they are not charged until sanctioned).
  // The closing shown here is BUDGET_CLOSING, which is computed in content.ts as
  //   OPENING_BALANCE + FAAC_NET + IGR_SEPTEMBER + FEDERATION_REFUND
  //   - (sum of the ten committed lines)
  // and equals 8,275,860,000. Pending is NOT in BUDGET_CLOSING.
  let bal = OPENING_BALANCE
  const rows = BUDGET.map(r => {
    if (!r.pending) bal += r.amount
    return { ...r, running: bal }
  })
  // The running balance at the end of the non-pending rows MUST equal BUDGET_CLOSING.
  // If a row was edited and this drifts, the test suite catches it below.
  const close = BUDGET_CLOSING
  const afterSanction = close - PENDING_TOTAL   // sanctioning REDUCES cash; pending never added
  return (
    <div className="bud-sheet">
      <div className="bud-title">Consolidated Revenue Fund — State Treasury</div>
      <div className="bud-sub">OCTOBER 2026 · WEEK 41 · ALL FIGURES TO THE NAIRA</div>
      <div className="bud-open"><span>OPENING, 1 OCT</span><span>{formatNaira(OPENING_BALANCE)}</span></div>
      <div className="bud-note">{OPENING_NOTE} · THE WAGE BILL IS ABOUT A THIRD OF THIS MONTH'S FAAC</div>
      {rows.map((r, i) => (
        <div className={`bud-row${r.pending ? ' pending' : ''}`} key={i}>
          <span className="d">{r.date}</span>
          <span className="m">
            {r.memo}
            {r.pending && <span className="bud-pending-tag">awaiting your sanction — not charged</span>}
          </span>
          <span className={`a ${r.amount >= 0 ? 'credit' : 'debit'}`}>{formatNaira(r.amount)}</span>
        </div>
      ))}
      <div className="bud-close"><span>CLOSING, 8 OCT</span><span>{formatNaira(close)}</span></div>
      <div className="bud-foot">
        IF EVERY PENDING ITEM IS SANCTIONED: {formatNaira(afterSanction)}<br />
        AUTHORITY: ss.121–125 — STATE APPROPRIATION (ANALOG OF ss.80–89) · FAAC SHORTFALL THIS MONTH: {nairaDisplay(SHORTFILL_NAIRA)}
      </div>
    </div>
  )
}

/* ---------- Files (archive) ---------- */
function FilesScreen({ p, onOpen, onOpenDrawer }: {
  p: Persist; onOpen: (id: string) => void; onOpenDrawer: () => void
}) {
  const actedAll = [...DOCS, ...p.inTray]
  const acted = actedAll.filter(d => {
    const m = p.marks[d.id]
    const decided = DECISIONS.some(x => x.docId === d.id && decStatus(x, p).done)
    return (m && (m.stamps.length || m.annotations.length)) || decided
  })
  const filedHandover = Boolean(p.handoverDone)
  return (
    <>
      <div className="screen-head">
        <h2>Files</h2>
        <p>THE CABINET — WHAT THE PAPER REMEMBERS</p>
      </div>
      <button className="dec-goto" style={{ margin: '10px 16px', width: 'calc(100% - 32px)' }} onClick={onOpenDrawer}>
        OPEN THE DRAWER — SETTINGS &amp; ACCESSIBILITY
      </button>
      {acted.length === 0 && !filedHandover ? (
        <div className="empty-note">The cabinet is empty.<br />Nothing has been stamped, signed or annotated yet.</div>
      ) : (
        <div className="file-list">
          {filedHandover && (
            <button className="file-row" onClick={() => onOpen(HANDOVER.id)}>
              <span>
                <span className="fr-title">{HANDOVER.title}</span><br />
                <span className="fr-id">{HANDOVER.recordId}</span>
              </span>
              <span className="fr-state">FILED ✓</span>
            </button>
          )}
          {acted.map(d => {
            const m = p.marks[d.id]
            const st = m?.stamps[0]
            const decided = DECISIONS.some(x => x.docId === d.id && decStatus(x, p).done)
            const state = st ? `STAMPED ${st.label}` : decided ? 'DECIDED' : 'ANNOTATED'
            return (
              <button className="file-row" key={d.id} onClick={() => onOpen(d.id)}>
                <span>
                  <span className="fr-title">{d.title}</span><br />
                  <span className="fr-id">{d.recordId}</span>
                </span>
                <span className="fr-state">{state}</span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}


// ---- onboarding step components (first-open shell) ----

/* ---------- cold-open landing: where does this desk live? ----------
   v1 keeps saves on-device; the transfer slip is the portable path (§3.7).
   The landing names all three roads honestly instead of hiding them behind a
   new file: resume what is on this device, receive a slip, or start clean. */
function LandingStep({ week, approval, hasSave, onNew, onResume, onSlip }: {
  week: number
  approval: number
  hasSave: boolean
  onNew: () => void
  onResume: () => void
  onSlip: (code: string) => boolean
}) {
  const [incoming, setIncoming] = useState('')
  const badSlip = incoming.trim().length > 8 && onSlip(incoming)
  return (
    <div className="ob-step ob-landing">
      <div className="ob-sub">MANDATE keeps its desks on-device — one life, no reload. A transfer slip carries a desk between phones. Accounts come later; when they do, they lift this desk to the ledger server.</div>
      {hasSave && (
        <button className="ob-done" onClick={onResume}>
          RESUME THIS DESK — WEEK {week} · APPROVAL {approval}%
        </button>
      )}
      <button className="ob-choice" onClick={onNew}>
        <div className="ob-choice-label">Begin a new file</div>
        <div className="ob-choice-sub">Pick a post, type your record, take the desk.</div>
      </button>
      <div className="ob-field" style={{ marginTop: 12 }}>
        <label className="ob-label">RECEIVE A TRANSFER SLIP</label>
        <input
          className="ob-input" value={incoming} onChange={e => setIncoming(e.target.value)}
          placeholder="paste a MANDATE-SLIP-1. code"
          aria-label="Paste a transfer slip"
        />
        {badSlip && <div className="ob-sub">Not a valid slip — check the code.</div>}
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
    <div className="ob-step">
      <div className="ob-sub">{sub ?? 'Pick the state you will govern. The 36 states, or the FCT as its Minister.'}</div>
      <div className="ob-state-list">
        {states.map((s: FederationState) => (
          <button
            key={s.code}
            className={`ob-state${stateCode === s.code ? ' selected' : ''}`}
            onClick={() => onState(s.code)}
          >
            <div className="ob-state-name">{s.name}</div>
            <div className="ob-state-meta">{s.capital} · {s.tier === 'fct' ? 'FCT' : 'State'}</div>
          </button>
        ))}
      </div>
      {stateCode && (
        <button className="ob-again" onClick={() => onState('')}>choose a different state</button>
      )}
      <div className="ob-foot">
        <button className="ob-back" onClick={onBack}>back</button>
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
    <div className="ob-step">
      <div className="ob-sub">Pick the office you will hold. The constitution fixes what it can do — the rest is yours.</div>
      {groups.map(g => (
        <div className="ob-post-group" key={g.tier}>
          <div className="ob-choices-label">{TIER_LABEL[g.tier] ?? g.tier}</div>
          <div className="ob-state-list">
            {g.items.map(o => (
              <button key={o.id} className="ob-state" onClick={() => onPost(o)}>
                <div className="ob-state-name">{o.post}</div>
                <div className="ob-state-meta">{o.route.toUpperCase()} · {o.jurisdiction.replace(/_/g, ' ').toUpperCase()}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="ob-foot">
        <button className="ob-back" onClick={onBack}>back to the desk</button>
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
    <div className="ob-step">
      <div className="ob-sub">Which local government? {state.name} council — the third tier, funded through the state joint account.</div>
      <div className="ob-field">
        <label className="ob-label">FILTER</label>
        <input
          className="ob-input" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="start typing a council name"
        />
      </div>
      {lgas === null ? (
        <div className="ob-sub">Reading the council register…</div>
      ) : shown.length === 0 ? (
        <div className="ob-sub">No council matches “{query}”.</div>
      ) : (
        <div className="ob-state-list">
          {shown.map(l => (
            <button key={l.id} className="ob-state" onClick={() => onLga(l)}>
              <div className="ob-state-name">{l.name}</div>
              <div className="ob-state-meta">{state.name} · LGA</div>
            </button>
          ))}
        </div>
      )}
      <div className="ob-foot">
        <button className="ob-back" onClick={onBack}>back</button>
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
    <div className="ob-step">
      <div className="ob-sub">You picked {postLine}. Now choose who you are — this is your record, typed by you, not pulled from a file.</div>
      <div className="ob-post">POST — {postLine}</div>
      <div className="ob-field">
        <label className="ob-label">NAME</label>
        <input className="ob-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. M. A. Bamgboye" />
      </div>
      <div className="ob-field">
        <label className="ob-label">AGE</label>
        <input className="ob-input" type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 52" />
      </div>
      <div className="ob-field">
        <label className="ob-label">PRONOUNS</label>
        <input className="ob-input" value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="e.g. he/him" />
      </div>
      <div className="ob-field">
        <label className="ob-label">PHONE LOCALE</label>
        <input className="ob-input" value={locale} onChange={e => setLocale(e.target.value)} placeholder="e.g. +234" />
      </div>
      <div className="ob-field">
        <label className="ob-label">OTHER NAME</label>
        <input className="ob-input" value={altName} onChange={e => setAltName(e.target.value)} placeholder="e.g. an alias, a former name" />
      </div>
      <div className="ob-field">
        <label className="ob-label">BIO / NOTES</label>
        <textarea className="ob-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="optional — your own note to yourself" rows={4} />
      </div>
      <div className="ob-foot">
        <button className="ob-done" disabled={!name.trim()} onClick={() => { onDone() }}>continue to my party</button>
        <button className="ob-back" onClick={onBack}>back</button>
      </div>
    </div>
  )
}

/* ---------- player-chosen party picker ----------
   The player picks their own party before the prologue now. The godfather / grassroots /
   technocrat step still shapes axes and patronage, but the party the desk travels under
   is the player's choice, not an NPC's. */
function PartyStep({ parties, partyCode, onParty, onBack }: {
  parties: import('./profile').FederationParty[]
  partyCode: string | null
  onParty: (code: string) => void
  onBack: () => void
}) {
  return (
    <div className="ob-step">
      <div className="ob-sub">Pick the party you will travel under. The prologue still shapes who brought you — this is the banner you choose.</div>
      <div className="ob-choices">
        {parties.map((p: import('./profile').FederationParty) => (
          <button key={p.code} className={`ob-choice${partyCode === p.code ? ' selected' : ''}`} onClick={() => onParty(p.code)}>
            <div className="ob-choice-label">{p.name}</div>
            <div className="ob-choice-sub">{p.note}</div>
          </button>
        ))}
      </div>
      <div className="ob-foot">
        <button className="ob-back" onClick={onBack}>back</button>
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
    <div className="ob-step">
      <div className="ob-sub">Who are you, {name || 'Governor'}? A short prologue sets your starting record.</div>
      <div className="ob-post">POST — {postLine}</div>
      <div className="ob-choices">
        <div className="ob-choices-label">Where did you come from?</div>
        {ORIGINS.map((o: typeof ORIGINS[number]) => (
          <button key={o.id} className={`ob-choice${origin === o.id ? ' selected' : ''}`} onClick={() => onOrigin(o.id)}>
            <div className="ob-choice-label">{o.label}</div>
            <div className="ob-choice-sub">{o.sub}</div>
            <div className="ob-effects">
              {effectChips(o.deltas, o.patron).map((c, i) => <span key={i} className="ob-effect">{c}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div className="ob-choices">
        <div className="ob-choices-label">Who brought you?</div>
        {BRINGERS.map((b: typeof BRINGERS[number]) => (
          <button key={b.id} className={`ob-choice${bringer === b.id ? ' selected' : ''}`} onClick={() => onBringer(b.id)}>
            <div className="ob-choice-label">{b.label}</div>
            <div className="ob-choice-sub">{b.sub}</div>
            <div className="ob-effects">
              {effectChips(b.deltas).map((c, i) => <span key={i} className="ob-effect">{c}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div className="ob-choices">
        <div className="ob-choices-label">Your first scar?</div>
        {FIRST_SCARS.map((s: typeof FIRST_SCARS[number]) => (
          <button key={s.id} className={`ob-choice${scar === s.id ? ' selected' : ''}`} onClick={() => onScar(s.id)}>
            <div className="ob-choice-label">{s.label}</div>
            <div className="ob-choice-sub">{s.sub}</div>
            <div className="ob-effects">
              {effectChips(s.deltas).map((c, i) => <span key={i} className="ob-effect">{c}</span>)}
            </div>
          </button>
        ))}
      </div>
      <div className="ob-foot">
        <button
          className="ob-done"
          disabled={!origin || !bringer || !scar}
          onClick={() => { onDone() }}
        >review your record</button>
        <button className="ob-back" onClick={onBack}>back</button>
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
    <div className="ob-step">
      <div className="ob-sub">Your record — INFORMANCE CF001 + security vetting. Signing this begins your life.</div>
      <div className="ob-sheet">
        <div className="ob-sheet-row"><span className="ob-sheet-k">NAME</span><span className="ob-sheet-v">{sheet.name}</span></div>
        <div className="ob-sheet-row"><span className="ob-sheet-k">HANDLE</span><span className="ob-sheet-v">{sheet.handle}</span></div>
        <div className="ob-sheet-row"><span className="ob-sheet-k">{sheet.stateLabel}</span><span className="ob-sheet-v">{sheet.state} ({sheet.capital})</span></div>
        {sheet.lga && <div className="ob-sheet-row"><span className="ob-sheet-k">LGA</span><span className="ob-sheet-v">{sheet.lga}</span></div>}
        {sheet.district && <div className="ob-sheet-row"><span className="ob-sheet-k">SENATORIAL DISTRICT</span><span className="ob-sheet-v">{sheet.district}</span></div>}
        <div className="ob-sheet-row"><span className="ob-sheet-k">AGE</span><span className="ob-sheet-v">{sheet.age}</span></div>
        <div className="ob-sheet-row"><span className="ob-sheet-k">OFFICE</span><span className="ob-sheet-v">{sheet.office} · {sheet.post} · {sheet.route}</span></div>
        <div className="ob-sheet-row"><span className="ob-sheet-k">PARTY</span><span className="ob-sheet-v">{sheet.party} · defection risk {sheet.defectionRisk}</span></div>
        <div className="ob-sheet-row"><span className="ob-sheet-k">PATRONAGE BANK</span><span className="ob-sheet-v">{sheet.patronageBank}</span></div>
        <div className="ob-sheet-axes">
          {sheet.axes.map((a: { label: string; value: string; band: string }, i: number) => (
            <div key={i} className="ob-axis">
              <span className={`ob-axis-band ${a.band.toLowerCase()}`}>{a.band}</span>
              <span className="ob-axis-label">{a.label}</span>
              <span className="ob-axis-value">{a.value}</span>
            </div>
          ))}
        </div>
        <div className="ob-legend">
          BANDS — LOW · WEAK · EVEN · STRONG · HIGH (press tone runs HOSTILE → SUPPORTIVE). Every band below is already shaped by your origin, who brought you, and your first scar.
        </div>
        {sheet.patrons.length > 0 && (
          <div className="ob-patrons">
            <div className="ob-patrons-label">Patronage network</div>
            {sheet.patrons.map((p: { name: string; role: string; loyalty: string }, i: number) => (
              <div key={i} className="ob-patron">
                <span className="ob-patron-name">{p.name}</span>
                <span className="ob-patron-role">{p.role}</span>
                <span className="ob-patron-loyalty">loyalty {p.loyalty}/5</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="ob-foot">
        <button className="ob-accept" onClick={onAccept}>accept and enter the desk</button>
        <button className="ob-back" onClick={onBack}>revise my record</button>
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
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="drawer-sheet">
        <div className="drawer-handle" />
        <div className="drawer-title">THE DRAWER — SETTINGS</div>

        <div className="drawer-label">ACCESSIBILITY</div>
        <div className="drawer-row">
          <div className="drawer-copy">
            <b>Plain-language mode (Learner Mode)</b>
            <span>Glosses appear free — for anyone new to Nigerian public finance. It does not change the simulation.</span>
          </div>
          <button
            className={`switch${settings.learnerMode ? ' on' : ''}`}
            role="switch" aria-checked={settings.learnerMode}
            aria-label="Plain-language mode"
            onClick={() => onChange({ learnerMode: !settings.learnerMode })}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="drawer-row">
          <div className="drawer-copy">
            <b>Text size</b>
            <span>Scales documents and screens; the chrome stays put.</span>
          </div>
          <div className="seg">
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
        <div className="drawer-row">
          <div className="drawer-copy">
            <b>Haptics</b>
            <span>Ticks while a hold is charging; the stamp’s thud on supported phones.</span>
          </div>
          <button
            className={`switch${settings.haptics ? ' on' : ''}`}
            role="switch" aria-checked={settings.haptics}
            aria-label="Haptics"
            onClick={() => onChange({ haptics: !settings.haptics })}
          >
            <span className="knob" />
          </button>
        </div>

        <div className="drawer-label">THE LIFE — ONE SAVE, NO RELOAD</div>
        <div className="drawer-copy solo">
          Phones get stolen and data is expensive. A transfer slip is not save-scumming — it is succession:
          one encrypted export, and the desk it came from is burned.
        </div>
        {!issued ? (
          <button className="dec-goto slip-btn" onClick={issue}>
            <IcSlip width={16} height={16} /> ISSUE A TRANSFER SLIP
          </button>
        ) : (
          <div className="slip-issue">
            <textarea readOnly value={slip} aria-label="Transfer slip" onFocus={e => e.currentTarget.select()} />
            <div className="slip-hint">
              COPY THIS TONIGHT — IT WILL NOT BE SHOWN AGAIN. RECEIVING IT BURNS THIS DESK.
            </div>
            <button className="dec-goto danger" onClick={burn}>I HAVE THE SLIP — BURN THIS DESK</button>
          </div>
        )}
        <div className="slip-receive">
          <div className="drawer-copy"><b>Receive a slip — continue on this phone</b></div>
          <textarea
            value={incoming} onChange={e => setIncoming(e.target.value)}
            placeholder="paste a MANDATE-SLIP-1. code here" aria-label="Paste a transfer slip"
          />
          <button className="dec-goto" disabled={!incoming.trim()} onClick={receive}>RECEIVE THE SLIP</button>
        </div>

        <button className="dec-goto" onClick={onClose}>CLOSE THE DRAWER</button>
      </div>
    </div>
  )
}

export default function App() {
  const [persist, setPersist] = useState<Persist>(load)

  // ---- first-open gate: profile + onboarding (Supabase-backed when configured) ----
  type OnboardingPhase = 'landing' | 'none' | 'pick-post' | 'pick-identity' | 'pick-state' | 'pick-lga' | 'pick-party' | 'prologue' | 'profile-sheet' | 'entering-desk'
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
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null)
  const [ticking, setTicking] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [literacy, setLiteracy] = useState(2)
  const [flash] = useState(0)
  const expanded = useExpanded()
  console.log('DESK_V2', import.meta.env.VITE_ENABLE_DESK_V2)
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
        const configured = supabaseConfigured()
        if (!configured) { bootLocalFallback(); return }
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

    bootFromSupabase()
  }, [persist.profileHandle])

  const showToast = (msg: string) => {
    setToast({ id: Date.now(), msg })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(tickTimer.current) }, [])

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
      const nextWeek = (persist.weekNumber ?? ANCHOR_WEEK) + 1
      const appliedNext: Record<string, true> = { ...applied }
      for (const id of Object.keys(freshChoices)) appliedNext[id] = true
      setTicking(false)
      setPersist(pr => ({
        ...pr,
        sim: result.snapshot,
        weekNumber: nextWeek,
        inTray: result.documents,
        decisionsApplied: appliedNext,
        // the new week: fresh hours, fresh reading stains, fresh op book
        hoursBook: {},
        ops: {},
        glossQuarters: 0,
        weathered: [],
        publicApproval: result.approval,
      }))
      showToast(`WEEK ${nextWeek} FILED — ${result.headline.toUpperCase()}`)
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

  const screens: Record<Tab, React.ReactNode> = {
    desk: <DeskScreen p={persist} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />,
    budget: <BudgetScreen />,
    files: <FilesScreen p={persist} onOpen={openDoc} onOpenDrawer={() => setDrawer(true)} />,
    patrons: <PatronsPanel sim={persist.sim} identity={persist.identity} />,
    press: <PressGazette media={persist.sim?.state?.media as any ?? new MediaSystem()} />,
    ops: <div className="dec-list" style={{ marginTop: 10 }}>
        {Object.entries(persist.ops ?? {}).map(([key, st]) => {
          return (
            <div className="dec-card" key={key}>
              <svg className="dec-clip" width="26" height="56" viewBox="0 0 34 74" aria-hidden>
                <path d="M10 60 V16 a8 8 0 0 1 16 0 v44 a12 12 0 0 1-24 0 V20"
                  fill="none" stroke="#7d7d7d" strokeWidth="3.4" strokeLinecap="round" />
              </svg>
              <div className="dec-q">{key}</div>
              <div className="dec-grammar"><span className="gr-tag boxed">{st.effect?.substring(0, 20) || 'Operation'}</span></div>
              <div className="constraint-pill" style={{ marginLeft: 4 }}>EXPOSURE: {st.efcc ? 'MONEY TRAIL EXISTS' : 'no exposure'}</div>
              {!st.ok ? (
                <div className="dec-opts">
                  <HoldToCommit
                    level={key === 'sponsor-protest' || key === 'plant-story' ? 2 : 3}
                    className="dec-clause career"
                    ariaLabel={`Order it — hold three seconds to order it`}
                    onCommit={() => showToast('ORDERING — THE DESK WAITS. THE SIM DOES NOT.')}
                  >
                    <span className="do-label">Order it</span>
                    <span className="do-sub">{st.effect || 'Operation'}</span>
                  </HoldToCommit>
                </div>
              ) : (
                <div className="dec-done">
                  <div className="dec-choice">{st.effect}</div>
                  <div className="dec-ledger">approval {st.approval > 0 ? `+${st.approval}` : st.approval} · {st.efcc ? 'EXPOSURE: THE MONEY TRAIL EXISTS' : 'no EFCC/ICPC exposure this run'}</div>
                </div>
              )}
            </div>
          )
        })}</div>
  }

  const deskTabs = (
    <TabBar p={persist} onTabChange={tab => persistTabChange(persist, tab)} />
  )

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
        <div className="tick-overlay" aria-live="polite">
          <div className="tick-stack">
            <span className="tick-sheet t1" />
            <span className="tick-sheet t2" />
            <span className="tick-sheet t3" />
            <span className="tick-sheet t4" />
          </div>
          <div className="tick-lamp" />
          <div className="tick-word">TIDYING THE DESK OVERNIGHT — WEEK 41 → FILED</div>
        </div>
      )}
      {flash > 0 && <span className="commit-flash" key={flash} />}
      {toast && <div className="toast" key={toast.id} role="status" aria-live="polite">{toast.msg}</div>}
    </>
  )

  const surface = (
    <>
      {/* first-open onboarding shell: pick a federation post, run a short prologue, then enter the desk */}
      {onboarding && onboarding.phase !== 'none' && onboarding.phase !== 'entering-desk' ? (
        <main className="app-main" key="onboarding">
          <div className="zoom-layer">
            <div className="onboarding-shell">
              <h1 className="ob-title">NEW FILE — CHOOSE YOUR POST</h1>
              {onboarding.error ? (
                <div className="ob-error">{onboarding.error}</div>
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
                />
              ) : onboarding.phase === 'pick-post' ? (
                <PostStep
                  offices={selectableOffices(onboarding.offices)}
                  onPost={office => setOnboarding(o => {
                    if (!o) return null
                    const route = postRoute(office)
                    if (route.kind === 'direct') {
                      // appointed/nationwide posts need no jurisdiction step (FCT seat = Abuja)
                      return { ...o, phase: 'prologue', officeId: office.id, stateCode: route.stateCode, lgaName: null }
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
                    return { ...o, phase: 'prologue', stateCode }
                  })}
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-post', stateCode:null, lgaName:null} : null))}
                />
              ) : onboarding.phase === 'pick-lga' ? (
                <LgaStep
                  state={onboarding.states.find(s => s.code === onboarding.stateCode) ?? DELTA_TUTORIAL_STATE}
                  onLga={lga => setOnboarding(o => (o ? {...o, phase:'prologue', stateCode: lga.stateCode, lgaName: lga.name} : null))}
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
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'prologue', pronouns:'', locale:'', bio:'', altName:''} : null))}
                />
              ) : onboarding.phase === 'pick-party' ? (
                <PartyStep
                  parties={onboarding.parties}
                  partyCode={onboarding.partyCode}
                  onParty={code => setOnboarding(o => (o ? {...o, partyCode: code} : null))}
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
                  onBack={() => setOnboarding(o => (o ? {...o, phase:'pick-identity'} : null))}
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
        <main className="app-main" key={tab}>
          <div className="zoom-layer">
            {documentView || (expanded && tab === 'desk'
              ? <div className="surface-note">THE TRAY IS ON THE LEFT.<span>Pick a file; the tabs swap this surface.</span></div>
              : screens[tab])}
          </div>
        </main>
      )}
    </>
  )

  return (
    <GameContext.Provider value={hooks}>
      <div className="desk-bg">
        <div className="phone grain" data-scale={settings.textScale}>
          {expanded ? (
            <div className="app-body expanded">
              <aside className="col col-tray">
                <div className="col-head">IN-TRAY · {deskWeekLine(persist.identity, persist.weekNumber ?? ANCHOR_WEEK)}</div>
                <div className="col-scroll">
                  <DeskScreen p={persist} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />
                </div>
              </aside>
              <section className="col col-surface">{surface}</section>
              <aside className="col col-shelf">
                {deskTabs}
                <div className="col-head">REFERENCE SHELF</div>
                <div className="shelf-list">
                  {allDocs().filter(d => d.kind !== 'tell').slice(0, 8).map(d => (
                    <button key={d.id} className="shelf-card" onClick={() => openDoc(d.id)}>
                      <b>{d.title}</b>
                      <span>{d.authority}</span>
                    </button>
                  ))}
                </div>
                <div className="col-head">DEADLINES</div>
                <div className="shelf-deadlines">
                  {(persist.weekNumber ?? ANCHOR_WEEK) <= ANCHOR_WEEK
                    ? <>ASUU ultimatum 15 Oct<br />NLC window closes 20 Oct<br />FAAC drops 21 Oct</>
                    : simLiveLine(persist.sim)}
                </div>
                <button className="dec-goto" onClick={() => setDrawer(true)}>OPEN THE DRAWER — SETTINGS</button>
              </aside>
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
