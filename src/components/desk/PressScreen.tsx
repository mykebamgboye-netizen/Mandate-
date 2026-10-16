/* @mandate/components/desk/PressScreen — the press folder.
 *
 * The desk shows one clipping; the folder shows the week's paper. Each story the
 * simulation printed becomes the same aged clipping the desk uses (the Gazette
 * component, untouched), so a story reads identically in both places, and the
 * panel above them totals what the press did this week: how many stories, which
 * way the polls moved, and how much of it names you.
 */

import Gazette from './Gazette'
import type { GazetteStory } from '../../types'
import { weekDateLine } from '../../desk-sim'

export interface PressScreenProps {
  stories: GazetteStory[]
  /** the game week, printed as the paper's dateline */
  week: number
  /** the office the clippings are filed under */
  seatName?: string
  /** masthead, so an LGA desk does not print the national paper */
  masthead?: string
}

function polarity(story: GazetteStory): 'good' | 'warn' | 'bad' {
  if (story.magnitude <= 0) return 'good'
  if (story.magnitude === 1) return 'warn'
  return 'bad'
}

export function PressScreen({ stories, week, seatName, masthead = 'THE GAZETTE' }: PressScreenProps) {
  const net = stories.reduce((sum, s) => sum + s.magnitude, 0)
  const hard = stories.filter(s => s.magnitude >= 2).length
  const date = weekDateLine(week).toUpperCase()

  return (
    <div className="dv2-screen">
      <section className="dv2-panel" aria-label="What the press did">
        <div className="dv2-panel-head">
          <span className="dv2-panel-title">THE PRESS LEDGER</span>
          <span className="dv2-panel-hint">{date}{seatName ? ` · ${seatName.toUpperCase()}` : ''}</span>
        </div>
        <div className="dv2-stats">
          <div className="dv2-stat">
            <span className="dv2-stat-k">STORIES THIS WEEK</span>
            <span className="dv2-stat-v">{stories.length}</span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">NET POLLING</span>
            <span className="dv2-stat-v" data-tone={net < 0 ? 'bad' : net > 0 ? 'good' : undefined}>
              {net > 0 ? '+' : ''}{net}
            </span>
          </div>
          <div className="dv2-stat">
            <span className="dv2-stat-k">DAMAGING</span>
            <span className="dv2-stat-v" data-tone={hard > 0 ? 'bad' : 'good'}>{hard}</span>
          </div>
        </div>
        <p className="dv2-panel-line">
          {stories.length === 0
            ? 'Nothing ran this week. A quiet press is not a friendly press — it means nobody is watching you yet.'
            : 'A story is not the truth and it is not a lie; it is what survives the second day. Read the ledger before you decide what to do about it.'}
        </p>
        {hard > 0 && (
          <div className="dv2-chips">
            <span className="dv2-chip" data-tone="bad">{hard} stor{hard === 1 ? 'y carries' : 'ies carry'} EFCC-grade risk</span>
          </div>
        )}
      </section>

      {stories.length === 0 ? (
        <div className="dv2-empty">
          <b>No clippings this week</b>
          The desk files a clipping the moment the simulation prints a story. Close the week and Monday's paper lands here.
        </div>
      ) : (
        stories.map(story => (
          <div className="dv2-screen" key={story.id}>
            <div className="dv2-chips" style={{ marginTop: 0 }}>
              <span className="dv2-chip" data-tone={polarity(story)}>
                polling {story.magnitude > 0 ? '+' : ''}{story.magnitude}
              </span>
              <span className="dv2-chip">{story.impact === 'both' ? 'market + approval' : story.impact}</span>
              {(story.affectedSectors.length > 0 ? story.affectedSectors : ['National']).map(s => (
                <span className="dv2-chip" key={s}>{s}</span>
              ))}
            </div>
            <Gazette
              masthead={masthead}
              headline={story.title}
              date={date}
              body={story.description}
              folio={`Filed ${weekDateLine(week)} · week ${week}`}
            />
          </div>
        ))
      )}
    </div>
  )
}

export default PressScreen
