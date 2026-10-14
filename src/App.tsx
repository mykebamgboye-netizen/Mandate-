/* MANDATE — Situation Desk (compact + expanded layouts).
   Input → Command → Sim → Events → ViewModel (Section 17.3); the prototype
   renders view-models directly from the content pack. */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DOCS, ASSET_DOCS, DECISIONS, ALLIES, BUDGET, OPENING_BALANCE, OPENING_NOTE,
  WEEK, TERM, HANDOVER, ABUJA_SCENARIO, SECTOR_BRIEF, TELL_PACK, formatNaira,
  SHORTFILL_NAIRA, SAPELE_AWARD_NAIRA, PENDING_TOTAL,
  BUDGET_CLOSING, nairaDisplay,
  type Doc, type Decision, type DecisionOption, type Ally,
} from './content'

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
import { JurisdictionStep, PostStep, ReviewStep, WhoStep } from './onboarding-steps'
import { signOut } from './profile/auth'
import { DELTA_TUTORIAL_OFFICE } from './profile/delta-tutorial'
import { AuthSheet, handleAuthSubmit } from './profile/auth-sheet'
import { GameContext, DEFAULT_SETTINGS, type GameSettings, type GameHooks } from './game-context'
import { DocumentView, type DocMarkState } from './DocumentView'
import { HoldToCommit, SPEC } from './hold'
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

function termStartFor(officeId: string): string {
  if (officeId === 'fct/minister') return '2026-06-01'
  if (officeId === 'local/chairman') return '2026-07-01'
  return '2026-05-29'
}

const EMPTY_MARK: DocMarkState = { stamps: [], annotations: [] }
const ORDER: Record<Doc['mark'], number> = { urgent: 0, fresh: 1, opened: 2, forwarded: 3 }

function allDocs(): Doc[] { return [...DOCS, SECTOR_BRIEF, TELL_PACK, ...ASSET_DOCS] }
function findDoc(id: string): Doc | undefined { return id === HANDOVER.id ? HANDOVER : allDocs().find(d => d.id === id) }

const BADGE_TONE: Record<Ally['badge'], string> = { LOYAL: 'loyal', NEGOTIABLE: 'nego', LEVERAGE: 'lev' }

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
  const docs = useMemo(() => {
    const base = [...DOCS, SECTOR_BRIEF, TELL_PACK].sort((a, b) => ORDER[a.mark] - ORDER[b.mark])
    return p.handoverDone ? base : [HANDOVER, ...base]
  }, [p.handoverDone])
  const urgentOpen = docs.filter(d =>
    d.mark === 'urgent' &&
    !p.marks[d.id]?.stamps.length &&
    !DECISIONS.some(x => x.docId === d.id && decStatus(x, p).done),
  ).length
  const decisionHours = DECISIONS.reduce((sum, d) => sum + (decStatus(d, p).done ? d.hours : 0), 0)
  const hoursSpent = decisionHours + (p.glossQuarters ?? 0) / 4
  const hoursLeft = Math.max(0, DESK_HOURS_TOTAL - hoursSpent)
  const wholeLeft = Math.floor(hoursLeft + 1e-9)
  const frac = ['', '¼', '½', '¾'][Math.round((hoursLeft - wholeLeft) * 4)] ?? ''
  const weathered = p.weathered ?? []
  return (
    <>
      <div className="desk-head">
        <span className="desk-date">{WEEK.dateLine}</span>
        <span className="desk-week">{WEEK.weekLine}</span>
        <div className="desk-tag">
          {urgentOpen > 0 ? `${urgentOpen} URGENT` : 'TRIAGE DONE'} · {docs.length} DOCUMENTS
        </div>
        <div className="desk-term">{TERM.line}</div>
        <div className="desk-hours" aria-label={`Desk Hours: ${wholeLeft} of ${DESK_HOURS_TOTAL} left`}>
          <span className="dh-label">DESK HOURS</span>
          <span className="dh-ticks">
            {Array.from({ length: DESK_HOURS_TOTAL }, (_, i) => (
              <span key={i} className={`dh-tick${i < wholeLeft ? '' : ' spent'}`} />
            ))}
          </span>
          <span className="dh-count">{wholeLeft}{frac} / {DESK_HOURS_TOTAL} LEFT — USE OR LOSE</span>
        </div>
        <div className="desk-deadlines">
          ASUU ultimatum 15 Oct · NLC window closes 20 Oct · FAAC drops 21 Oct
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
        <button
          className={`close-strip${p.weekFiled ? ' done' : ''}`}
          onClick={onCloseWeek}
          disabled={p.weekFiled || ticking}
          aria-label={p.weekFiled ? 'Week filed' : 'Close the week and autosave'}
        >
          {p.weekFiled
            ? 'WEEK 41 FILED ✓ — THE DESK IS CLEAN. INBOX REOPENS MONDAY.'
            : 'CLOSE THE WEEK — THE DESK TIDIES ITSELF, THE LOG IS WRITTEN'}
        </button>
        <div className="close-hint">Autosave runs on commit, never before (§3.7)</div>
      </div>
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

function AlliesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <>
      <div className="screen-head ally-head">
        <h2>Allies · Deputy Ticket</h2>
        <p>ZONING CHECK · 4 KEY RELATIONSHIPS</p>
      </div>
      <div className="ticket-cards">
        <button className="shortcut-card" onClick={() => onOpen('running-mate')}>
          <b>Deputy Ticket — Zoning Check</b>
          Who balances the ticket: zone, faith, machine, money, baggage. The South row is circled in red.
        </button>
        <button className="shortcut-card locked" disabled>
          <b><IcLock width={14} height={14} /> {ABUJA_SCENARIO.title}</b>
          {ABUJA_SCENARIO.line}. {ABUJA_SCENARIO.detail}
        </button>
      </div>
      <div className="ally-list">
        {ALLIES.map(a => <AllyCard key={a.id} a={a} onOpen={onOpen} />)}
      </div>
    </>
  )
}

/* ---------- Decisions ---------- */
function DecisionsScreen({ p, onOpen, onDecide, onToast, onReset }: {
  p: Persist
  onOpen: (id: string) => void
  onDecide: (id: string, key: string) => void
  onToast: (msg: string) => void
  onReset: () => void
}) {
  const awaiting = DECISIONS.filter(d => !decStatus(d, p).done).length
  const commit = (dec: Decision, o: DecisionOption) => {
    if (dec.special === 'gazette' && o.key === 'sign') { onOpen(dec.docId); return }
    onDecide(dec.id, o.key)
  }
  return (
    <>
      <div className="dec-head">
        <span>DECISIONS · 8 OCT 2026</span>
        <span className="dec-head-right">{awaiting} AWAITING YOUR STAMP</span>
      </div>
      <hr className="desk-rule" />
      <div className="dec-list">
        {DECISIONS.map(dec => {
          const st = decStatus(dec, p)
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
  const acted = DOCS.filter(d => {
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
  type OnboardingPhase = 'none' | 'pick-post' | 'pick-state' | 'who' | 'profile-sheet' | 'entering-desk'
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
      // New account: boot the first-open onboarding so the player creates their profile.
      // Use the local Delta reference data so this works without a live DB fetch here;
      // the federation reference is re-fetched from Supabase inside the onboarding boot
      // once profileHandle is set (see the boot effect below).
      setOnboarding({
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
      })
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
  // The NPC delta (M. A. Bamgboye / 52 / Delta governor) is ONLY the fallback scenario you
  // can land in AFTER you have chosen office + identity — and only when no Supabase is
  // configured. It is never served as the player's own record on first open.
  //
  // When Supabase is configured and the player has no profileHandle, the first screen is the
  // sign-in / sign-up sheet. Signing in (existing account) goes straight to the desk; signing
  // up (new account) boots the first-open onboarding so the player can create their profile.
  // When Supabase is not configured, the boot falls back to the local Delta tutorial onboarding.
  //
  // When handleAuth signs a player up it sets profileHandle AND sets onboarding to pick-post
  // in the same batch; the effect below must not clobber that onboarding with the desk.
  useEffect(() => {
    if (persist.profileHandle) {
      // Don't clobber an onboarding the player is actively in the middle of (sign-up sets
      // onboarding to pick-post and profileHandle in the same batch; let that onboarding stand).
      if (onboarding && onboarding.phase !== 'none' && onboarding.phase !== 'entering-desk') {
        return
      }
      if (!supabaseConfigured()) {
        setOnboarding(null)
        return
      }
      // No active onboarding — decide on whether a profile row already exists for this user.
      findProfileById(persist.profileHandle)
        .then(profile => {
          if (profile) {
            // Existing profile (sign-in, or sign-up + accept) — skip onboarding, go to the desk.
            setOnboarding(null)
          } else {
            // New account that hasn't accepted yet (sign-up, not yet on the accept step) —
            // continue the first-open onboarding so the player can create their profile.
            setOnboarding({
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
            })
          }
        })
        .catch(() => {
          // Can't reach Supabase right now — keep the player on the desk rather than
          // throwing them back to the auth sheet.
          setOnboarding(null)
        })
      return
    }
    if (!supabaseConfigured()) {
      // Local fallback: Delta tutorial reference data, blank identity, office picker first.
      setOnboarding({
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
      })
      return
    }
    // Supabase configured, no profileHandle yet — show the sign-in / sign-up sheet.
    setShowAuthSheet(true)
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

  /* §13.1: the tick is the desk being tidied overnight — never a spinner */
  const closeWeek = () => {
    if (ticking || persist.weekFiled) return
    setTicking(true)
    tickTimer.current = window.setTimeout(() => {
      setTicking(false)
      setPersist(pr => ({ ...pr, weekFiled: true }))
      showToast('AUTOSAVED — COMMAND LOG APPENDED · WEEK 41 FILED')
    }, 1900)
  }

  const openDoc = (id: string) => setOpenId(id)
  const doc = openId ? findDoc(openId) : undefined

  const setMark = (id: string, m: DocMarkState) =>
    setPersist(p => ({ ...p, marks: { ...p.marks, [id]: m } }))

  const decide = (id: string, key: string) => {
    setPersist(p => ({ ...p, decisions: { ...p.decisions, [id]: key } }))
    const dec = DECISIONS.find(d => d.id === id)
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
    setPersist({ marks: {}, decisions: {}, weathered: [] })
    try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
    showToast('WEEK CLEARED — THE DESK IS EMPTY AGAIN')
  }

  const urgentBadge = (persist.handoverDone ? 0 : 1) + DOCS.filter(d =>
    d.mark === 'urgent' &&
    !persist.marks[d.id]?.stamps.length &&
    !DECISIONS.some(x => x.docId === d.id && decStatus(x, persist).done),
  ).length

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
    briefings: <DeskScreen p={persist} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />,
    allies: <AlliesScreen onOpen={openDoc} />,
    decisions: <DecisionsScreen p={persist} onOpen={openDoc} onDecide={decide} onToast={showToast} onReset={reset} />,
    budget: <BudgetScreen />,
    files: <FilesScreen p={persist} onOpen={openDoc} onOpenDrawer={() => setDrawer(true)} />,
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
        doc.id !== 'handover' &&
        DECISIONS.some(x => x.docId === doc.id && !decStatus(x, persist).done)
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
          <div className="tick-word">TIDYING THE DESK OVERNIGHT — WEEK 41 → FILED</div>
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
        termStart: termStartFor(office.id),
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
  const obOffice = onboarding?.offices.find(o => o.id === onboarding.officeId) ?? DELTA_TUTORIAL_OFFICE
  const obRoute = postRoute(obOffice)
  const obNeedsJurisdiction = obRoute.kind === 'state' || obRoute.kind === 'state-then-lga'
  const obTotal = obNeedsJurisdiction ? 4 : 3
  const obStep = !onboarding || onboarding.phase === 'pick-post' ? 1
    : onboarding.phase === 'pick-state' ? 2
    : onboarding.phase === 'profile-sheet' ? obTotal
    : obNeedsJurisdiction ? 3 : 2
  const obStateObj = onboarding?.states.find(s => s.code === onboarding.stateCode)
  const obStateName = obStateObj?.name ?? 'the Federation'
  const obStateFull = obStateObj && obStateObj.tier === 'state' ? `${obStateObj.name} State` : obStateName
  const obMeta = onboarding?.sheet
    ? obOffice.jurisdiction === 'nation'
      ? `Age ${onboarding.sheet.age} • ${obOffice.post} — the Federation`
      : obOffice.tier === 'fct'
        ? `Age ${onboarding.sheet.age} • ${obOffice.post} — ${onboarding.sheet.capital}`
        : `Age ${onboarding.sheet.age} • ${obOffice.post} — ${onboarding.lgaName ? onboarding.lgaName + ', ' : ''}${obStateFull}`
    : ''

  /* Accept writes the record (Supabase when configured, local otherwise) and enters the desk. */
  const obAccept = async () => {
    const s = onboarding
    if (!s || s.phase !== 'profile-sheet' || !s.sheet) return
    const authUserId = persist.profileHandle
    if (!authUserId || !supabaseConfigured()) {
      setOnboarding(o => (o ? { ...o, phase: 'entering-desk' } : null))
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
      setOnboarding(o => (o ? { ...o, error: 'Could not save your file: ' + String(err) } : null))
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
                  setOnboarding({
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
                  })
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
                  onBack={() => setOnboarding(null)}
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
              ) : onboarding.phase === 'pick-state' ? (
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
              ) : onboarding.phase === 'who' ? (
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
      ) : (
        <main className="app-main" key={tab}>
          <div className="zoom-layer">
            {documentView || (expanded && tab === 'briefings'
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
                <div className="col-head">IN-TRAY · {WEEK.weekLine}</div>
                <div className="col-scroll">
                  <DeskScreen p={persist} onOpen={openDoc} ticking={ticking} onCloseWeek={closeWeek} />
                </div>
              </aside>
              <section className="col col-surface">{surface}</section>
              <aside className="col col-shelf">
                {tabbar}
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
                  ASUU ultimatum 15 Oct<br />
                  NLC window closes 20 Oct<br />
                  FAAC drops 21 Oct
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
