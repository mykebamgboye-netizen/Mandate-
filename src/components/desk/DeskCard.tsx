/* @mandate/components/desk/DeskCard — the decision waiting on the desk.
   A white card: the decision at the head with its stamp, a two-line body, the
   impact tags, and the three things a hand can do — sign, defer, reject.
   Falls back to MOCK_DESK_CARD when there is no live decision (no database, no
   simulation yet), so the surface never renders blank. */

export interface DeskCardData {
  title: string
  /** stamped at the head of the card — PENDING, SIGNED, DEFERRED … */
  status: string
  description: string
  impacts: string[]
}

export interface DeskCardProps extends DeskCardData {
  /** red deadline line under the head, e.g. "SIGN BEFORE FAAC DROPS — 21 OCT" */
  deadline?: string
  /** one-line caption under each action — what the choice actually writes */
  signNote?: string
  deferNote?: string
  rejectNote?: string
  onSign: () => void
  onDefer: () => void
  onReject: () => void
}

/** Offline / pre-sim stand-in: the desk still shows one decision to reason about. */
export const MOCK_DESK_CARD: DeskCardData = {
  title: 'FAAC revision',
  status: 'PENDING',
  description:
    'The Federation Account Allocation Committee has revised the monthly distribution formula. '
    + 'States lose 4.2% of net allocation from November unless the Council of State pushes back.',
  impacts: ['+₦2.1bn monthly', 'Governors −1 loyalty'],
}

function statusTone(status: string): string {
  const s = status.toUpperCase()
  if (s.startsWith('SIGN') || s.startsWith('APPROV')) return 'signed'
  if (s.startsWith('DEFER')) return 'deferred'
  if (s.startsWith('REJECT') || s.startsWith('DECLIN')) return 'rejected'
  return 'pending'
}

export function DeskCard({
  title, status, description, impacts,
  deadline, signNote, deferNote, rejectNote,
  onSign, onDefer, onReject,
}: DeskCardProps) {
  return (
    <article className="dv2-card" aria-label={`Decision: ${title}`}>
      <div className="dv2-card-head">
        <h2 className="dv2-card-title">
          <span className="dv2-card-kicker">DECISION:</span> {title}
        </h2>
        <span className="dv2-stamp" data-tone={statusTone(status)}>{status.toUpperCase()}</span>
      </div>

      {deadline && <p className="dv2-card-deadline">{deadline}</p>}

      <p className="dv2-card-body">{description}</p>

      {impacts.length > 0 && (
        <ul className="dv2-impacts" aria-label="Impact">
          {impacts.map(tag => (
            <li key={tag} className="dv2-impact">{tag}</li>
          ))}
        </ul>
      )}

      <div className="dv2-actions">
        <button type="button" className="dv2-btn sign" onClick={onSign}>
          <span className="dv2-btn-label">Sign</span>
          {signNote && <span className="dv2-btn-note">{signNote}</span>}
        </button>
        <button type="button" className="dv2-btn defer" onClick={onDefer}>
          <span className="dv2-btn-label">Defer</span>
          {deferNote && <span className="dv2-btn-note">{deferNote}</span>}
        </button>
        <button type="button" className="dv2-btn reject" onClick={onReject}>
          <span className="dv2-btn-label">Reject</span>
          {rejectNote && <span className="dv2-btn-note">{rejectNote}</span>}
        </button>
      </div>
    </article>
  )
}

export default DeskCard
