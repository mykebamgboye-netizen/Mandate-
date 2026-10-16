/* @mandate/components/desk/TreasuryScreen — the Consolidated Revenue Fund.
 *
 * The purse in the folders bar opens this. It is the same ledger the desk's own
 * accounting uses, printed the way a treasury prints: opening balance, every
 * posted line with its running effect, the closing balance, and the pending
 * items called out SEPARATELY because they have not been charged.
 *
 * The rule this screen exists to keep: a pending item is not money spent. The
 * closing figure never includes it, and the line under the ledger says what the
 * balance becomes if the hand sanctions all of it.
 */

import { formatNaira, nairaDisplay } from '../../content'

export interface TreasuryRow {
  date: string
  memo: string
  amount: number
  /** awaiting the player's sanction — shown, never added in */
  pending?: boolean
}

export interface TreasuryScreenProps {
  /** the fund's name, e.g. "Consolidated Revenue Fund — State Treasury" */
  title: string
  /** the period line, e.g. "OCTOBER 2026 · WEEK 41 · ALL FIGURES TO THE NAIRA" */
  sub: string
  opening: number
  openingLabel?: string
  openingNote: string
  rows: TreasuryRow[]
  closing: number
  closingLabel?: string
  /** total of the pending lines */
  pendingTotal: number
  /** closing balance the moment every pending line is sanctioned */
  afterSanction: number
  /** the authority the fund answers to */
  authority: string
  /** this month's shortfall against projection, in naira */
  shortfall: number
}

export function TreasuryScreen({
  title, sub, opening, openingLabel = 'OPENING', openingNote,
  rows, closing, closingLabel = 'CLOSING',
  pendingTotal, afterSanction, authority, shortfall,
}: TreasuryScreenProps) {
  const posted = rows.filter(r => !r.pending)
  const pending = rows.filter(r => r.pending)

  return (
    <div className="dv2-screen">
      <section className="dv2-panel" aria-label="Treasury ledger">
        <div className="dv2-panel-head">
          <span className="dv2-panel-title">THE LEDGER</span>
          <span className="dv2-panel-hint">{sub}</span>
        </div>

        <div className="dv2-stats">
          <div className="dv2-stat">
            <span className="dv2-stat-k">{openingLabel}</span>
            <span className="dv2-stat-v">{formatNaira(opening)}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">{closingLabel}</span>
            <span className="dv2-stat-v" data-tone={closing >= opening ? 'good' : 'bad'}>{formatNaira(closing)}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">PENDING, NOT CHARGED</span>
            <span className="dv2-stat-v" data-tone="warn">{formatNaira(pendingTotal)}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">FAAC SHORTFALL</span>
            <span className="dv2-stat-v" data-tone="bad">{nairaDisplay(shortfall)}</span>
          </div>
        </div>

        <p className="dv2-panel-line">
          {title} — {openingNote.toLowerCase()}. {posted.length} lines are posted and charged;
          {' '}{pending.length} line{pending.length === 1 ? ' is' : 's are'} waiting on your hand and are not in the closing figure.
        </p>

        <div className="dv2-ledger">
          {rows.map((row, i) => (
            <div className={`dv2-ledger-row${row.pending ? ' pending' : ''}`} key={`${row.date}-${i}`}>
              <span className="dv2-ledger-date">{row.date}</span>
              <span className="dv2-ledger-memo">
                {row.memo}
                {row.pending && <span className="dv2-ledger-tag">AWAITING YOUR SANCTION — NOT CHARGED</span>}
              </span>
              <span className={`dv2-ledger-amount ${row.amount >= 0 ? 'credit' : 'debit'}`}>{formatNaira(row.amount)}</span>
            </div>
          ))}
        </div>

        <div className="dv2-ledger-total">
          <span className="dv2-ledger-total-k">{closingLabel === 'CLOSING' ? 'CLOSING BALANCE' : closingLabel.toUpperCase()}</span>
          <span className="dv2-ledger-total-v">{formatNaira(closing)}</span>
        </div>
        <p className="dv2-ledger-foot">
          IF EVERY PENDING ITEM IS SANCTIONED: {formatNaira(afterSanction)}<br />
          AUTHORITY: {authority}
        </p>
      </section>

      <section className="dv2-panel tight" aria-label="Treasury rules">
        <span className="dv2-panel-title">HOW THIS LEDGER READS</span>
        <p className="dv2-panel-line">
          Inflows are printed as credits and outflows as debits; the closing figure is the sum of the charged lines only.
          Sanctioning a pending item moves it into the charged ledger and REDUCES cash — it was never income.
          Off-the-books work never appears here at all, which is exactly what makes it a risk.
        </p>
      </section>
    </div>
  )
}

export default TreasuryScreen
