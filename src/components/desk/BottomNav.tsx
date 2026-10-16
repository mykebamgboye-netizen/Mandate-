/* @mandate/components/desk/BottomNav — the fixed desk bar.
   Four folders, a large treasury pill in the centre and the week counter on the
   right. The pill is the one number the player should never have to hunt for. */

export type BottomTab = 'desk' | 'patrons' | 'press' | 'ops'

export interface BottomNavProps {
  activeTab: BottomTab
  /** naira in hand — printed as ₦m / ₦bn */
  budget: number
  week: number
  onTabChange: (tab: BottomTab) => void
}

export const NAV_ITEMS: { id: BottomTab; label: string }[] = [
  { id: 'desk', label: 'DESK' },
  { id: 'patrons', label: 'PATRONS' },
  { id: 'press', label: 'PRESS' },
  { id: 'ops', label: 'OPS' },
]

/** 8_275_860_000 → "₦8.28bn"; 500_000_000 → "₦500m" */
export function formatBudget(naira: number): string {
  const n = Number.isFinite(naira) ? naira : 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}₦${(abs / 1_000_000_000).toFixed(2)}bn`
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}m`
  if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(0)}k`
  return `${sign}₦${abs.toFixed(0)}`
}

function TabButton({ id, label, active, onTabChange }: {
  id: BottomTab; label: string; active: boolean; onTabChange: (t: BottomTab) => void
}) {
  return (
    <button
      type="button"
      className={`dv2-nav-tab${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => onTabChange(id)}
    >
      {label}
    </button>
  )
}

export function BottomNav({ activeTab, budget, week, onTabChange }: BottomNavProps) {
  const left = NAV_ITEMS.slice(0, 2)
  const right = NAV_ITEMS.slice(2)
  return (
    <nav className="dv2-nav" aria-label="Desk folders">
      <div className="dv2-nav-side">
        {left.map(t => (
          <TabButton key={t.id} id={t.id} label={t.label} active={activeTab === t.id} onTabChange={onTabChange} />
        ))}
      </div>

      <div className="dv2-nav-budget" aria-label={`Treasury: ${formatBudget(budget)}`}>
        <span className="dv2-nav-budget-sym" aria-hidden>₦</span>
        <span className="dv2-nav-budget-value">{formatBudget(budget).replace('₦', '')}</span>
        <span className="dv2-nav-budget-cap">TREASURY</span>
      </div>

      <div className="dv2-nav-side right">
        {right.map(t => (
          <TabButton key={t.id} id={t.id} label={t.label} active={activeTab === t.id} onTabChange={onTabChange} />
        ))}
        <span className="dv2-nav-week">Week {week}</span>
      </div>
    </nav>
  )
}

export default BottomNav
