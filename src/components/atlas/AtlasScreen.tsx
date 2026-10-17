/* @mandate/components/atlas/AtlasScreen — the atlas folder, in the desk's clothes.
 *
 * The atlas answers "where can I go next?"; this screen adds the other half of
 * that question — where have I already been. Under the seats stands the century:
 * every life on file, newest first, with the one line the registry keeps for it.
 * Nothing here switches or retires a life; it reads them, and it says plainly
 * that a run started from this screen is appended, never a wipe.
 */

import FolderShell from '../desk/FolderShell'
import PositionAtlas from './PositionAtlas'
import type { BottomTab } from '../desk/BottomNav'
import type { DeskLevel } from '../desk/FederalHeader'
import type { PollRow } from '../../living-desk'

export interface AtlasLife {
  id: string
  /** the registry's own one-line summary of the life */
  summary: string
  active: boolean
  ended: boolean
}

export interface AtlasScreenProps {
  lives: AtlasLife[]
  /** the polls still ahead, soonest first — the answer to "when is it my turn?" */
  polls?: PollRow[]
  /** RUN HERE — starts a new life on the seat and keeps every earlier one */
  onRunFor: (positionId: string) => void
  level?: DeskLevel
  week?: number
  capital?: string
  budget?: number
  onTabChange: (tab: BottomTab) => void
  onBack?: () => void
  onOpenTreasury?: () => void
}

export function AtlasScreen({
  lives, polls = [], onRunFor,
  level = 'state', week = 41, capital = 'Abuja', budget = 0,
  onTabChange, onBack, onOpenTreasury,
}: AtlasScreenProps) {
  const ended = lives.filter(l => l.ended).length

  return (
    <FolderShell
      tab="atlas"
      kicker="FOLDER · THE COUNTRY"
      title="THE STRUCTURE OF THE COUNTRY"
      sub="Every seat in the federation, who holds it this week, and what a serious run costs. The roster is generated from the same seed as the desk's own cast."
      level={level}
      week={week}
      capital={capital}
      budget={budget}
      onTabChange={onTabChange}
      onBack={onBack}
      backLabel="BACK TO THE DESK"
      onOpenTreasury={onOpenTreasury}
    >
      <PositionAtlas onRunFor={onRunFor} />

      {polls.length > 0 && (
        <section className="dv2-panel" aria-label="The next polls">
          <div className="dv2-panel-head">
            <span className="dv2-panel-title">THE NEXT POLLS</span>
            <span className="dv2-panel-hint">next: {polls[0]!.dateLabel}</span>
          </div>
          <p className="dv2-panel-line">
            When a seat comes up. Primaries open ninety days before each poll, and taking a
            seat above this one writes a new life rather than editing this one.
          </p>
          <div className="dv2-rows">
            {polls.map((poll, i) => (
              <div className="dv2-row" key={poll.id} data-tone={i === 0 ? 'done' : undefined}>
                <span className="dv2-row-main">
                  <span className="dv2-row-title">{poll.label}</span>
                  <span className="dv2-row-line">primaries open {poll.primaryOpensLabel}</span>
                </span>
                <span className="dv2-row-facts">
                  <span className="dv2-row-state">{poll.dateLabel}</span>
                  <span className="dv2-row-state" data-tone="good">
                    {poll.officesUp} seat{poll.officesUp === 1 ? '' : 's'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dv2-panel" aria-label="The century">
        <div className="dv2-panel-head">
          <span className="dv2-panel-title">THE CENTURY — LIVES ON FILE</span>
          <span className="dv2-panel-hint">
            {lives.length === 0 ? 'none yet' : `${lives.length} on file · ${ended} ended`}
          </span>
        </div>
        <p className="dv2-panel-line">
          One save per life, and no life is ever erased. Running for a seat above appends a new life
          and leaves this desk, its profile and everything already on file exactly where they are.
        </p>
        {lives.length === 0 ? (
          <div className="dv2-empty">
            <b>No lives on file yet</b>
            Press RUN HERE on an elected seat and the first life is written down. The earlier ones stay readable for good.
          </div>
        ) : (
          <div className="dv2-rows">
            {lives.map(life => (
              <div className="dv2-row dv2-lives-row" key={life.id} data-tone={life.ended ? 'none' : 'done'}>
                <span className="dv2-row-main">
                  <span className="dv2-row-title">{life.summary}</span>
                  <span className="dv2-row-line">{life.id}</span>
                </span>
                <span className="dv2-row-facts">
                  <span className="dv2-row-state" data-tone={life.ended ? undefined : 'good'}>
                    {life.ended ? 'ENDED' : life.active ? 'ON THE DESK' : 'ON FILE'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </FolderShell>
  )
}

export default AtlasScreen
