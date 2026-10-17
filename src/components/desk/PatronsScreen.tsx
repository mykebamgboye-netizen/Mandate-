/* @mandate/components/desk/PatronsScreen — the patrons folder, full length.
 *
 * The desk carries a scroller of patron chips; this is the page behind it. It
 * reads the same loyalty numbers as the row (patronTone / patronStatusLabel) so
 * a patron can never read one way on the desk and another way in the folder,
 * and it adds the two facts the chips have no room for: the patronage bank the
 * desk inherited, and the quarterly obligation that follows from it.
 *
 * Money is in naira. Nothing here invents a bank: with none on file the panel
 * says so rather than printing ₦0 as if it were a balance.
 */

import { patronTone, patronStatusLabel, DEMO_PATRONS, type Patron, type PatronTone } from './PatronRow'
import type { CastMember } from '../../living-desk'

export interface PatronsScreenProps {
  /** the desk's own patrons — empty means the demo roster stands in */
  patrons?: Patron[]
  /** the actors the living world runs, as the desk knows them */
  cast?: CastMember[]
  /** the patronage bank the record was opened with, if the save carries one */
  patronageBank?: number
  /** who sits at this desk, for the panel line */
  seatName?: string
  /** current public approval, so the folder can show what loyalty is protecting */
  approval?: number
  /** weeks from now to the quarterly return */
  weeksInQuarter?: number
}

/** One name on either roster. Loyalty is a meter and a word — never a bare number — and
 *  the two rosters share this card so a patron and an actor can never render differently. */
function RosterCard({ name, role, loyalty, tone, status, terms, due }: {
  name: string
  role: string
  loyalty: number
  tone: PatronTone
  status: string
  terms: string
  due: boolean
}) {
  const dots = Math.max(0, Math.min(5, Math.round(loyalty)))
  const initials = name
    .trim()
    .replace(/^(Dr\.|Hajia|Chief|Hon\.|Alhaji|Elder|Mr\.|Mrs\.|Ms\.)\s+/i, '')
    .split(/\s+/)
    .map(part => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—'

  return (
    <article className="dv2-patron-card" data-tone={tone}>
      <div className="dv2-patron-card-top">
        <span className="dv2-patron-face" aria-hidden>{initials}</span>
        <div>
          <div className="dv2-patron-name">{name}</div>
          <div className="dv2-patron-role">{role}</div>
        </div>
      </div>
      <span className="dv2-meter" aria-hidden>
        <span className="dv2-meter-fill" data-tone={tone} style={{ width: `${dots * 20}%` }} />
      </span>
      <div className="dv2-chip" data-tone={due ? 'bad' : undefined}>
        {status}
      </div>
      <div className="dv2-patron-terms">{terms}</div>
    </article>
  )
}

function PatronCard({ patron }: { patron: Patron }) {
  const tone = patronTone(patron.loyalty)
  const dots = Math.max(0, Math.min(5, Math.round(patron.loyalty)))
  return (
    <RosterCard
      name={patron.name}
      role={patron.role}
      loyalty={patron.loyalty}
      tone={tone}
      status={patronStatusLabel(patron)}
      due={typeof patron.ROI_due_weeks === 'number' && patron.ROI_due_weeks <= 2}
      terms={`loyalty ${dots} of 5${typeof patron.ROI_due_weeks === 'number' ? ` · return due in ${Math.max(0, patron.ROI_due_weeks)} week${patron.ROI_due_weeks === 1 ? '' : 's'}` : ''}`}
    />
  )
}

/** One actor from the living world. The dots are the desk's standing with them — the
 *  number is printed beside them, because a meter nobody can read is a decoration. */
function CastCard({ member }: { member: CastMember }) {
  const tone = patronTone(member.loyalty)
  const owed = member.owes > 0
    ? `you owe ${nairaLine(member.owes)}`
    : member.theyOweYou > 0
      ? `owes you ${nairaLine(member.theyOweYou)}`
      : 'nothing owed either way'
  return (
    <RosterCard
      name={member.name}
      role={member.role}
      loyalty={member.loyalty}
      tone={tone}
      status={`trust ${member.trust > 0 ? '+' : ''}${member.trust}`}
      due={typeof member.ROI_due_weeks === 'number' && member.ROI_due_weeks <= 2}
      terms={owed}
    />
  )
}

/** 1_000_000_000 → "₦1.00bn"; 500_000_000 → "₦500m" — the same way the purse prints. */
function nairaLine(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `₦${(abs / 1_000_000_000).toFixed(2)}bn`
  if (abs >= 1_000_000) return `₦${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}m`
  if (abs >= 1_000) return `₦${Math.round(abs / 1_000)}k`
  return `₦${abs.toFixed(0)}`
}

export function PatronsScreen({
  patrons = [],
  cast = [],
  patronageBank,
  seatName,
  approval,
  weeksInQuarter = 13,
}: PatronsScreenProps) {
  const demo = patrons.length === 0
  const list = demo ? DEMO_PATRONS : patrons
  const dueNow = list.filter(p => typeof p.ROI_due_weeks === 'number' && p.ROI_due_weeks <= 0).length
  const dueSoon = list.filter(p => typeof p.ROI_due_weeks === 'number' && p.ROI_due_weeks > 0 && p.ROI_due_weeks <= 2).length
  const average = list.reduce((sum, p) => sum + Math.max(0, Math.min(5, p.loyalty)), 0) / (list.length || 1)
  /* The quarterly obligation is what the bank has to carry across thirteen weeks,
     rounded to the million the desk works in. With no bank on file, it is not known. */
  const quarterlyDue = typeof patronageBank === 'number' ? Math.round(patronageBank / weeksInQuarter / 1_000_000) * 1_000_000 : null

  return (
    <div className="dv2-screen">
      <section className="dv2-panel" aria-label="Patronage bank">
        <div className="dv2-panel-head">
          <span className="dv2-panel-title">THE BOOK OF OWED</span>
          <span className="dv2-panel-hint">{demo ? 'demo roster — no patron data on file' : `${list.length} on the book`}</span>
        </div>
        <div className="dv2-stats">
          <div className="dv2-stat">
            <span className="dv2-stat-k">PATRONAGE BANK</span>
            <span className="dv2-stat-v" data-tone={typeof patronageBank === 'number' ? 'good' : undefined}>
              {typeof patronageBank === 'number' ? nairaLine(patronageBank) : 'not on file'}
            </span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">QUARTERLY DUE</span>
            <span className="dv2-stat-v" data-tone={quarterlyDue === null ? undefined : 'warn'}>
              {quarterlyDue === null ? '—' : nairaLine(quarterlyDue)}
            </span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">DUE NOW · SOON</span>
            <span className="dv2-stat-v" data-tone={dueNow > 0 ? 'bad' : dueSoon > 0 ? 'warn' : 'good'}>
              {dueNow} · {dueSoon}
            </span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">AVERAGE LOYALTY</span>
            <span className="dv2-stat-v">{average.toFixed(1)} / 5</span>
          </div>
          {typeof approval === 'number' && (
            <div className="dv2-stat">
              <span className="dv2-stat-k">PUBLIC APPROVAL</span>
              <span className="dv2-stat-v" data-tone={approval >= 50 ? 'good' : 'warn'}>{approval}%</span>
            </div>
          )}
        </div>
        <p className="dv2-panel-line">
          Patronage is not a greeting. Every name here put something in — a ward, a church, a war chest —
          and each one expects a return before {weeksInQuarter} weeks pass{seatName ? `. You sit at ${seatName}.` : '.'}
        </p>
        {(dueNow > 0 || dueSoon > 0) && (
          <div className="dv2-chips">
            {dueNow > 0 && <span className="dv2-chip" data-tone="bad">{dueNow} return{dueNow === 1 ? '' : 's'} due now — they will ask in person</span>}
            {dueSoon > 0 && <span className="dv2-chip" data-tone="warn">{dueSoon} due within two weeks</span>}
          </div>
        )}
      </section>

      <div className="dv2-screen-head">
        <span className="dv2-panel-title">THE ROSTER</span>
        <span className="dv2-screen-count">loyalty · what is due</span>
      </div>

      {demo && (
        <div className="dv2-empty">
          <b>No patron data on file</b>
          The desk's record has no patronage network attached, so the three names below are a stand-in.
        </div>
      )}

      <div className="dv2-patron-grid">
        {list.map((p, i) => (
          <PatronCard key={p.id ?? `${p.name}-${i}`} patron={p} />
        ))}
      </div>

      {cast.length > 0 && (
        <section className="dv2-panel" aria-label="The cast">
          <div className="dv2-panel-head">
            <span className="dv2-panel-title">THE CAST — WHO IS WATCHING</span>
            <span className="dv2-panel-hint">{cast.length} of the actors the country runs</span>
          </div>
          <p className="dv2-panel-line">
            These are not patrons and the dots are not loyalty. They are the desk’s standing
            with the people holding the seats around it: one dot is −100 trust, five is +100,
            and the number is printed so the dots cannot lie. Nobody here has to take your call.
          </p>
          <div className="dv2-patron-grid">
            {cast.map(member => (
              <CastCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default PatronsScreen
