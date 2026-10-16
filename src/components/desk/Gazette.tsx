/* @mandate/components/desk/Gazette — the press clipping on the desk.
   Aged paper, a serif masthead, one story. Tap it and the clipping opens as a
   full article; close it and the desk is back. MOCK_GAZETTE is the stand-in
   used when the simulation has not printed a story for this week yet. */
import { useEffect, useState } from 'react'

export interface GazetteContent {
  headline: string
  date: string
  body: string
}

export interface GazetteProps extends GazetteContent {
  /** paper the story sits on — 'THE GAZETTE' by default */
  masthead?: string
  /** page/desk footer line */
  folio?: string
}

export const MOCK_GAZETTE: GazetteContent = {
  headline: "FAAC Revision Sparks Governors' Pushback",
  date: 'THURSDAY 8 OCTOBER 2026',
  body:
    'State finance commissioners met behind closed doors in Abuja yesterday after the Federation Account '
    + 'Allocation Committee released a revised distribution formula that trims the net share due to the '
    + 'states from November.\n\n'
    + 'Governors from the North-Central and South-South have demanded a fresh reconciliation, arguing the '
    + 'trim lands hardest on states already carrying arrears of salaries. The Committee insists the revision '
    + 'only closes a shortfall in the refund account, and that no state loses money it had already been paid.',
}

export function Gazette({
  headline, date, body, masthead = 'THE GAZETTE', folio = 'Page 3 · Politics',
}: GazetteProps) {
  const [open, setOpen] = useState(false)

  /* Escape closes the article — the desk should never trap a hand. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

  return (
    <>
      <article className="dv2-gazette" aria-label="Press clipping">
        <button type="button" className="dv2-gazette-open" onClick={() => setOpen(true)}>
          <span className="dv2-gazette-masthead">{masthead}</span>
          <span className="dv2-gazette-rule" aria-hidden />
          <span className="dv2-gazette-date">{date}</span>
          <span className="dv2-gazette-headline">{headline}</span>
          <span className="dv2-gazette-lede">{paragraphs[0]}</span>
          <span className="dv2-gazette-more">Read the full story →</span>
        </button>
        <span className="dv2-gazette-folio">{folio}</span>
      </article>

      {open && (
        <div
          className="dv2-reader"
          role="dialog"
          aria-modal="true"
          aria-label={headline}
          onClick={() => setOpen(false)}
        >
          <article className="dv2-reader-sheet" onClick={e => e.stopPropagation()}>
            <div className="dv2-reader-head">
              <span className="dv2-gazette-masthead">{masthead}</span>
              <span className="dv2-gazette-date">{date}</span>
            </div>
            <h3 className="dv2-reader-headline">{headline}</h3>
            {paragraphs.map((p, i) => (
              <p key={i} className="dv2-reader-para">{p}</p>
            ))}
            <div className="dv2-reader-foot">
              <span>{folio}</span>
              <button type="button" className="dv2-reader-close" onClick={() => setOpen(false)}>
                Close the paper
              </button>
            </div>
          </article>
        </div>
      )}
    </>
  )
}

export default Gazette
