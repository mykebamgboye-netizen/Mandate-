/* @mandate/PatronsPanel — full patrons panel
   Shows complete list of patrons with loyalty bars, last favor, quarterly due.
   Uses same data as PatronageStrip but in a full list format.
*/
import type { SimSnapshot, DeskIdentity } from './desk-sim'

interface PatronPatron {
  id: string
  name: string
  role: string
  loyalty: number // 1-5
  lastFavor: string | null
  ROI_due_weeks: number
}

interface PatronsPanelProps {
  sim?: SimSnapshot
  patronageBank?: number
  identity: DeskIdentity | undefined
}

const patronageNames: Record<string, string> = {
  agoro: 'Hon. Felix Agoro',
  danjuma: 'Alhaji Bala Danjuma',
  owhonda: 'Elder Tom Owhonda',
}

export function PatronsPanel({ identity, patronageBank }: PatronsPanelProps) {
  const bank = patronageBank ?? 0
  const patrons: PatronPatron[] = (identity?.patrons ?? []).map((p: any) => ({
    id: p.id,
    name: patronageNames[p.id] ?? p.name ?? 'Unknown',
    role: p.role ?? 'Patron',
    loyalty: Math.min(5, Math.max(0, p.loyalty ?? 0)),
    lastFavor: p.lastFavor ?? null,
    ROI_due_weeks: p.ROI_due_weeks ?? 0,
  }))

  const quarterlyDue = Math.round((bank ?? 0) / 13 / 1000000) * 1000000

  return (
    <div className="patrons-panel" role="region" aria-label="Patrons panel">
      <div className="patrons-header">
        <span>Patronage Bank: ₦{bank.toLocaleString('en-NG')}</span>
        <span>Quarterly due: ₦{quarterlyDue.toLocaleString('en-NG')}</span>
      </div>

      <div className="patrons-list">
        {patrons.map((p) => (
          <div
            key={p.id}
            className="patron-bar"
            style={{ marginBottom: p === patrons[patrons.length - 1] ? '0' : '8px' }}
          >
            <span className="patron-bar-name">{p.name} ({p.role})</span>
            <div className="patron-bar-loyalty">
              <div
                className="filled"
                style={{ width: `${p.loyalty * 20}%` }}
              ></div>
            </div>
            <span className="patron-bar-loyalty-label">
              {p.loyalty}/5 loyalty
            </span>
          </div>
        ))}
      </div>

      {patrons.length > 0 && (
        <div className="patrons-footer">
          <span>Quarterly obligation: ₦{quarterlyDue.toLocaleString('en-NG')}</span>
          <span>Per patron: due in {(bank ?? 1) > 0 ? Math.ceil((quarterlyDue ?? 0) / (bank ?? 1) * 13) : '—'} weeks</span>
        </div>
      )}
    </div>
  )
}