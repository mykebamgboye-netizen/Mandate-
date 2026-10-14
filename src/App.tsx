/* MANDATE — Situation Desk (compact + expanded layouts).
   Input → Command → Sim → Events → ViewModel (Section 17.3); the prototype
   renders view-models directly from the content pack. */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ABUJA_SCENARIO, OPENING_BALANCE, formatNaira, nairaDisplay,
  type Doc, type Decision, type DecisionOption, type Ally,
} from './content'
import {
  bootTarget, buildWeek, defaultTermStart, deriveScenario, scenarioInputFromFirstOpen,
  type Pack, type ScenarioInput,
} from './scenario'

import { ORIGINS, BRINGERS, FIRST_SCARS, nextSheetState, prologueAxes } from './profile/onboarding'
import { ensureReferenceOffices, postRoute, selectableOffices, stateChoicesFor } from './profile/profile-state'
import type { ProfileIdentity, ProfileOffice, ProfileParty } from './profile/types'
import { normalizeAxes } from './profile/schema'
import {
  supabaseConfigured,
  defaultFederationReference,
  createProfile,
  findProfileById,
} from './profile/client'
import type { Profile } from './profile'
import { JurisdictionStep, PostStep, ReviewStep, WhoStep } from './onboarding-steps'
import { getSession, signOut } from './profile/auth'
import { shortError } from './profile/errors'
import { AuthSheet, handleAuthSubmit } from './profile/auth-sheet'
import { GameContext, DEFAULT_SETTINGS, FALLBACK_SCENARIO, type GameSettings, type GameHooks } from './game-context'
import { DocumentView, type DocMarkState } from './DocumentView'
import { HoldToCommit, SPEC } from './hold'
import { IcPen } from './icons'
import { PaperDocument } from './task/paper'
import {
  IcBriefings, IcAllies, IcDecisions, IcBudget, IcFiles, IcClock, IcLock, IcSlip,
} from './icons'

type Tab = 'briefings' | 'allies' | 'decisions' | 'budget' | 'files'
const TABS: { id: Tab; label: string; Icon: typeof IcBriefings }[] = [
  { id: 'briefings', label: 'Briefings', Icon: IcBriefings },
  { id: 'allies', label: 'Allies', Icon: IcAllies },
  { id: 'decisions', label: 'Decisions', Icon: IcDecisions },
  { id: 'budget', label: 'Budget', Icon: IcBudget },
  { id: 'files', label: 'Files', Icon: IcFiles },
]

const STORE_KEY = 'mandate.desk.v1'
interface Persist {
  marks: Record<string, DocMarkState>
  decisions: Record<string, string>
  handoverDone?: boolean
  weekFiled?: boolean
  weathered?: string[]
  settings?: GameSettings
  glossQuarters?: number
  /** optional link to a Supabase-backed player profile (v1: onboarding only) */
  profileHandle?: string
  /** the record the desk is built from — the player's own first-open choices, kept locally so
      the desk still knows who they are and where they sit when Supabase is out of reach */
  profile?: ScenarioInput
}

function load(): Persist {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Persist
      if (p && typeof p === 'object' && p.marks && p.decisions) return p
    }
  } catch { /* corrupt store — start clean */ }
  return { marks: {}, decisions: {} }
}

/* ---------- first-open draft ----------
   One place that knows what an untouched wizard looks like, so the four places that used to
   repeat the literal cannot drift apart. */
type OnboardingPhase = 'none' | 'pick-post' | 'pick-state' | 'who' | 'profile-sheet' | 'entering-desk'

interface OnboardingDraft {
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
}

function draftOnboarding(): OnboardingDraft {
  return {
    phase: 'pick-post',
    states: defaultFederationReference.states,
    offices: ensureReferenceOffices(defaultFederationReference.offices),
    parties: defaultFederationReference.parties,
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
  }
}

/* A profile row read back from the database is the same shape the wizard collected: the desk
   is rebuilt from it rather than from any fixed scenario. */
function scenarioInputFromProfile(p: Profile): ScenarioInput {
  return {
    name: p.identity.name,
    age: p.identity.age,
    pronouns: p.identity.pronouns,
    officeId: p.office.officeId,
    tier: p.office.tier,
    post: p.office.post,
    route: p.office.elected ? 'elected' : 'appointed',
    stateCode: p.identity.stateCode,
    lgaName: p.identity.lgaName,
    partyCode: p.party.current ?? p.identity.chosenParty,
    termStart: p.office.termStart,
  }
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

function allDocs(pack: Pack): Doc[] { return [...pack.docs, ...pack.extras, ...pack.assets] }
function findDoc(pack: Pack, id: string): Doc | undefined {
  return id === pack.handover.id ? pack.handover : allDocs(pack).find(d => d.id === id)
}

const BADGE_TONE: Record<Ally['badge'], string> = { LOYAL: 'loyal', NEGOTIABLE: 'nego', LEVERAGE: 'lev' }

function decStatus(dec: Decision, p: Persist, pack: Pack): { done: boolean; choice?: string; ledger?: string } {
  if (dec.special === 'gazette') {
    const st = p.marks[dec.docId]?.stamps[0]
    if (st) {
      return st.label === 'APPROVED'
        ? { done: true, choice: 'Signed quietly — ' + nairaDisplay(pack.award) + ' committed', ledger: 'writes: evidence ledger · public goods · Halcyon Marine paid' }
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

/* ---------- Briefings: the Situation Desk (390×844 mobile-first) ---------- */
const DESK_HOURS_TOTAL = 14

function DeskScreen({ p, pack, onOpen, ticking, onCloseWeek }: {
  p: Persist; pack: Pack; onOpen: (id: string) => void; ticking: boolean; onCloseWeek: () => void
}) {
  const cal = pack.scenario.calendar
  const docs = useMemo(() => {
    const base = [...pack.docs, ...pack.extras].sort((a, b) => ORDER[a.mark] - ORDER[b.mark])
    return p.handoverDone ? base : [pack.handover, ...base]
  }, [pack, p.handoverDone])
  const decisionHours = pack.decisions.reduce((sum, d) => sum + (decStatus(d, p, pack).done ? d.hours : 0), 0)
  const hoursSpent = decisionHours + (p.glossQuarters ?? 0) / 4
  const hoursLeft = Math.max(0, DESK_HOURS_TOTAL - hoursSpent)
  const wholeLeft = Math.floor(hoursLeft + 1e-9)
  const frac = ['', '¼', '½', '¾'][Math.round((hoursLeft - wholeLeft) * 4)] ?? ''
  return (
    <>
      <header className="desk-head">
        <div className="dh-left">
          <span className="dh-wordmark">IN-TRAY · WEEK 41</span>
          <span className="dh-seat">{cal.weekLine}</span>
        </div>
        <div className="dh-right">
          <span className="dh-hours">DESK HOURS</span>
          <span className="dh-hours-val">{wholeLeft} / 14</span>
          <span className="dh-hours-frac">{frac}</span>
          <button className="dh-clock" aria-label="Desk clock">
            <IcClock width={16} height={16} />
          </button>
        </div>
      </header>
      <div className="desk-body">
        <aside className="db-left" aria-label="Files list">
          <div className="db-left-head">FILES</div>
          <div className="db-left-list">
            <button className="db-left-card" onClick={() => onOpen(pack.handover.id)}>
              <span className="db-left-title">{pack.handover.title}</span>
              <span className="db-left-sub">FROM THE OUTGOING AIDE</span>
            </button>
            {docs.map(d => {
              const linked = pack.decisions.filter(x => x.docId === d.id)
              const decided = linked.some(x => decStatus(x, p, pack).done)
              const pending = linked.length > 0 && !decided
              return (
                <button key={d.id} className="db-left-card" onClick={() => onOpen(d.id)}>
                  <span className="db-left-title">{d.title}</span>
                  <span className={"db-left-meta" + (pending ? ' urgent' : '') + (decided ? ' done' : '')}>
                    {pending ? 'TODAY · URGENT' : decided ? 'DECIDED' : 'NEEDS YOUR HAND'}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
        <section className="db-right" aria-label="Document viewer">
          <div className="db-right-toolbar">
            <button className="db-right-back" onClick={() => onOpen(pack.handover.id)}>CLOSE</button>
            <button className="db-right-back" onClick={() => onOpen(pack.handover.id)}>MARK DONE</button>
          </div>
          <div className="db-right-paper">
            <PaperDocument doc={pack.handover} onBack={() => onOpen(pack.handover.id)} />
          </div>
        </section>
      </div>
      <div className="desk-side">
        <button className="ds-btn ds-btn-budget" onClick={() => onOpen(pack.handover.id)}>
          <IcBudget width={16} height={16} />
          <span>BUDGET</span>
        </button>
        <button className="ds-btn ds-btn-allies" onClick={() => onOpen(pack.handover.id)}>
          <IcAllies width={16} height={16} />
          <span>ALLIES</span>
        </button>
        <button className="ds-btn ds-btn-files" onClick={() => onOpen(pack.handover.id)}>
          <IcFiles width={16} height={16} />
          <span>FILES</span>
        </button>
      </div>
      <footer className="desk-foot">
        <button className="df-btn df-redpen" onClick={() => onOpen(pack.handover.id)}>
          <IcPen width={16} height={16} />
          <span>RED PEN</span>
        </button>
        <button className="df-btn df-decide" onClick={() => onOpen(pack.handover.id)}>
          <IcDecisions width={16} height={16} />
          <span>DECIDE</span>
        </button>
        <button className="df-btn df-file" onClick={() => onOpen(pack.handover.id)}>
          <IcFiles width={16} height={16} />
          <span>FILE</span>
        </button>
        <button className="df-close" onClick={onCloseWeek} disabled={p.weekFiled || ticking}>
          CLOSE THE WEEK
        </button>
      </footer>
    </>
  )
}

/* ---------- Allies: the deputy-ticket zoning board ---------- */
function Rosettes({ n, tone }: { n: number; tone: string }) {
  return (
    <span className={`rosettes ${tone}`} aria-hidden>
      {[0, 1, 2].map(i => (
        <svg key={i} viewBox="0 0 24 24" width="17" height="17" className={i < n ? 'on' : ''}>
          <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k / 8) * Math.PI * 2
              const x = 12 + Math.cos(a) * 6.4
              const y = 12 + Math.sin(a) * 6.4
              return <ellipse key={k} cx={x} cy={y} rx="3" ry="3" transform={`rotate(${(k / 8) * 360} ${x} ${y})`} />
            })}
            <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
          </g>
        </svg>
      ))}
    </span>
  )
}

function AllyCard({ a, onOpen }: { a: Ally; onOpen: (id: string) => void }) {
  const tone = BADGE_TONE[a.badge]
  return (
    <button className="ally-card" onClick={() => onOpen(`asset-${a.id}`)}>
      <svg className="ac-clip" width="24" height="52" viewBox="0 0 34 74" aria-hidden>
        <path d="M10 60 V16 a8 8 0 0 1 16 0 v44 a12 12 0 0 1-24 0 V20"
          fill="none" stroke="#7d7d7d" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <div className="ac-top">
        <div className="ac-portrait" aria-hidden>
          <svg viewBox="0 0 48 56" width="48" height="56">
            <rect x="1" y="1" width="46" height="54" fill="#EFE9D8" stroke="#8a8477" strokeWidth="1.4" />
            <circle cx="24" cy="21" r="9" fill="none" stroke="#3d3a33" strokeWidth="1.8" />
            <path d="M8 52c1.4-10 7.6-15 16-15s14.6 5 16 15" fill="none" stroke="#3d3a33" strokeWidth="1.8" />
            <path d="M15 18c2-5 16-5 18 0" fill="none" stroke="#3d3a33" strokeWidth="1.4" />
          </svg>
          <span className="ac-initials">{a.initials}</span>
        </div>
        <div className="ac-id">
          <div className="ac-name">{a.name}</div>
          <div className="ac-office">{a.office}</div>
          <div className="ac-zone">{a.zone}</div>
        </div>
        <span className={`ac-badge ${tone}`}>{a.badge}</span>
      </div>
      <div className="ac-whisper">{a.whisper}</div>
      <div className="ac-trust">
        <Rosettes n={a.trust} tone={tone} />
        <span className={`ac-trust-label ${tone}`}>TRUST {a.trust}/3</span>
      </div>
    </button>
  )
}

function AlliesScreen({ pack, onOpen }: { pack: Pack; onOpen: (id: string) => void }) {
  const w = pack.scenario.w
  return (
    <>
      <div className="screen-head ally-head">
        <h2>Allies · {pack.scenario.tier === 'local' || pack.scenario.tier === 'fct' ? 'Slate' : 'Deputy Ticket'}</h2>
        <p>ZONING CHECK · {pack.allies.length} KEY RELATIONSHIPS</p>
      </div>
      <div className="ticket-cards">
        <button className="shortcut-card" onClick={() => onOpen('running-mate')}>
          <b>{w.ticketTitle}</b>
          Who balances it: zone, faith, machine, money, baggage. The {w.ticketRows[2][0]} row is circled in red.
        </button>
        <button className="shortcut-card locked" disabled>
          <b><IcLock width={14} height={14} /> {ABUJA_SCENARIO.title}</b>
          {ABUJA_SCENARIO.line}. {ABUJA_SCENARIO.detail}
        </button>
      </div>
      <div className="ally-list">
        {pack.allies.map(a => <AllyCard key={a.id} a={a} onOpen={onOpen} />)}
      </div>
    </>
  )
}

/* ---------- Decisions ---------- */
function DecisionsScreen({ p, pack, onOpen, onDecide, onToast, onReset }: {
  p: Persist
  pack: Pack
  onOpen: (id: string) => void
  onDecide: (id: string, key: string) => void
  onToast: (msg: string) => void
  onReset: () => void
}) {
  const awaiting = pack.decisions.filter(d => !decStatus(d, p, pack).done).length
  const commit = (dec: Decision, o: DecisionOption) => {
    if (dec.special === 'gazette' && o.key === 'sign') { onOpen(dec.docId); return }
    onDecide(dec.id, o.key)
  }
  return (
    <>
      <div className="dec-head">
        <span>{pack.scenario.calendar.decisionsHead}</span>
        <span className="dec-head-right">{awaiting} AWAITING YOUR STAMP</span>
      </div>
      <hr className="desk-rule" />
      <div className="dec-list">
        {pack.decisions.map(dec => {
          const st = decStatus(dec, p, pack)
          return (
            <div className="dec-card" key={dec.id}>
              <svg className="dec-clip" width="26" height="56" viewBox="0 0 34 74" aria-hidden>
                <path d="M10 60 V16 a8 8 0 0 1 16 0 v44 a12 12 0 0 1-24 0 V20"
                  fill="none" stroke="#7d7d7d" strokeWidth="3.4" strokeLinecap="round" />
              </svg>
              {st.done && <span className="dec-stamp">DECIDED</span>}
              {!st.done && dec.deadline && <div className="dec-deadline">{dec.deadline}</div>}
              <div className="dec-q">{dec.question}</div>
              {dec.options[0] && (
                <div className="dec-grammar">
                  {dec.options[0].marg.split(' · ').map((g, i) => (
                    <span key={i} className={`gr-tag${i < 2 ? ' boxed' : ''}`}>{g}</span>
                  ))}
                </div>
              )}
              <div className="dec-hours"><IcClock width={16} height={16} /> {dec.hours} DESK HOUR{dec.hours === 1 ? '' : 'S'}</div>

              {!st.done && (
                <div className="dec-opts">
                  {dec.options.map(o => {
                    const lvl = dec.special === 'gazette' && o.key === 'sign' ? 1 : o.level
                    return (
                      <HoldToCommit
                        key={o.key}
                        level={lvl}
                        className={`dec-clause${o.level === 3 ? ' career' : ''}`}
                        ariaLabel={`${o.label} — ${lvl === 3 ? 'hold three seconds to confirm' : lvl === 2 ? 'hold one second to sign' : 'tap to open'}`}
                        onCommit={() => commit(dec, o)}
                        onEarly={() => onToast(SPEC[o.level].early)}
                      >
                        <span className="do-label">{o.label}</span>
                        <span className="do-sub">{o.sub}</span>
                      </HoldToCommit>
                    )
                  })}
                </div>
              )}

              {st.done && (
                <div className="dec-done">
                  <div className="dec-choice">{st.choice}</div>
                  <div className="dec-ledger">{st.ledger}</div>
                  {dec.special === 'gazette' && (
                    <button className="dec-goto" style={{ marginTop: 10 }} onClick={() => onOpen(dec.docId)}>
                      REVIEW THE SIGNED FILE →
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button className="dec-reset" onClick={onReset}>— clear the week (prototype reset) —</button>
    </>
  )
}

/* ---------- Budget ---------- */
function BudgetScreen({ pack }: { pack: Pack }) {
  // Running balance: every posted row that is neither pending (not charged until sanctioned)
  // nor a variance (the shortfall is the gap itself, not a movement of cash). The closing is
  // recomputed here from the rows the scenario produced, so the arithmetic on screen is the
  // arithmetic that was derived — and it holds at every tier, because the scale is uniform.
  const m = pack.scenario.money
  const cal = pack.scenario.calendar
  let bal = m.opening
  const rows = m.rows.map(r => {
    if (!r.pending && !r.variance) bal += r.amount
    return { ...r, running: bal }
  })
  return (
    <div className="bud-sheet">
      <div className="bud-title">{m.fundTitle}</div>
      <div className="bud-sub">{cal.monthLabel} · WEEK {cal.weekNumber} · {m.fundSub}</div>
      <div className="bud-open"><span>OPENING, 1 {cal.monthLabel.split(' ')[0]}</span><span>{formatNaira(m.opening)}</span></div>
      <div className="bud-note">{m.openingNote} · THE WAGE BILL IS THE LARGEST LINE BELOW</div>
      {rows.map((r, i) => (
        <div className={`bud-row${r.pending ? ' pending' : ''}${r.variance ? ' variance' : ''}`} key={i}>
          <span className="d">{r.date}</span>
          <span className="m">
            {r.memo}
            {r.pending && <span className="bud-pending-tag">awaiting your sanction — not charged</span>}
            {r.variance && <span className="bud-note-tag">the gap itself — not a movement of cash</span>}
          </span>
          <span className={`a ${r.amount >= 0 ? 'credit' : 'debit'}`}>{formatNaira(r.amount)}</span>
        </div>
      ))}
      <div className="bud-close"><span>CLOSING, {cal.shortDate.split(' ').slice(0, 2).join(' ')}</span><span>{formatNaira(m.closing)}</span></div>
      <div className="bud-foot">
        IF EVERY PENDING ITEM IS SANCTIONED: {formatNaira(m.afterSanction)}<br />
        AUTHORITY: {m.authorityLine} · {pack.scenario.w.allocation.toUpperCase()} SHORTFALL THIS MONTH: {nairaDisplay(m.shortfall)}
      </div>
    </div>
  )
}

/* ---------- Files (archive) ---------- */
function FilesScreen({ p, pack, onOpen, onOpenDrawer }: {
  p: Persist; pack: Pack; onOpen: (id: string) => void; onOpenDrawer: () => void
}) {
  const acted = pack.docs.filter(d => {
    const m = p.marks[d.id]
    const decided = pack.decisions.some(x => x.docId === d.id && decStatus(x, p, pack).done)
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
            <button className="file-row" onClick={() => onOpen(pack.handover.id)}>
              <span>
                <span className="fr-title">{pack.handover.title}</span><br />
                <span className="fr-id">{pack.handover.recordId}</span>
              </span>
              <span className="fr-state">FILED ✓</span>
            </button>
          )}
          {acted.map(d => {
            const m = p.marks[d.id]
            const st = m?.stamps[0]
            const decided = pack.decisions.some(x => x.docId === d.id && decStatus(x, p, pack).done)
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

function SettingsDrawer({ settings, onChange, onClose, persist, onImport, onIssue, onSignOut }: {
  settings: GameSettings
  onChange: (patch: Partial<GameSettings>) => void
  onClose: () => void
  persist: Persist
  onImport: (p: Persist) => void
  onIssue: () => void
  onSignOut?: () => void
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
        {persist.profileHandle ? (
          <button className="dec-goto danger" onClick={() => { onSignOut?.(); }}>
            SIGN OUT
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function App() {
  const [persist, setPersist] = useState<Persist>(load)

  // ---- first-open gate: profile + onboarding (Supabase-backed when configured) ----
  const [onboarding, setOnboarding] = useState<OnboardingDraft | null>(null)
  const [tab, setTab] = useState<Tab>('briefings')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null)
  const [ticking, setTicking] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [literacy, setLiteracy] = useState(2)
  const [flash, setFlash] = useState(0)
  const expanded = useExpanded()
  const toastTimer = useRef(0)
  const tickTimer = useRef(0)

  /* ---- the desk is derived from the player's own record ----
     Office, jurisdiction, party, name and term all come from the profile the wizard wrote.
     There is no fixed scenario to land in: with no record there is no desk, and the wizard
     is the only way onto a seat. */
  const scenario = useMemo(
    () => (persist.profile ? deriveScenario(persist.profile) : null),
    [persist.profile],
  )
  const pack = useMemo(() => (scenario ? buildWeek(scenario) : null), [scenario])

  // ---- Supabase auth gate (sign-in / sign-up sheet before first-open onboarding) ----
  const [showAuthSheet, setShowAuthSheet] = useState(false)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirm, setAuthConfirm] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const authRef = useRef<{ mode: 'sign-in' | 'sign-up' }>({ mode: 'sign-in' })

  const clearAuthFields = () => {
    setAuthEmail('')
    setAuthPassword('')
    setAuthConfirm('')
    setAuthError(null)
  }

  const handleAuth = async () => {
    setAuthSubmitting(true)
    setAuthError(null)
    // Keep the latest mode in a ref so the async callback uses the right one.
    authRef.current.mode = authMode
    const outcome = await handleAuthSubmit(
      authRef.current.mode,
      authEmail,
      authPassword,
      authConfirm,
    )
    if (!outcome.ok) {
      setAuthError(outcome.error)
      setAuthSubmitting(false)
      return
    }
    const user = outcome.result.data?.user
    if (!user) {
      setAuthError('Sign-in returned no user — try again.')
      setAuthSubmitting(false)
      return
    }
    const authUserId = user.id
    setPersist(p => ({ ...p, profileHandle: authUserId }))
    setShowAuthSheet(false)
    clearAuthFields()
    if (authRef.current.mode === 'sign-up') {
      // New account: boot the first-open wizard so the player writes the record the desk
      // will be derived from. The reference data here is the local fallback; nothing about
      // it decides who the player is.
      setOnboarding(draftOnboarding())
    } else {
      // Existing account: skip onboarding, go straight to the desk.
      setOnboarding(null)
    }
    setAuthSubmitting(false)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch {
      /* best effort — the session is cleared locally either way */
    }
    setPersist(p => ({ ...p, profileHandle: undefined }))
    setOnboarding(null)
    setShowAuthSheet(supabaseConfigured() ? true : false)
    showToast('SIGNED OUT — YOUR FILE STAYS ON THIS PHONE UNTIL YOU SIGN IN AGAIN')
    setDrawer(false)
  }

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(persist)) } catch { /* storage full/blocked */ }
  }, [persist])

  // ---- first-open gate: auth sheet → first-open onboarding → desk ----
  //
  // The desk is not a fixed scenario. A record on this phone (persist.profile) is enough to
  // build it; a Supabase profile row is read back into the same shape; with neither, the
  // first-open wizard is where the player writes the record the desk will be derived from.
  // Nothing lands a player on somebody else's desk.
  useEffect(() => {
    // A wizard the player is actively in the middle of (a re-take) is never clobbered.
    const wizardLive = Boolean(onboarding && onboarding.phase !== 'none' && onboarding.phase !== 'entering-desk')
    const target = bootTarget({
      hasProfile: Boolean(persist.profile),
      profileHandle: persist.profileHandle,
      supabaseConfigured: supabaseConfigured(),
      wizardLive,
    })

    if (target === 'desk') {
      if (!wizardLive) setOnboarding(null)
      return
    }
    if (wizardLive) return
    if (target === 'fetch-profile' && persist.profileHandle) {
      findProfileById(persist.profileHandle)
        .then(profile => {
          if (profile) {
            // Existing profile — rebuild the desk from the player's own record.
            setPersist(p => ({ ...p, profile: scenarioInputFromProfile(profile) }))
          } else {
            setOnboarding(prev => (prev && prev.phase !== 'none' ? prev : draftOnboarding()))
          }
        })
        .catch(() => {
          // Can't reach Supabase right now — offer the wizard rather than an empty desk.
          setOnboarding(prev => (prev && prev.phase !== 'none' ? prev : draftOnboarding()))
        })
      return
    }
    // No record anywhere yet: the wizard is the only way onto a seat.
    setOnboarding(draftOnboarding())
  }, [persist.profile, persist.profileHandle])

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

  /* §13.1: the tick is the desk being tidied overnight — never a spinner */
  const closeWeek = () => {
    if (ticking || persist.weekFiled) return
    setTicking(true)
    tickTimer.current = window.setTimeout(() => {
      setTicking(false)
      setPersist(pr => ({ ...pr, weekFiled: true }))
      showToast(`AUTOSAVED — COMMAND LOG APPENDED · WEEK ${scenario?.calendar.weekNumber ?? ''} FILED`)
    }, 1900)
  }

  const openDoc = (id: string) => setOpenId(id)
  const doc = pack && openId ? findDoc(pack, openId) : undefined

  const setMark = (id: string, m: DocMarkState) =>
    setPersist(p => ({ ...p, marks: { ...p.marks, [id]: m } }))

  const decide = (id: string, key: string) => {
    setPersist(p => ({ ...p, decisions: { ...p.decisions, [id]: key } }))
    const dec = pack?.decisions.find(d => d.id === id)
    const opt = dec?.options.find(o => o.key === key)
    if (opt?.level === 3) {
      /* career-ending: the screen takes the hit with you */
      setFlash(Date.now())
      showToast('COMMITTED — THE LEDGERS READ IT. THERE IS NO WAY BACK.')
    } else {
      showToast('DECISION RECORDED — THE LEDGERS READ IT')
    }
  }

  const reset = () => {
    setPersist({ marks: {}, decisions: {}, weekFiled: false, weathered: [] })
    try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
    showToast('WEEK CLEARED — THE DESK IS EMPTY AGAIN')
  }

  const urgentBadge = !pack ? 0 : (persist.handoverDone ? 0 : 1) + pack.docs.filter(d =>
    d.mark === 'urgent' &&
    !persist.marks[d.id]?.stamps.length &&
    !pack.decisions.some(x => x.docId === d.id && decStatus(x, persist, pack).done),
  ).length

  const settings = persist.settings ?? DEFAULT_SETTINGS
  const setSettings = (patch: Partial<GameSettings>) =>
    setPersist(pr => ({ ...pr, settings: { ...(pr.settings ?? DEFAULT_SETTINGS), ...patch } }))

  const hooks: GameHooks = {
    settings,
    scenario: scenario ?? FALLBACK_SCENARIO,
    askAide: () => {
      setPersist(pr => ({ ...pr, glossQuarters: (pr.glossQuarters ?? 0) + 1 }))
      showToast('THE AIDE EXPLAINS — ¼ DESK HOUR (loyalty may colour this)')
    },
    literacy,
    setLiteracy,
  }

  const tabbar = (
    <nav className="tabbar" aria-label="Desk sections">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tab${tab === id ? ' active' : ''}`}
          onClick={() => { setTab(id); setOpenId(null) }}
          aria-current={tab === id}
        >
          <Icon />
          <span>{label}</span>
          {id === 'briefings' && urgentBadge > 0 && <span className="badge">{urgentBadge}</span>}
        </button>
      ))}
    </nav>
  )

  const documentView = doc ? (
    <DocumentView
      key={doc.id}
      doc={doc}
      mark={persist.marks[doc.id] ?? EMPTY_MARK}
      weathered={(persist.weathered ?? []).includes(doc.id)}
      onBack={() => setOpenId(null)}
      onMark={m => setMark(doc.id, m)}
      onToast={showToast}
      pendingDecision={
        doc.id !== pack?.handover.id &&
        Boolean(pack?.decisions.some(x => x.docId === doc.id && !decStatus(x, persist, pack).done))
      }
      onGoDecide={() => { setOpenId(null); setTab('decisions') }}
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
            setPersist({ marks: {}, decisions: {}, weathered: [] })
            try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
            showToast('TRANSFER SLIP ISSUED — THIS DESK IS BURNED')
          }}
          onSignOut={handleSignOut}
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
          <div className="tick-word">{scenario?.calendar.tickLine ?? 'TIDYING THE DESK OVERNIGHT'}</div>
        </div>
      )}
      {flash > 0 && <span className="commit-flash" key={flash} />}
      {toast && <div className="toast" key={toast.id} role="status" aria-live="polite">{toast.msg}</div>}
    </>
  )

  // Reconcile the player's first-open choices into the profile shape createProfile expects,
  // so the accept step can persist the profile to Supabase (id = auth.uid() for RLS).
  const profileFromOnboarding = (s: NonNullable<typeof onboarding>) => {
    const office = s.offices.find(o => o.id === s.officeId)
    if (!office) return null
    return {
      identity: {
        name: s.name || null,
        stateCode: s.stateCode,
        lgaName: s.lgaName,
        senatorialDistrict: null,
        pronouns: s.pronouns || null,
        locale: s.locale || null,
        phoneHome: null,
        altName: s.altName || null,
        bio: s.bio || null,
        age: s.age ? Number(s.age) : null,
        chosenParty: s.partyCode,
      } as ProfileIdentity,
      office: {
        tier: office.tier,
        post: office.post,
        elected: office.route === 'elected',
        termStart: defaultTermStart(office.tier),
        officeId: office.id,
      } as ProfileOffice,
      party: {
        current: s.partyCode,
        history: [],
        defectionRisk: s.bringer === 'godfather' ? 0.35 : s.bringer === 'grassroots' ? 0.15 : 0.22,
      } as ProfileParty,
      axes: undefined as undefined | ReturnType<typeof normalizeAxes>,
      patronageBank: 0,
    }
  }

  /* The wizard's step rail: direct posts skip the jurisdiction screen, so their file is
     3 steps rather than 4. */
  const obOffice = onboarding && onboarding.officeId
    ? onboarding.offices.find(o => o.id === onboarding.officeId) ?? null
    : null
  const obRoute = obOffice ? postRoute(obOffice) : null
  const obNeedsJurisdiction = obRoute?.kind === 'state' || obRoute?.kind === 'state-then-lga'
  const obTotal = obNeedsJurisdiction ? 4 : 3
  const obStep = !onboarding || onboarding.phase === 'pick-post' ? 1
    : onboarding.phase === 'pick-state' ? 2
    : onboarding.phase === 'profile-sheet' ? obTotal
    : obNeedsJurisdiction ? 3 : 2
  const obStateObj = onboarding?.states.find(s => s.code === onboarding.stateCode)
  const obStateName = obStateObj?.name ?? 'the Federation'
  const obStateFull = obStateObj && obStateObj.tier === 'state' ? `${obStateObj.name} State` : obStateName
  const obMeta = onboarding?.sheet && obOffice
    ? obOffice.jurisdiction === 'nation'
      ? `Age ${onboarding.sheet.age} • ${obOffice.post} — the Federation`
      : obOffice.tier === 'fct'
        ? `Age ${onboarding.sheet.age} • ${obOffice.post} — ${onboarding.sheet.capital}`
        : `Age ${onboarding.sheet.age} • ${obOffice.post} — ${onboarding.lgaName ? onboarding.lgaName + ', ' : ''}${obStateFull}`
    : ''

  /* Accept writes the record — always on this phone, so the desk exists without a network —
     and to Supabase too when the player is signed in. */
  const obAccept = async () => {
    const s = onboarding
    if (!s || s.phase !== 'profile-sheet' || !s.sheet || !s.officeId) return
    const office = s.offices.find(o => o.id === s.officeId)
    if (!office) {
      setOnboarding(o => (o ? { ...o, error: 'Office not found.' } : null))
      return
    }
    const stateRow = s.states.find(x => x.code === s.stateCode) ?? null
    const record = scenarioInputFromFirstOpen({
      name: s.name,
      age: s.age,
      pronouns: s.pronouns,
      officeId: office.id,
      tier: office.tier,
      post: office.post,
      route: office.route,
      stateCode: s.stateCode,
      stateName: stateRow?.name ?? null,
      capital: stateRow?.capital ?? null,
      lgaName: s.lgaName,
      partyCode: s.partyCode,
      partyName: s.parties.find(p => p.code === s.partyCode)?.name ?? null,
    })
    if (!record) {
      setOnboarding(o => (o ? { ...o, error: 'Office not found.' } : null))
      return
    }
    setPersist(p => ({ ...p, profile: record }))
    const authUserId = persist.profileHandle
    if (!authUserId || !supabaseConfigured()) {
      setOnboarding(o => (o ? { ...o, phase: 'entering-desk' } : null))
      showToast('YOUR RECORD IS SET — THE DESK IS BUILT FROM IT')
      return
    }
    try {
      const profile = profileFromOnboarding(s)
      if (!profile) {
        setOnboarding(o => (o ? { ...o, error: 'Office not found.' } : null))
        return
      }
      const base = normalizeAxes({ patronageBank: OPENING_BALANCE })
      profile.axes = prologueAxes(
        base,
        ORIGINS.find(o => o.id === s.origin)!.deltas,
        BRINGERS.find(b => b.id === s.bringer)!.deltas,
        FIRST_SCARS.find(sc => sc.id === s.scar)!.deltas,
        0,
      )
      profile.patronageBank = profile.axes.patronageBank
      /* The cloud write is a sync, not a gate: the record is already on this phone and the desk
         is built from it. So check first that this device actually holds a signed-in session —
         writing profiles without one is rejected by row-level security, and that rejection is
         what used to strand the player on the last onboarding screen. */
      const { data: sessionData, error: sessionError } = await getSession()
      if (sessionError || !sessionData?.session) {
        console.error('no session for the cloud save', sessionError)
        setOnboarding(o => (o ? { ...o, phase: 'entering-desk' } : null))
        showToast('YOUR FILE IS ON THIS PHONE — SIGN IN AGAIN TO SYNC IT')
        return
      }
      await createProfile({
        handle: s.name?.trim() || authUserId,
        identity: profile.identity,
        office: profile.office,
        party: profile.party,
        axes: profile.axes,
        powers: s.offices.find(o => o.id === s.officeId)?.powers ?? [],
        patronageBank: profile.patronageBank,
        authUserId,
      })
      setOnboarding(o => (o ? { ...o, phase: 'entering-desk' } : null))
      showToast('YOUR FILE IS SAVED — IT TRAVELS WITH YOU')
    } catch (err) {
      /* Never String(err): Supabase rejects with a plain object, which reads as
         "[object Object]". Say what failed in words, and still let the player in — the record
         is on this device either way. */
      console.error('cloud save failed', err)
      setOnboarding(o => (o ? { ...o, phase: 'entering-desk' } : null))
      showToast(`YOUR FILE IS ON THIS PHONE — CLOUD SAVE FAILED: ${shortError(err)}`)
    }
  }

  const surface = (
    <>
      {/* Supabase auth sheet: sign-in / sign-up before first-open onboarding, when configured. */}
      {showAuthSheet ? (
        <main className="app-main" key="auth">
          <div className="zoom-layer">
            <div className="onboarding-shell ob-auth">
              <h1 className="ob-title">CLAIM YOUR FILE</h1>
              <AuthSheet
                email={authEmail}
                password={authPassword}
                confirm={authConfirm}
                mode={authMode}
                submitting={authSubmitting}
                error={authError}
                onEmail={setAuthEmail}
                onPassword={setAuthPassword}
                onConfirm={setAuthConfirm}
                onMode={setAuthMode}
                onSubmit={handleAuth}
                onBack={() => {
                  setShowAuthSheet(false)
                  setOnboarding(draftOnboarding())
                }}
              />
            </div>
          </div>
        </main>
      ) : onboarding && onboarding.phase !== 'none' && onboarding.phase !== 'entering-desk' ? (
        <main className="app-main ob-main" key="onboarding">
          <div className="zoom-layer">
            <div className="onboarding-shell">
              {onboarding.error ? <div className="ob-error">{onboarding.error}</div> : null}
              {onboarding.phase === 'pick-post' ? (
                <PostStep
                  offices={selectableOffices(onboarding.offices)}
                  officeId={onboarding.officeId}
                  step={obStep} total={obTotal}
                  onBack={pack ? () => setOnboarding(null) : undefined}
                  onPick={o => setOnboarding(s => (s ? { ...s, officeId: o.id, stateCode: null, lgaName: null } : null))}
                  onContinue={() => setOnboarding(s => {
                    if (!s) return null
                    const picked = s.offices.find(o => o.id === s.officeId)
                    if (!picked) return s
                    const r = postRoute(picked)
                    if (r.kind === 'direct') return { ...s, phase: 'who' as const, stateCode: r.stateCode, lgaName: null }
                    return { ...s, phase: 'pick-state' as const, stateCode: null, lgaName: null }
                  })}
                />
              ) : onboarding.phase === 'pick-state' && obOffice ? (
                <JurisdictionStep
                  office={obOffice}
                  states={stateChoicesFor(obOffice, onboarding.states)}
                  stateCode={onboarding.stateCode}
                  lgaName={onboarding.lgaName}
                  step={obStep} total={obTotal}
                  onBack={() => setOnboarding(s => (s ? { ...s, phase: 'pick-post' as const, stateCode: null, lgaName: null } : null))}
                  onPickState={code => setOnboarding(s => (s ? { ...s, stateCode: code, lgaName: null } : null))}
                  onPickLga={lga => setOnboarding(s => (s ? { ...s, stateCode: lga ? lga.stateCode : null, lgaName: lga ? lga.name : null } : null))}
                  onContinue={() => setOnboarding(s => (s ? { ...s, phase: 'who' as const } : null))}
                />
              ) : onboarding.phase === 'who' && obOffice ? (
                <WhoStep
                  office={obOffice}
                  stateName={obStateName}
                  name={onboarding.name}
                  age={onboarding.age}
                  pronouns={onboarding.pronouns}
                  locale={onboarding.locale}
                  altName={onboarding.altName}
                  bio={onboarding.bio}
                  partyCode={onboarding.partyCode}
                  parties={onboarding.parties}
                  origin={onboarding.origin}
                  bringer={onboarding.bringer}
                  scar={onboarding.scar}
                  step={obStep} total={obTotal}
                  onField={(field, value) => setOnboarding(s => (s ? { ...s, [field]: value } : null))}
                  onParty={code => setOnboarding(s => (s ? { ...s, partyCode: code } : null))}
                  onOrigin={id => setOnboarding(s => (s ? { ...s, origin: id } : null))}
                  onBringer={id => setOnboarding(s => (s ? { ...s, bringer: id } : null))}
                  onScar={id => setOnboarding(s => (s ? { ...s, scar: id } : null))}
                  onBack={() => setOnboarding(s => (s ? { ...s, phase: obNeedsJurisdiction ? 'pick-state' as const : 'pick-post' as const } : null))}
                  onContinue={() => setOnboarding(s => {
                    if (!s) return null
                    const next = nextSheetState(s as import('./profile').OnboardingState)
                    const phase: OnboardingPhase = next.error ? s.phase : 'profile-sheet'
                    return { ...s, ...next, phase }
                  })}
                />
              ) : onboarding.phase === 'profile-sheet' && onboarding.sheet ? (
                <ReviewStep
                  sheet={onboarding.sheet}
                  meta={obMeta}
                  step={obStep} total={obTotal}
                  onBack={() => setOnboarding(s => (s ? { ...s, phase: 'who' as const } : null))}
                  onAccept={obAccept}
                />
              ) : null}
            </div>
          </div>
        </main>
      ) : !pack ? null : (
        <main className="app-main" key={tab}>
          <div className="zoom-layer">
            {documentView || (
        <>
          {tab === 'files' && <FilesScreen p={persist} pack={pack} onOpen={openDoc} onOpenDrawer={() => setDrawer(true)} />}
          {tab === 'briefings' && <DeskScreen p={persist} pack={pack} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />}
          {tab === 'allies' && <AlliesScreen pack={pack} onOpen={openDoc} />}
          {tab === 'decisions' && <DecisionsScreen p={persist} pack={pack} onOpen={openDoc} onDecide={decide} onToast={showToast} onReset={reset} />}
          {tab === 'budget' && <BudgetScreen pack={pack} />}
        </>
      )}
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
                <div className="col-head">IN-TRAY · {scenario?.calendar.weekLine}</div>
                <div className="col-scroll">
                  {pack && <DeskScreen p={persist} pack={pack} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />}
                </div>
              </aside>
              <section className="col col-surface">{surface}</section>
              <aside className="col col-shelf">
                {tabbar}
                <div className="col-head">REFERENCE SHELF</div>
                <div className="shelf-list">
                  {pack && allDocs(pack).filter(d => d.kind !== 'tell').slice(0, 8).map(d => (
                    <button key={d.id} className="shelf-card" onClick={() => openDoc(d.id)}>
                      <b>{d.title}</b>
                      <span>{d.authority}</span>
                    </button>
                  ))}
                </div>
                <div className="col-head">DEADLINES</div>
                <div className="shelf-deadlines">
                  {scenario?.calendar.deadlines.map(d => (
                    <div key={d.label}>{d.label} {d.date}</div>
                  ))}
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
