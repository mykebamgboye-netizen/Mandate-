/* @mandate/components/atlas/PositionAtlas — the Position Atlas.
 *
 * Every seat in the federation, grouped by tier, with today's holder and what a serious
 * run costs. This is the screen that answers "where can I go next?" — it replaces the
 * picker's short list of four posts with the whole structure of the country.
 *
 * It renders the top of each tier and reports the remainder as a number; the full list of
 * any tier is available through seatsOfTier. Presentational only: no clock, no fetch.
 * It wears the desk's own clothes — one white card per tier, the holder on a tone stripe,
 * the appointment printed as a stamp rather than a sentence.
 */

import { useMemo } from 'react'
import { buildAtlas, atlasHeadline, ATLAS_TIER_ORDER, groupDigits, type Atlas } from './atlas-data'
import { formatBudget } from '../desk/BottomNav'
import type { PositionTier } from '../../sim/positions'

export interface PositionAtlasProps {
  /** seed of the living world whose cast holds the seats */
  seed?: number
  /** rows rendered per tier */
  rowLimit?: number
  /** prettier tier first when the atlas opens on a phone */
  focusTier?: PositionTier
  /** called with a seat id when the player chooses to run */
  onRunFor?: (positionId: string) => void
}

export const ATLAS_DEFAULT_SEED = 0xc0ffee

export default function PositionAtlas({
  seed = ATLAS_DEFAULT_SEED,
  rowLimit = 5,
  focusTier,
  onRunFor,
}: PositionAtlasProps) {
  // building the cast is ~45ms once; memoised on the seed so the atlas never pays twice
  const atlas: Atlas = useMemo(() => buildAtlas({ seed, rowLimit }), [seed, rowLimit])

  const order = focusTier
    ? [focusTier, ...ATLAS_TIER_ORDER.filter(t => t !== focusTier)]
    : ATLAS_TIER_ORDER

  return (
    <section className="dv2-atlas" aria-label="Position atlas">
      <header className="dv2-screen-head">
        <h2 className="dv2-panel-title">POSITION ATLAS</h2>
        <span className="dv2-screen-count">{atlasHeadline(atlas.counts)}</span>
      </header>
      <p className="dv2-panel-line" style={{ marginTop: 0 }}>
        Every office is open on day one. The roster below is who holds it this week —
        generated from the same seed that runs the 250 actors behind the desk.
      </p>

      {order.map(tier => {
        const section = atlas.sections.find(s => s.tier === tier)
        if (!section) return null
        return (
          <div className="dv2-atlas-tier" key={section.tier}>
            <div className="dv2-atlas-tier-head">
              <b>{section.label.toUpperCase()}</b>
              <i>
                {groupDigits(section.total)} seat{section.total === 1 ? '' : 's'}
              </i>
              <span>{section.note}</span>
            </div>
            <ul className="dv2-atlas-rows">
              {section.seats.map(seat => (
                <li className="dv2-atlas-row" data-key={seat.holderIsKey ? 'true' : 'false'} key={seat.id}>
                  <div>
                    <b className="dv2-atlas-title">{seat.title}</b>
                    <span className="dv2-atlas-juris">{seat.jurisdiction}</span>
                    <span className="dv2-atlas-holder">
                      {seat.holderName}
                      {seat.holderParty ? ` · ${seat.holderParty}` : ''}
                      {seat.holderIsKey ? <em> · key actor</em> : null}
                    </span>
                  </div>
                  <div className="dv2-atlas-facts">
                    <span className="dv2-atlas-fact" title="monthly salary">{formatBudget(seat.salaryMonthly)}/mo</span>
                    <span className="dv2-atlas-fact">{seat.termYears}-year term</span>
                    <span className="dv2-atlas-run">run: {formatBudget(seat.campaignCostNaira)}</span>
                    {seat.appointmentType === 'elected' ? (
                      onRunFor ? (
                        <button type="button" className="dv2-atlas-go" onClick={() => onRunFor(seat.id)}>
                          RUN HERE
                        </button>
                      ) : null
                    ) : (
                      <span className="dv2-atlas-appointed">{seat.appointmentType.replace('_', ' ')}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {section.shown < section.total ? (
              <p className="dv2-atlas-more">
                showing the {groupDigits(section.shown)} most senior of {groupDigits(section.total)}
              </p>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
