/* @mandate/components/desk/PatronRow — who is owed what, at a glance.
   A horizontal scroll of patron chips: face, name, role, loyalty dots and the
   status badge. Border tone reads loyalty — green loyal, amber wavering, red
   angry — and a due-soon patron is flagged in weeks, never in prose.
   If the desk has no patron data yet, three demo patrons render so the row is
   never an empty strip. */

export interface Patron {
  id?: string
  name: string
  role: string
  /** 1–5 filled dots */
  loyalty: number
  /** weeks until this patron's return is due; 0 or less means due now */
  ROI_due_weeks?: number
}

export interface PatronRowProps {
  patrons: Patron[]
}

export type PatronTone = 'loyal' | 'wavering' | 'angry'

/** The three demo patrons used when a desk has no data of its own. */
export const DEMO_PATRONS: Patron[] = [
  { id: 'demo-okafor', name: 'Dr. Okafor', role: 'Chief of Staff', loyalty: 4, ROI_due_weeks: 3 },
  { id: 'demo-bello', name: "Hajia Bello", role: "Women's Leader", loyalty: 3, ROI_due_weeks: 2 },
  { id: 'demo-adeyemi', name: 'Chief Adeyemi', role: 'Party Chairman', loyalty: 1, ROI_due_weeks: 0 },
]

export function patronTone(loyalty: number): PatronTone {
  const l = Math.max(0, Math.min(5, loyalty))
  if (l >= 4) return 'loyal'
  if (l >= 2) return 'wavering'
  return 'angry'
}

export function patronStatusLabel(patron: Patron): string {
  const due = patron.ROI_due_weeks
  if (typeof due === 'number' && due <= 0) return 'Due now'
  if (typeof due === 'number' && due === 1) return 'Due in 1 week'
  if (typeof due === 'number' && due <= 2) return `Due in ${due} weeks`
  const tone = patronTone(patron.loyalty)
  return tone === 'loyal' ? 'Loyal' : tone === 'wavering' ? 'Wavering' : 'Angry'
}

function initials(name: string): string {
  const parts = name.replace(/^(Dr\.|Hajia|Chief|Hon\.|Alhaji|Elder|Mr\.|Mrs\.|Ms\.)\s+/i, '').split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

export function PatronRow({ patrons }: PatronRowProps) {
  const list = patrons.length > 0 ? patrons : DEMO_PATRONS
  const demo = patrons.length === 0

  return (
    <section className="dv2-patrons" aria-label="Patrons">
      <div className="dv2-patrons-head">
        <span className="dv2-patrons-title">PATRONS</span>
        <span className="dv2-patrons-hint">{demo ? 'demo roster — no patron data on file' : 'loyalty · what is due'}</span>
      </div>

      <div className="dv2-patron-scroll">
        {list.map((p, i) => {
          const tone = patronTone(p.loyalty)
          const dots = Math.max(0, Math.min(5, Math.round(p.loyalty)))
          const status = patronStatusLabel(p)
          const dueSoon = typeof p.ROI_due_weeks === 'number' && p.ROI_due_weeks <= 2
          return (
            <article key={p.id ?? `${p.name}-${i}`} className="dv2-patron" data-tone={tone}>
              <span className="dv2-patron-face" aria-hidden>{initials(p.name)}</span>
              <span className="dv2-patron-name">{p.name}</span>
              <span className="dv2-patron-role">{p.role}</span>
              <span className="dv2-patron-dots" aria-label={`Loyalty ${dots} of 5`}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} className={`dv2-dot${n <= dots ? ' filled' : ''}`} aria-hidden />
                ))}
              </span>
              <span className={`dv2-patron-badge${dueSoon ? ' due' : ''}`}>{status}</span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default PatronRow
