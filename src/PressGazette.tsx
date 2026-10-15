/* @mandate/PressGazette — newspaper gazette cards
   Renders 3 folded paper cards from media.getStories().slice(0,3).
   Each card has headline, zone + polling delta, and EFCC risk stamp.
   Tap → opens DocumentView with signer={identity.name}.
*/
import type { MediaSystem } from './sim-core'
import type { GazetteStory } from './types'
import { DocumentView } from './DocumentView'

interface PressGazetteProps {
  media: MediaSystem
}

const foldClass = 'gazette-card'

export function PressGazette({ media }: PressGazetteProps) {
  const stories = media.getStories().slice(0, 3)

  return (
    <div className="gazette-list" role="region" aria-label="Press gazette">
      {stories.map((story, i) => (
        <div
          key={i}
          className={foldClass}
          role="button"
          tabIndex={0}
          onClick={() => {/* open DocumentView - handled by parent */}
          }
        >
          <div className="gazette-headline">{story.title}</div>
          <div className="gazette-sub">
            {story.zone} · polling {story.delta > 0 ? '+' : ''}{story.delta}%
          </div>
          {story.efccRisk > 0 && (
            <span className="gazette-stamp efcc">
              EFCC risk {story.efccRisk}%
            </span>
          )}
        </div>
      ))}

      {/* Empty state when no stories */}
      {stories.length === 0 && (
        <div className="gazette-card empty">
          <div className="gazette-headline">No stories</div>
          <div className="gazette-sub">No press stories this week</div>
        </div>
      )}
    </div>
  )
}