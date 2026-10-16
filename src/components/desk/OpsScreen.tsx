/* @mandate/components/desk/OpsScreen — off the books.
 *
 * The desk says off-the-books work costs no Desk Hours. That is the whole point,
 * and it is also the warning: the money trail does not care about your hours.
 * This folder lists every move the simulation can actually run (the OPS
 * catalogue from desk-sim), prints the exposure the sim core will charge for it
 * BEFORE the hand presses anything, and then reports what the real machinery
 * did — the approval swing, the effect, the probe.
 *
 * Ordering goes through HoldToCommit: none of this is a tap.
 */

import type { DirtyTrick } from '../../types'
import { OPS } from '../../desk-sim'
import { EFCC_RISK, ICPC_RISK } from '../../sim-core'
import { HoldToCommit } from '../../hold'

export interface OpResult {
  ok: boolean
  effect: string
  approval: number
  efcc: boolean
}

export interface OpsScreenProps {
  /** what has already been run this week, keyed by trick */
  ops: Record<string, OpResult>
  /** order one — the desk runs it through the sim and records the outcome */
  onOrder: (trick: DirtyTrick) => void
  /** the week's public approval, so the folder can show where it now stands */
  approval?: number
  /** desk hours are not spent here; the folder says so once, at the top */
  deskHoursLeft?: number
}

/** One move: what it is, what it leaves behind, and the hand that orders it. */
function OpCard({ trick, label, sub, blurb, result, onOrder }: {
  trick: DirtyTrick
  label: string
  sub: string
  blurb: string
  result?: OpResult
  onOrder: (trick: DirtyTrick) => void
}) {
  const efcc = EFCC_RISK[trick]
  const icpc = ICPC_RISK[trick]
  const traced = efcc || icpc

  return (
    <article className="dv2-panel" aria-label={`Off the books: ${label}`}>
      <div className="dv2-panel-head">
        <span className="dv2-panel-title">{label.toUpperCase()}</span>
        <span className="dv2-panel-hint">no desk hours</span>
      </div>
      <p className="dv2-panel-line">{sub} — {blurb}</p>

      <div className="dv2-chips">
        {efcc && <span className="dv2-chip" data-tone="bad">EFCC exposure — the money trail exists</span>}
        {icpc && <span className="dv2-chip" data-tone="bad">ICPC exposure</span>}
        {!traced && <span className="dv2-chip" data-tone="good">no agency exposure on this one</span>}
      </div>

      {result ? (
        <div className="dv2-chips">
          <span className="dv2-chip" data-tone={result.ok ? 'good' : 'warn'}>{result.ok ? 'carried off' : 'it failed'}</span>
          <span className="dv2-chip" data-tone={result.approval < 0 ? 'bad' : result.approval > 0 ? 'good' : undefined}>
            approval {result.approval > 0 ? '+' : ''}{result.approval}
          </span>
          <span className="dv2-chip">{result.efcc ? 'a probe may follow' : 'nothing written down'}</span>
        </div>
      ) : (
        <div className="dv2-act-block">
          <HoldToCommit
            level={traced ? 3 : 2}
            className="dv2-hold"
            ariaLabel={`Order it — ${label}. Hold three seconds to confirm`}
            onCommit={() => onOrder(trick)}
          >
            ORDER IT — HOLD TO COMMIT
          </HoldToCommit>
        </div>
      )}

      {result && <p className="dv2-panel-line"><b>{result.ok ? 'It was done.' : 'It did not work.'}</b> {result.effect}</p>}
    </article>
  )
}

export function OpsScreen({ ops, onOrder, approval, deskHoursLeft }: OpsScreenProps) {
  const runs = Object.keys(ops)
  const probed = runs.filter(k => ops[k]?.efcc).length

  return (
    <div className="dv2-screen">
      <section className="dv2-panel" aria-label="Off the books">
        <div className="dv2-panel-head">
          <span className="dv2-panel-title">OFF THE BOOKS</span>
          <span className="dv2-panel-hint">it costs no desk hours — know why</span>
        </div>
        <div className="dv2-stats">
          <div className="dv2-stat">
            <span className="dv2-stat-k">RUNS THIS WEEK</span>
            <span className="dv2-stat-v">{runs.length}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">MONEY TRAILS</span>
            <span className="dv2-stat-v" data-tone={probed > 0 ? 'bad' : 'good'}>{probed}</span>
          </div>
          {typeof deskHoursLeft === 'number' && (
            <div className="dv2-stat">
              <span className="dv2-stat-k">DESK HOURS LEFT</span>
              <span className="dv2-stat-v">{deskHoursLeft}</span>
            </div>
          )}
          {typeof approval === 'number' && (
            <div className="dv2-stat">
              <span className="dv2-stat-k">PUBLIC APPROVAL</span>
              <span className="dv2-stat-v" data-tone={approval >= 50 ? 'good' : 'warn'}>{approval}%</span>
            </div>
          )}
        </div>
        <p className="dv2-panel-line">
          These moves never appear on the desk's record. Each one is executed by the simulation itself —
          the media, the shocks, the agencies — and the result is recorded on the book below until the week closes.
          {' '}Nothing here is a threat you can take back.
        </p>
      </section>

      <div className="dv2-screen-head">
        <span className="dv2-panel-title">THE MOVES</span>
        <span className="dv2-screen-count">{OPS.length} on the table · one run each per week</span>
      </div>

      {OPS.map(op => (
        <OpCard
          key={op.key}
          trick={op.key}
          label={op.label}
          sub={op.sub}
          blurb={op.blurb}
          result={ops[op.key]}
          onOrder={onOrder}
        />
      ))}
    </div>
  )
}

export default OpsScreen
