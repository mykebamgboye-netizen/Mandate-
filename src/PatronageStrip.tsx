/* @mandate/PatronageStrip — patronage timeline under desk-head
   Shows patronage bank, patron loyalty bars, quarterly due, and FAAC/inflation readout.
   Renders directly under desk-head in DeskScreen.
*/
import type { SimSnapshot, DeskIdentity } from './desk-sim'

interface PatronageStripProps {
  sim?: SimSnapshot
  patronageBank?: number
  identity: DeskIdentity | undefined
}

const patronageNames: Record<string, string> = {
  agoro: 'Hon. Felix Agoro',
  danjuma: 'Alhaji Bala Danjuma',
  owhonda: 'Elder Tom Owhonda',
}

/** Calculate quarterly due per patron: bank / 13 weeks per quarter */
function calculateQuarterlyDue(bank: number): number {
  return Math.round((bank ?? 0) / 13 / 1000000) * 1000000 // round to millions
}

export function PatronageStrip({ sim, identity, patronageBank }: PatronageStripProps) {
  const bank = patronageBank ?? 0
  const quarterlyDue = calculateQuarterlyDue(bank)

  const patrons = identity?.patrons ?? []

  return (
    <div className="patron-strip" role="region" aria-label="Patronage timeline">
      {/* FAAC & Inflation readout */}
      <div className="faac-inflation">
        <span>FAAC: +₦{sim?.state?.money?.faacCurrent ?? 0} · Inflation: {(sim?.state?.money?.inflation ?? 0).toFixed(1)}%</span>
      </div>

      {/* Patrons scroll area */}
      <div className="patron-list">
        {patrons.map((p, _i) => {
          const name = patronageNames[p.id] ?? p.name
          const loyalty = Math.min(5, Math.max(0, p.loyalty ?? 0))
          const isAmber = p.ROI_due_weeks <= 2
          const dueWeeks = Math.max(0, Math.ceil((quarterlyDue ?? 0) / (bank ?? 1) * 13)) || '—'

          return (
            <div
              key={p.id}
              className="patron-item"
              style={{ flex: '0 0 auto' }}
            >
              <div className="patron-avatar">
                {name.charAt(0)}{name.split(' ')[1]?.charAt(0) || ''}
              </div>
              <div className="patron-name">{name}</div>
              <div className="patron-dots">
                {[0, 1, 2, 3, 4].map(j => (
                  <span
                    key={j}
                    className={`patron-dot${j < loyalty ? ' filled' : ''}`}
                  />
                ))}
              </div>
              <div
                className={`patron-due${isAmber ? ' amber' : ''}`}
              >
                due in {dueWeeks} weeks
              </div>
            </div>
          )
        })}

        {/* Empty slots for horizontal scroll when fewer patrons */}
        {patrons.length < 2 && (
          <div
            key="empty"
            className="patron-item"
            style={{ width: 120, opacity: 0.3 }}
          />
        )}
      </div>
    </div>
  )
}