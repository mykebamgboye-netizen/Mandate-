/* @mandate/components/desk/FolderShell — the chrome every folder screen wears.
 *
 * The desk has a bar, a tier strip, a body and a folders bar; the other folders
 * are not the desk, but they are the same desk's furniture. This composes that
 * furniture once — the office header, the folder's own name on a gold rule, the
 * folders bar at the foot — and leaves the body to the screen itself.
 *
 * Nothing here reads the save: the tier, the week, the seat and the purse all
 * arrive as props, exactly as they do on the desk.
 */
import type { ReactNode } from 'react'
import FederalHeader, { type DeskLevel } from './FederalHeader'
import BottomNav, { type BottomTab } from './BottomNav'
import './screens.css'

export interface FolderShellProps {
  /** which folder tab this screen answers to — 'files' and 'treasury' answer to the desk */
  tab: BottomTab
  /** small line above the folder's name, e.g. "FOLDER · THE PRESS" */
  kicker: string
  /** the folder's name, printed in the serif */
  title: string
  /** one line on what this folder holds */
  sub: string
  level?: DeskLevel
  week?: number
  capital?: string
  budget?: number
  onTabChange: (tab: BottomTab) => void
  /** a sub-folder of the desk (the cabinet, the treasury) carries a way back */
  onBack?: () => void
  /** the label on the back control, e.g. "BACK TO THE DESK" */
  backLabel?: string
  /** open the treasury ledger from the purse in the folders bar */
  onOpenTreasury?: () => void
  /** the folders bar is optional — a sub-folder keeps the desk's own bar */
  showNav?: boolean
  /** trailing element on the folder bar, e.g. a count */
  aside?: ReactNode
  children: ReactNode
}

export function FolderShell({
  tab, kicker, title, sub,
  level = 'state', week = 41, capital = 'Abuja', budget = 0,
  onTabChange, onBack, backLabel = 'BACK TO THE DESK', onOpenTreasury,
  showNav = true, aside, children,
}: FolderShellProps) {
  return (
    <div className="dv2 dv2-folder">
      <FederalHeader level={level} week={week} capital={capital} />

      <div className="dv2-folder-bar">
        <div className="dv2-folder-top">
          {onBack && (
            <button type="button" className="dv2-back" onClick={onBack}>
              ← {backLabel}
            </button>
          )}
          <div className="dv2-folder-id">
            <span className="dv2-folder-kicker">{kicker}</span>
            <h1 className="dv2-folder-title">{title}</h1>
          </div>
          {aside}
        </div>
        <span className="dv2-folder-rule" aria-hidden />
        <p className="dv2-folder-sub">{sub}</p>
      </div>

      <div className="dv2-body">{children}</div>

      {showNav && (
        <BottomNav
          activeTab={tab}
          budget={budget}
          week={week}
          onTabChange={onTabChange}
          onOpenTreasury={onOpenTreasury}
        />
      )}
    </div>
  )
}

export default FolderShell
