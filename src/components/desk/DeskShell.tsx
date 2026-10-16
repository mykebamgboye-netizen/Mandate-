/* @mandate/components/desk/DeskShell — the new desk surface.
   Composes the tier header, the patron row, the live decision card, the press
   clipping and the bottom folders, and keeps the two things the desk cannot
   lose: the in-tray (a file still has to be openable) and the week close.
   Switches tier between federal / state / LGA without touching the data above
   it — everything the bar prints arrives as a prop. */
import { useState } from 'react'
import FederalHeader, { COUNCIL_NAME, type DeskLevel } from './FederalHeader'
import DeskCard, { MOCK_DESK_CARD, type DeskCardData } from './DeskCard'
import PatronRow, { type Patron } from './PatronRow'
import Gazette, { MOCK_GAZETTE, type GazetteContent } from './Gazette'
import BottomNav, { type BottomTab } from './BottomNav'
import { HoldToCommit } from '../../hold'
import './desk.css'

export interface DeskShellTrayItem {
  id: string
  title: string
  trayLine: string
  /** hard mark on the file — urgent, forwarded … */
  mark?: string
}

export interface DeskShellProps {
  /** tier this desk reports to; defaults to a state desk */
  level?: DeskLevel
  week?: number
  capital?: string
  /** naira in hand, printed on the nav pill */
  budget?: number
  patrons?: Patron[]
  /** the decision on the desk; MOCK_DESK_CARD renders when this is absent */
  card?: DeskCardData | null
  cardDeadline?: string
  signNote?: string
  deferNote?: string
  rejectNote?: string
  onSign?: () => void
  onDefer?: () => void
  onReject?: () => void
  gazette?: GazetteContent | null
  tray?: DeskShellTrayItem[]
  onOpenDoc?: (id: string) => void
  activeTab?: BottomTab
  onTabChange?: (tab: BottomTab) => void
  /** open the cabinet — everything the paper remembers */
  onOpenCabinet?: () => void
  /** the purse in the folders bar opens the treasury ledger */
  onOpenTreasury?: () => void
  onCloseWeek?: () => void
  ticking?: boolean
  /** the app shell renders its own bar for the other folders */
  showNav?: boolean
}

const LEVELS: { id: DeskLevel; label: string }[] = [
  { id: 'federal', label: 'FEDERAL' },
  { id: 'state', label: 'STATE' },
  { id: 'lga', label: 'LGA' },
]

export function DeskShell({
  level = 'state',
  week = 41,
  capital = 'Abuja',
  budget = 500_000_000,
  patrons = [],
  card = null,
  cardDeadline,
  signNote,
  deferNote,
  rejectNote,
  onSign,
  onDefer,
  onReject,
  gazette = null,
  tray = [],
  onOpenDoc,
  activeTab = 'desk',
  onTabChange,
  onOpenCabinet,
  onOpenTreasury,
  onCloseWeek,
  ticking = false,
  showNav = true,
}: DeskShellProps) {
  /* the tier bar can be flipped by hand — the desk keeps its own level until a
     parent hands it a new one */
  const [tier, setTier] = useState<DeskLevel>(level)

  const decision: DeskCardData = card ?? MOCK_DESK_CARD
  const story: GazetteContent = gazette ?? MOCK_GAZETTE

  return (
    <div className="dv2" data-level={tier}>
      <FederalHeader level={tier} week={week} capital={capital} />

      <div className="dv2-tier-switch" role="group" aria-label="Tier of this desk">
        <span className="dv2-tier-label">{COUNCIL_NAME[tier]}</span>
        {LEVELS.map(l => (
          <button
            key={l.id}
            type="button"
            className={`dv2-tier-btn${tier === l.id ? ' active' : ''}`}
            aria-pressed={tier === l.id}
            onClick={() => setTier(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="dv2-body">
        <PatronRow patrons={patrons} />

        <DeskCard
          title={decision.title}
          status={decision.status}
          description={decision.description}
          impacts={decision.impacts}
          deadline={cardDeadline}
          signNote={signNote}
          deferNote={deferNote}
          rejectNote={rejectNote}
          onSign={onSign ?? (() => undefined)}
          onDefer={onDefer ?? (() => undefined)}
          onReject={onReject ?? (() => undefined)}
        />

        <Gazette headline={story.headline} date={story.date} body={story.body} />

        {tray.length > 0 && (
          <section className="dv2-tray" aria-label="In-tray">
            <div className="dv2-tray-head">
              <span>IN-TRAY</span>
              {onOpenCabinet ? (
                <button type="button" className="dv2-tray-open" onClick={onOpenCabinet}>
                  THE CABINET \u2192
                </button>
              ) : (
                <span className="dv2-tray-hint">{tray.length} file{tray.length === 1 ? '' : 's'} on the desk</span>
              )}
            </div>
            {tray.map(d => (
              <button
                key={d.id}
                type="button"
                className="dv2-tray-row"
                data-mark={d.mark ?? 'none'}
                onClick={() => onOpenDoc?.(d.id)}
              >
                <span className="dv2-tray-title">{d.title}</span>
                <span className="dv2-tray-line">{d.trayLine}</span>
                {d.mark === 'urgent' && <span className="dv2-tray-flag">URGENT</span>}
              </button>
            ))}
          </section>
        )}
      </div>

      {onCloseWeek && (
        <section className="dv2-close" aria-label="Close the week">
          <HoldToCommit
            level={2}
            ariaLabel="Close the week — tap to begin, hold 2s to confirm"
            onCommit={() => onCloseWeek()}
          >
            {ticking ? 'FILING…' : 'CLOSE THE WEEK — THE SIM ADVANCES'}
          </HoldToCommit>
          <div className="dv2-close-hint">Autosave runs on commit, never before (§3.7)</div>
        </section>
      )}

      {showNav && onTabChange && (
        <BottomNav
          activeTab={activeTab}
          budget={budget}
          week={week}
          onTabChange={onTabChange}
          onOpenTreasury={onOpenTreasury}
        />
      )}
    </div>
  )
}

export default DeskShell
