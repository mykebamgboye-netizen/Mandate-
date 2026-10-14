/* Document templates — every screen is a physical object (Section 12.1).
   Each renders the body of one content record; clips, stains and stamps
   are layered by DocumentView. */
import { Fragment, useState } from 'react'
import type { Doc } from './content'
import { useGame } from './game-context'
import type { DocMarkState } from './DocumentView'

/* rough hand-drawn Nigeria doodle, marked at the seat the player actually holds */
function NigeriaDoodle() {
  const { scenario } = useGame()
  const label = scenario.stateName ?? 'Nigeria'
  return (
    <svg width="210" height="150" viewBox="0 0 240 200" aria-label={`hand-drawn sketch of Nigeria, ${label} marked`} style={{ overflow: 'visible' }}>
      <path
        d="M30,62 C34,78 38,95 42,118 C44,136 48,152 58,164 C72,176 86,182 104,184
           C122,187 136,190 150,182 C164,175 178,172 192,166 C199,156 200,144 198,130
           C204,120 212,110 214,96 C216,84 208,74 200,66 C196,54 188,44 176,38
           C164,32 152,40 140,42 C126,36 112,32 98,36 C82,32 66,36 52,44 C44,50 36,54 30,62 Z"
        fill="none" stroke="#2B3A67" strokeWidth="2.4" strokeLinejoin="round"
      />
      <circle cx="112" cy="168" r="7" fill="none" stroke="#2B3A67" strokeWidth="2.4" />
      <path d="M116,172 q6,6 4,13 M110,175 q-2,7 2,11 M120,176 q4,5 3,10" fill="none" stroke="#2B3A67" strokeWidth="1.6" />
      <path d="M130,170 l40,-4" stroke="#2B3A67" strokeWidth="2.2" fill="none" />
      <path d="M166,162 l10,4 -10,5" fill="none" stroke="#2B3A67" strokeWidth="2.2" strokeLinejoin="round" />
      <text x="138" y="160" fontFamily="Caveat, cursive" fontSize="24" fill="#2B3A67">{label}</text>
    </svg>
  )
}

function MinutesT({ doc }: { doc: Extract<Doc, { kind: 'minutes' }> }) {
  return (
    <>
      <div className="red-margin-note">acted on<br />— before<br />sitting</div>
      <div className="min-head">{doc.head.map((l, i) => <div key={i}>{l}</div>)}</div>
      <ol className="min-items">
        {doc.items.map(it => (
          <li key={it.n}><span className="n">{it.n}.</span>{it.text}</li>
        ))}
      </ol>
      {doc.sketch && <div className="min-sketch"><NigeriaDoodle /></div>}
    </>
  )
}

function GazetteT({ doc }: { doc: Extract<Doc, { kind: 'gazette' }> }) {
  return (
    <>
      <div className="gaz-note">{doc.note}</div>
      <div className="gaz-fed">{doc.fedHead}</div>
      <div className="gaz-line">{doc.gazetteLine}</div>
      <div className="gaz-date">{doc.memoDate}</div>
      <div className="gaz-row">{doc.memorandum}</div>
      <div className="gaz-row"><b>Appropriation:</b><span className="gaz-amount">{doc.appropriation.replace('Appropriation: ', '')}</span></div>
      <div className="gaz-row">{doc.authorityPara}</div>
      <div className="gaz-row">{doc.faacLine}</div>
    </>
  )
}

function FaacT({ doc }: { doc: Extract<Doc, { kind: 'faac' }> }) {
  return (
    <>
      <div className="doc-h2">{doc.docHead}</div>
      <hr className="doc-rule" />
      {doc.lines.map((ln, i) => (
        <div key={i} className={`led-row${ln.indent ? ' indent' : ''}${ln.strong ? ' strong' : ''}`}>
          <span>{ln.label}</span><span className="v">{ln.value}</span>
        </div>
      ))}
      <p className="doc-small" style={{ marginTop: 14 }}>{doc.foot}</p>
    </>
  )
}

function WhipT({ doc }: { doc: Extract<Doc, { kind: 'whip' }> }) {
  return (
    <>
      <div className="doc-h2">{doc.docHead}</div>
      <hr className="doc-rule dashed" />
      <div className="whip-counts">
        {doc.counts.map(c => (
          <Fragment key={c.label}>
            <span className="lab">{c.label}</span><span>{c.value}</span>
          </Fragment>
        ))}
      </div>
      <hr className="doc-rule" />
      <ul className="whip-bullets" style={{ margin: 0 }}>
        {doc.bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      <p className="doc-small" style={{ marginTop: 14 }}>{doc.foot}</p>
    </>
  )
}

function TableT({ doc }: { doc: Extract<Doc, { kind: 'table' }> }) {
  return (
    <>
      <div className="tbl-title">{doc.docHead}</div>
      <hr className="tbl-title-underline" />
      <div className="tbl-sub">{doc.subHead}</div>
      <table className="sheet-table">
        <thead>
          <tr>{doc.columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {doc.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>
                  {ri === doc.checkRow && ci === 0 && <span className="red-check">✓</span>}
                  {ri === doc.checkRow && ci === doc.circleCol ? <span style={{ position: 'relative', display: 'inline-block' }}>{cell}<span className="red-circle" /></span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="red-note-hand">{doc.redNote}</div>
    </>
  )
}

function SecurityT({ doc }: { doc: Extract<Doc, { kind: 'security' }> }) {
  return (
    <>
      <div style={{ textAlign: 'center' }}><span className="sec-class">RESTRICTED</span></div>
      <div className="doc-h2">{doc.docHead}</div>
      <hr className="doc-rule" />
      {doc.items.map((it, i) => (
        <div className="sec-item" key={i}>
          <span className="sec-head">{it.head}</span>
          <p className="sec-body">{it.body}</p>
        </div>
      ))}
      <hr className="doc-rule" />
      <p className="doc-small">{doc.foot}</p>
    </>
  )
}

function LetterT({ doc }: { doc: Extract<Doc, { kind: 'letter' }> }) {
  const { scenario } = useGame()
  return (
    <>
      <div className="let-head">
        {doc.letterhead}
        <span className="sub">SECRETARIAT · {scenario.seat.toUpperCase()} · {scenario.jurisdictionShort}</span>
      </div>
      <div className="let-to">{doc.dateLine}<br />{doc.to}</div>
      <div className="let-sub">{doc.subject}</div>
      {doc.paras.map((p, i) => <p className="doc-p" key={i} style={{ textAlign: 'justify' }}>{p}</p>)}
      <div className="let-sign">
        Yours for the movement,
        <span className="name">{doc.signName}</span>
        {doc.signTitle}
      </div>
    </>
  )
}

function DossierT({ doc }: { doc: Extract<Doc, { kind: 'dossier' }> }) {
  return (
    <>
      <div className="dos-subject">{doc.subject}</div>
      {doc.lines.map((ln, i) => (
        <div className="dos-line" key={i}>
          <span className="lab">{ln.label}</span>
          <span className={ln.pencil ? 'pencil' : ''}>{ln.value}</span>
        </div>
      ))}
      <div style={{ marginTop: 18 }}>
        {doc.whispers.map((w, i) => <div className="whisper" key={i}>— {w}</div>)}
      </div>
      <div className="margin-hand">{doc.margin}</div>
    </>
  )
}

type AssetRange = Extract<Doc, { kind: 'asset' }>['ranges'][number]

/* §5.3/§16.1: a pencilled range must be interrogable — tap → source,
   confidence, width, staleness. Otherwise hidden info feels unfair. */
function RangeRow({ r, lastTouched }: { r: AssetRange; lastTouched: string }) {
  const [open, setOpen] = useState(false)
  const conf = /\blow\b/.test(r.src) ? 'low'
    : /\bhigh\b/.test(r.src) ? 'high'
    : /\bmedium\b/.test(r.src) ? 'medium'
    : 'medium — unverified'
  const width = Math.round((r.hi - r.lo) / 2)
  return (
    <>
      <button
        className={`range-row${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${r.label}: ${r.lo} to ${r.hi}, show source`}
      >
        <span className="rname">{r.label}</span>
        <span className="rval">{r.lo}–{r.hi}</span>
        <span className="rsrc">({r.src})</span>
        <span className="r-eye">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="range-sheet">
          <div>SOURCE — {r.src}</div>
          <div>CONFIDENCE — {conf} · WIDTH ±{width} POINTS</div>
          <div>LAST TOUCHED — {lastTouched} · DECAYS WITHOUT REFRESH</div>
          <div className="range-warn">pencil, not print — treat as an estimate</div>
        </div>
      )}
    </>
  )
}

function AssetT({ doc }: { doc: Extract<Doc, { kind: 'asset' }> }) {
  const lastTouched = (() => {
    const line = doc.audit.find(l => /refreshed/i.test(l))
    return line ? line.replace(/^.*refreshed\s*/i, '').trim() : 'not yet refreshed'
  })()
  return (
    <>
      <div className="doc-h2">{doc.formHead}</div>
      <hr className="doc-rule" />
      {doc.fields.map((f, i) => (
        <div className="form-field" key={i}>
          <span className="flab">{f.label}</span><span>{f.value}</span>
        </div>
      ))}
      <div className="doc-h2" style={{ marginTop: 22, textAlign: 'left' }}>
        ESTIMATES — PENCILLED, SOURCED, DECAYING
      </div>
      <hr className="doc-rule dashed" />
      {doc.ranges.map((r, i) => (
        <RangeRow key={i} r={r} lastTouched={lastTouched} />
      ))}
      <div className="margin-hand">{doc.margin}</div>
    </>
  )
}

function TribunalT({ doc }: { doc: Extract<Doc, { kind: 'tribunal' }> }) {
  return (
    <>
      <div className="tri-stamp">{doc.stampText}</div>
      <div className="doc-h2" style={{ marginTop: 4, textAlign: 'left', maxWidth: '70%' }}>{doc.docHead}</div>
      <div className="doc-h2" style={{ textAlign: 'left' }}>{doc.caseNo}</div>
      <hr className="doc-rule" />
      <div className="tri-parties">
        {doc.parties.map(p => (
          <div className="tri-party" key={p.role}>
            <span className="role">{p.role}</span><span>{p.name}</span>
          </div>
        ))}
      </div>
      <div className="doc-h2" style={{ textAlign: 'left', marginTop: 16 }}>GROUNDS</div>
      <ol className="tri-gounds" style={{ paddingLeft: 20, margin: 0 }}>
        {doc.grounds.map((g, i) => <li key={i}>{g}</li>)}
      </ol>
      <p className="doc-p">{doc.relief}</p>
      <div className="tri-listing">{doc.listing}</div>
    </>
  )
}

function ClippingT({ doc }: { doc: Extract<Doc, { kind: 'clipping' }> }) {
  return (
    <>
      <div className="clp-outlet">{doc.outlet}</div>
      <div className="clp-kicker">{doc.kicker}</div>
      <h1 className="clp-head">{doc.headline}</h1>
      <div className="clp-byline">{doc.byline}</div>
      {doc.paras.map((p, i) => <p className="clp-body" key={i}>{p}</p>)}
      <div className="clp-briefs">{doc.briefs.map((b, i) => <div key={i}>{b}</div>)}</div>
    </>
  )
}

function LeafletT({ doc }: { doc: Extract<Doc, { kind: 'leaflet' }> }) {
  return (
    <div className="torn-bottom" style={{ ['--leafA' as string]: doc.colorA, ['--leafB' as string]: doc.colorB }}>
      <div className="leaf-band">{doc.party} · {doc.colorB ? '' : ''}PRESENTS</div>
      <div className="leaf-title">{doc.event}</div>
      <hr className="doc-rule dashed" style={{ width: '60%', margin: '6px auto' }} />
      <div className="leaf-when">{doc.when}<br />{doc.where}</div>
      <div className="leaf-lines">
        {doc.lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div className="leaf-smear">{doc.smear}</div>
    </div>
  )
}

function NoteT({ doc }: { doc: Extract<Doc, { kind: 'note' }> }) {
  return (
    <>
      <div className="note-head">{doc.re} — {doc.from}</div>
      <hr className="doc-rule dashed" />
      <ul className="note-lines">
        {doc.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </>
  )
}

/* ---------- Sector brief: native register, tap-to-gloss, chain of hands ---------- */
function GlossLine({ line, glossary, revealed, onTap }: {
  line: string
  glossary: Extract<Doc, { kind: 'sector' }>['glossary']
  revealed: string[]
  onTap: (term: string) => void
}) {
  const { settings, askAide, literacy } = useGame()
  const [asking, setAsking] = useState<string | null>(null)
  const parts = line.split(/(\[\[[^\]]+\]\])/g)
  const notes: string[] = []
  const handleTap = (term: string) => {
    if (revealed.includes(term)) return
    if (settings.learnerMode) { onTap(term); return }
    setAsking(asking === term ? null : term)
  }
  return (
    <p className="sec-line">
      {parts.map((part, i) => {
        const m = part.match(/^\[\[([^\]]+)\]\]$/)
        if (!m) return <Fragment key={i}>{part}</Fragment>
        const term = m[1]
        const known = revealed.includes(term)
        if (known && glossary[term]) notes.push(term)
        return (
          <button
            key={i}
            className={`gloss-term${known ? ' glossed' : ''}`}
            onClick={() => handleTap(term)}
            aria-label={known ? `${term} — gloss shown` : `jargon term ${term} — tap to understand`}
          >
            {term}
          </button>
        )
      })}
      {notes.length > 0 && (
        <span className="gloss-notes">
          {notes.map(t => (
            <span key={t} className="gloss-note">
              <b>{t}</b> — {glossary[t].gloss}
              <i> (misread as: {glossary[t].misread})</i>
              {glossary[t].fine && (settings.learnerMode || literacy >= 3) && (
                <u> fine print: {glossary[t].fine}</u>
              )}
            </span>
          ))}
        </span>
      )}
      {asking && glossary[asking] && (
        <span className="aide-bar">
          SECTOR SPEAK — ASK THE AIDE? (¼ DESK HOUR)
          <button onClick={() => { askAide(); onTap(asking); setAsking(null) }}>ASK</button>
          <button onClick={() => setAsking(null)}>SKIP</button>
        </span>
      )}
    </p>
  )
}

function SectorT({ doc }: { doc: Extract<Doc, { kind: 'sector' }> }) {
  const { settings, literacy, setLiteracy } = useGame()
  const [revealed, setRevealed] = useState<string[]>([])
  const [desk, setDesk] = useState('gov')
  const active = doc.desks.find(d => d.id === desk) ?? doc.desks[0]
  const hidden = doc.chain.filter(c => c.minLiteracy > literacy).length
  return (
    <>
      <div className="doc-h2" style={{ textAlign: 'left' }}>{doc.docHead}</div>
      <div className="doc-small" style={{ margin: '4px 0 12px' }}>{doc.event}</div>

      <div className="desk-switch" role="tablist" aria-label="Which desk reads this event">
        {doc.desks.map(d => (
          <button
            key={d.id} role="tab" aria-selected={d.id === desk}
            className={`desk-tab${d.id === desk ? ' on' : ''}`}
            onClick={() => setDesk(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="desk-sub">{active.sub}</div>

      {active.lines.map((ln, i) => (
        <GlossLine key={`${active.id}-${i}`} line={ln} glossary={doc.glossary}
          revealed={revealed} onTap={t => setRevealed(r => (r.includes(t) ? r : [...r, t]))} />
      ))}

      <hr className="doc-rule dashed" />
      <div className="lit-row">
        <span className="lit-label">SECTOR LITERACY</span>
        <input
          type="range" min={0} max={5} step={1} value={literacy}
          onChange={e => setLiteracy(Number(e.target.value))}
          aria-label="Sector literacy, zero to five"
        />
        <span className="lit-value">{literacy} / 5</span>
      </div>
      <div className="doc-small">
        MODE — NATIVE, MAX DENSITY (§53.1){settings.learnerMode ? ' · LEARNER MODE: GLOSSES FREE' : ''}
      </div>

      <div className="chain">
        <div className="chain-head">THE CHAIN OF HANDS — how this reached you</div>
        {doc.chain.map((c, i) => {
          const seen = c.minLiteracy <= literacy
          return (
            <div className={`chain-step${seen ? '' : ' redacted'}`} key={i}>
              <span className="chain-lag">{c.lag}</span>
              <span className="chain-body">
                {seen ? c.step : '▓▓▓▓▓ step not visible to you ▓▓▓▓▓'}
                {seen && <em>{c.detail}</em>}
              </span>
            </div>
          )
        })}
        {hidden > 0 && (
          <div className="chain-hidden">
            {hidden} upstream step{hidden === 1 ? '' : 's'} redacted — raise literacy, or cut the chain yourself (site visit, second source).
          </div>
        )}
      </div>
    </>
  )
}

/* ---------- Spot the Tell (§36.5) ---------- */
function TellT({ doc, mark, onMark }: {
  doc: Extract<Doc, { kind: 'tell' }>
  mark?: DocMarkState
  onMark?: (m: DocMarkState) => void
}) {
  const marks = mark?.tellMarks ?? []
  const result = mark?.tellResult
  const toggle = (id: string) => {
    if (result || !onMark || !mark) return
    const next = marks.includes(id) ? marks.filter(x => x !== id) : [...marks, id]
    onMark({ ...mark, tellMarks: next })
  }
  return (
    <>
      <div className="doc-h2" style={{ textAlign: 'left' }}>{doc.docHead}</div>
      <div className="tell-brief">{doc.brief}</div>
      {doc.files.map(f => (
        <div className="tell-file" key={f.name}>
          <div className="tell-name">{f.name}</div>
          {f.lines.map(l => {
            const marked = marks.includes(l.id)
            const revealed = result && l.tell
            return (
              <button
                key={l.id}
                className={`tell-line${marked ? ' marked' : ''}${revealed ? ' found' : ''}`}
                onClick={() => toggle(l.id)}
                disabled={Boolean(result)}
                aria-pressed={marked}
                aria-label={`mark line: ${l.text}`}
              >
                <span className="tl-text">{l.text}</span>
                {revealed && <span className="tl-tell">TELL</span>}
              </button>
            )
          })}
        </div>
      ))}
      {result === 'hit' && <div className="tell-outcome hit">{doc.hitNote}</div>}
      {result === 'miss' && <div className="tell-outcome miss">{doc.missNote}</div>}
    </>
  )
}

export function DocBody({ doc, mark, onMark }: {
  doc: Doc
  mark?: DocMarkState
  onMark?: (m: DocMarkState) => void
}) {
  switch (doc.kind) {
    case 'minutes': return <MinutesT doc={doc} />
    case 'gazette': return <GazetteT doc={doc} />
    case 'faac': return <FaacT doc={doc} />
    case 'whip': return <WhipT doc={doc} />
    case 'table': return <TableT doc={doc} />
    case 'security': return <SecurityT doc={doc} />
    case 'letter': return <LetterT doc={doc} />
    case 'dossier': return <DossierT doc={doc} />
    case 'asset': return <AssetT doc={doc} />
    case 'tribunal': return <TribunalT doc={doc} />
    case 'clipping': return <ClippingT doc={doc} />
    case 'leaflet': return <LeafletT doc={doc} />
    case 'note': return <NoteT doc={doc} />
    case 'sector': return <SectorT doc={doc} />
    case 'tell': return <TellT doc={doc} mark={mark} onMark={onMark} />
  }
  const neverDoc: never = doc
  return neverDoc
}
