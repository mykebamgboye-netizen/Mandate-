/* One open document: recto (the paper), verso (authority + audit),
   the stamp, the red pen, and the signature. */
import { useEffect, useRef, useState } from 'react'
import type { Doc } from './content'
import { DocBody } from './templates'
import { useGame } from './game-context'
import { StampButton, drawSplatter, type AppliedStamp } from './Stamp'
import { IcBack, IcInfo, IcShare, IcFlip, IcPen, IcCheck, IcDecisions, IcFiles } from './icons'

export type Signature =
  | { mode: 'draw'; strokes: Pt[][] }
  | { mode: 'typed'; text: string }
export interface Pt { x: number; y: number }
export interface DocMarkState {
  stamps: AppliedStamp[]
  annotations: string[]
  signed?: Signature
  tellMarks?: string[]
  tellResult?: 'hit' | 'miss'
}

interface Props {
  doc: Doc
  mark: DocMarkState
  onBack: () => void
  onMark: (m: DocMarkState) => void
  onToast: (msg: string) => void
  pendingDecision?: boolean
  onGoDecide?: () => void
  onFileAway?: () => void
  /** stains only appear once the file has been open long enough to think over */
  weathered?: boolean
}

const RED = '#B3261E'
const BLUE = '#2B3A67'

interface Landing { label: string; color: string; xPct: number; yPct: number; rot: number }

/** Where a stamp will land — computed at PRESS time so the ghost and the
    final stamp are the same spot (§2.5: show what a stamp will do first). */
function landingFor(label: string, color: string): Landing {
  const xPct = label === 'APPROVED' ? 48 + Math.random() * 8 : 30 + Math.random() * 8
  const yPct = label === 'APPROVED' ? 58 + Math.random() * 6 : 26 + Math.random() * 6
  const rot = label === 'APPROVED' ? -7 + Math.random() * 14 : -16 + Math.random() * 10
  return {
    label, color,
    xPct: Math.round(xPct * 10) / 10,
    yPct: Math.round(yPct * 10) / 10,
    rot: Math.round(rot * 10) / 10,
  }
}

const GHOST_LEDGER: Record<string, string> = {
  APPROVED: 'writes: evidence ledger · public goods · Halcyon Marine paid',
  DECLINED: 'writes: promise broken to the contractor · Works lobby angry',
}

/* ---------- signature pad (stroke vector, % coordinates) ---------- */
function SigPad({ onDone }: { onDone: (s: Signature) => void }) {
  const [strokes, setStrokes] = useState<Pt[][]>([])
  const [mode, setMode] = useState<'draw' | 'typed'>('draw')
  const [typed, setTyped] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)

  const ptAt = (e: React.PointerEvent): Pt => {
    const r = ref.current!.getBoundingClientRect()
    return {
      x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
    }
  }
  const down = (e: React.PointerEvent) => {
    drawing.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setStrokes(s => [...s, [ptAt(e)]])
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = ptAt(e)
    setStrokes(s => {
      const next = s.slice()
      const last = next[next.length - 1]
      const prev = last[last.length - 1]
      if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) < 0.6) return s
      next[next.length - 1] = [...last, p]
      return next
    })
  }
  const up = () => {
    drawing.current = false
    setStrokes(s => {
      if (s.length && s[s.length - 1].length < 2) return s.slice(0, -1)
      return s
    })
  }
  useEffect(() => {
    if (mode === 'draw' && strokes.length >= 2) {
      const t = setTimeout(() => onDone({ mode: 'draw', strokes }), 700)
      return () => clearTimeout(t)
    }
    if (mode === 'typed' && typed.trim().length > 1) {
      const t = setTimeout(() => onDone({ mode: 'typed', text: typed.trim() }), 500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [strokes, typed, mode, onDone])

  return (
    <div style={{ width: '100%' }}>
      <div className="sig-tools">
        <button className={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>DRAW SIGNATURE</button>
        <button className={mode === 'typed' ? 'on' : ''} onClick={() => setMode('typed')}>TYPE IT INSTEAD</button>
        {strokes.length > 0 && <button onClick={() => setStrokes([])}>CLEAR</button>}
      </div>
      {mode === 'draw' ? (
        <div
          ref={ref} className="sig-pad" style={{ minHeight: 76, cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        >
          {strokes.length === 0 && <span className="sig-hint">SIGN HERE — THE STROKE IS STORED</span>}
          <svg className="sig-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {strokes.map((st, i) => (
              <polyline key={i} points={st.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke={BLUE} strokeWidth="1.1" vectorEffect="non-scaling-stroke"
                strokeLinecap="round" strokeLinejoin="round" style={{ strokeWidth: 2.2 }} />
            ))}
          </svg>
        </div>
      ) : (
        <div className="sig-pad" style={{ minHeight: 76 }}>
          <input
            autoFocus placeholder="M. Bamgboye" value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && typed.trim().length > 1) onDone({ mode: 'typed', text: typed.trim() }) }}
            style={{
              border: 0, background: 'transparent', outline: 'none', width: '100%',
              font: '600 34px/1.2 Caveat, cursive', color: BLUE, textAlign: 'center',
            }}
            aria-label="Type your signature"
          />
        </div>
      )}
    </div>
  )
}

/* ---------- document view ---------- */
export function DocumentView({ doc, mark, onBack, onMark, onToast, pendingDecision, onGoDecide, onFileAway, weathered }: Props) {
  const [flipped, setFlipped] = useState(false)
  const [penMode, setPenMode] = useState(false)
  const [penText, setPenText] = useState('')
  const [shaking, setShaking] = useState(false)
  const [ghost, setGhost] = useState<Landing | null>(null)
  const ghostRef = useRef<Landing | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isGazette = doc.kind === 'gazette'
  const isTell = doc.kind === 'tell'
  const isSector = doc.kind === 'sector'
  const stamped = mark.stamps.length > 0
  const approved = mark.stamps.some(s => s.label === 'APPROVED')
  const { literacy } = useGame()

  /* redraw splatter whenever stamps change / flip returns / resize */
  useEffect(() => {
    const redraw = () => {
      if (canvasRef.current) drawSplatter(canvasRef.current, mark.stamps)
    }
    redraw()
    const t = setTimeout(redraw, 340)
    window.addEventListener('resize', redraw)
    return () => { clearTimeout(t); window.removeEventListener('resize', redraw) }
  }, [mark.stamps, flipped])

  /* Escape closes the file */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const pressGhost = (label: string, color: string) => {
    const l = landingFor(label, color)
    ghostRef.current = l
    setGhost(l)
  }
  const liftGhost = () => {
    ghostRef.current = null
    setGhost(null)
  }

  const applyStamp = (label: string, color: string) => (pressure: number) => {
    const landed = ghostRef.current?.label === label ? ghostRef.current : landingFor(label, color)
    const st: AppliedStamp = {
      id: `${doc.id}-${Date.now()}`,
      label, color, pressure,
      xPct: landed.xPct,
      yPct: landed.yPct,
      rot: landed.rot,
    }
    onMark({ ...mark, stamps: [...mark.stamps, st] })
    setShaking(true)
    setTimeout(() => setShaking(false), 220)
    onToast(`${label} — STAMPED · PRESSURE ${Math.round(pressure * 100)}%`)
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveAnnotation = () => {
    const t = penText.trim()
    if (t) onMark({ ...mark, annotations: [...mark.annotations, t] })
    setPenText('')
    setPenMode(false)
    if (t) onToast('ANNOTATION FILED — IT PERSISTS ON THE RECORD')
  }

  const copyRecord = async () => {
    try {
      await navigator.clipboard.writeText(doc.recordId)
      onToast(`RECORD ID COPIED — ${doc.recordId}`)
    } catch {
      onToast(`RECORD ID — ${doc.recordId}`)
    }
  }

  const audit = [
    ...doc.audit,
    ...mark.annotations.map(() => '08 Oct 2026 · you — annotation applied · visibility: private'),
    ...mark.stamps.map(s => `08 Oct 2026 · you — stamped ${s.label} · pressure ${Math.round(s.pressure * 100)}%`),
    ...(mark.tellResult === 'hit'
      ? ['05 Oct 2026 · you — Receipt built: three bids, one phone · strength 35']
      : mark.tellResult === 'miss'
      ? ['05 Oct 2026 · you — wrong line marked · 2 hours burned, an innocent explained twice']
      : []),
    ...(mark.signed
      ? [mark.signed.mode === 'draw'
          ? `08 Oct 2026 · you — signature captured · stroke vector (${mark.signed.strokes.length} strokes)`
          : `08 Oct 2026 · you — typed signature accepted (alternate method)`]
      : []),
  ]

  return (
    <div className={`docview${shaking ? ' shake' : ''}`}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="ink-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
        </filter>
      </svg>

      <header className="app-header">
        <div className="hdr-left">
          <button className="hdr-btn" onClick={onBack} aria-label="Back to desk">
            <IcBack width={20} height={20} />
          </button>
        </div>
        <div className="wordmark">MANDATE</div>
        <div className="hdr-right">
          <button className="hdr-btn" onClick={() => setFlipped(f => !f)} aria-label="Flip to authority">
            <IcInfo width={19} height={19} />
          </button>
          <button className="hdr-btn" onClick={copyRecord} aria-label="Copy record id">
            <IcShare width={19} height={19} />
          </button>
        </div>
      </header>

      <div className="sheet-scroll" ref={scrollRef}>
        <div className={`flipper${flipped ? ' flipped' : ''}`}>
          <div className="face recto">
            <article className={`sheet stock-${doc.stock}`}>
              {doc.clip === 'binder' && (
                <svg className="clip-binder" width="74" height="46" viewBox="0 0 74 46" aria-hidden>
                  <rect x="8" y="14" width="58" height="26" rx="4" fill="#C9C4BC" stroke="#5c5852" strokeWidth="2" />
                  <path d="M20 15 V8 a5 5 0 0 1 5-5 h24 a5 5 0 0 1 5 5 v7" fill="none" stroke="#5c5852" strokeWidth="3" />
                  <rect x="8" y="14" width="58" height="7" fill="#8f8a82" />
                </svg>
              )}
              {doc.clip === 'paperclip' && (
                <svg className="clip-paperclip" width="34" height="74" viewBox="0 0 34 74" aria-hidden>
                  <path d="M10 60 V16 a8 8 0 0 1 16 0 v44 a12 12 0 0 1-24 0 V20"
                    fill="none" stroke="#7d7d7d" strokeWidth="3.4" strokeLinecap="round" />
                </svg>
              )}
              {weathered && doc.stain !== 'none' && <div className={`stain ${doc.stain}`} />}

              <DocBody doc={doc} mark={mark} onMark={onMark} />

              {isGazette && (
                <div className="sig-block">
                  <div className="sig-line">
                    <b>Signature:</b>
                    <div className="sig-pad">
                      {!approved && <span className="sig-hint">STAMP FIRST — THEN SIGN</span>}
                      {approved && !mark.signed && (
                        <div style={{ width: '100%' }}>
                          <SigPad onDone={s => { onMark({ ...mark, signed: s }); onToast('SIGNATURE RECORDED') }} />
                        </div>
                      )}
                      {approved && mark.signed?.mode === 'typed' && (
                        <span className="sig-typed">{mark.signed.text}</span>
                      )}
                      {approved && mark.signed?.mode === 'draw' && (
                        <svg className="sig-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {mark.signed.strokes.map((st, i) => (
                            <polyline key={i} points={st.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="none" stroke={BLUE} vectorEffect="non-scaling-stroke"
                              strokeLinecap="round" strokeLinejoin="round" style={{ strokeWidth: 2.4 }} />
                          ))}
                        </svg>
                      )}
                    </div>
                  </div>
                  {mark.signed && (
                    <>
                      <div className="doc-small" style={{ marginTop: 6 }}>
                        Signed by: {doc.kind === 'gazette' ? doc.signName : 'M. Bamgboye'}<br />
                        {doc.kind === 'gazette' ? doc.role : 'Authorized Signatory'}
                      </div>
                      <div className="gaz-footer valid">{doc.footer}</div>
                    </>
                  )}
                  {!mark.signed && !approved && <div className="gaz-footer">{doc.footer}</div>}
                  {mark.signed && mark.signed.mode === 'draw' && (
                    <div className="sig-tools">
                      <button onClick={() => { onMark({ ...mark, signed: undefined }); onToast('SIGNATURE CLEARED — SIGN AGAIN') }}>
                        CLEAR &amp; REDRAW
                      </button>
                      <button onClick={() => { onMark({ ...mark, signed: { mode: 'typed', text: 'M. Bamgboye' } }); onToast('ALTERNATE SIGNATURE ACCEPTED') }}>
                        USE TYPED INSTEAD
                      </button>
                    </div>
                  )}
                </div>
              )}

              {mark.annotations.map((a, i) => (
                <div className="annotation" key={i}>
                  {a}<span className="ann-meta">8 OCT 2026 · YOU · PRIVATE</span>
                </div>
              ))}

              {ghost && !stamped && (
                <>
                  <div
                    className="ghost-stamp"
                    style={{
                      left: `${ghost.xPct}%`, top: `${ghost.yPct}%`, color: ghost.color,
                      transform: `translate(-50%,-50%) rotate(${ghost.rot}deg)`,
                    }}
                    aria-hidden
                  >
                    {ghost.label}
                  </div>
                  <div
                    className="ghost-ledger"
                    style={{ top: `calc(${ghost.yPct}% + 54px)` }}
                    aria-hidden
                  >
                    {GHOST_LEDGER[ghost.label]}
                  </div>
                </>
              )}

              <canvas ref={canvasRef} className="splatter-canvas" />
              {mark.stamps.map(st => (
                <div
                  key={st.id}
                  className={`applied-stamp${st.label === 'DECLINED' ? ' declined' : ''}`}
                  style={{
                    left: `${st.xPct}%`, top: `${st.yPct}%`,
                    color: st.color,
                    transform: `translate(-50%,-50%) rotate(${st.rot}deg) scale(${0.92 + st.pressure * 0.16})`,
                  }}
                >
                  {st.label}
                  <span className="sub">8 OCT 2026 · GOVT OF DELTA</span>
                </div>
              ))}
            </article>
          </div>

          <div className="face verso" onClick={() => setFlipped(false)}>
            <div className="verso-inner">
              <div className="verso-stamp-label">Authority cited</div>
              <h2 className="verso-authority">{doc.authority}</h2>
              <p className="verso-text">{doc.authorityText}</p>
              {isSector && (
                <>
                  <hr className="verso-rule" />
                  <div className="verso-stamp-label">The chain of hands (§43.2)</div>
                  <div className="verso-chain">
                    {[...doc.chain].reverse().map((c, i) => (
                      <div className={`chain-step${c.minLiteracy <= literacy ? '' : ' redacted'}`} key={i}>
                        <span className="chain-lag">{c.lag}</span>
                        <span className="chain-body">
                          {c.minLiteracy <= literacy ? c.step : '▓▓▓▓▓ redacted at your literacy ▓▓▓▓▓'}
                          {c.minLiteracy <= literacy && <em>{c.detail}</em>}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <hr className="verso-rule" />
              <div className="verso-stamp-label">Audit trail — the paper never forgets</div>
              {audit.map((a, i) => <div className="audit-line" key={i}>{a}</div>)}
              {mark.annotations.length > 0 && (
                <div className="verso-annots">
                  <div className="verso-stamp-label">Annotations carried forward</div>
                  {mark.annotations.map((a, i) => <div className="va" key={i}>— {a}</div>)}
                </div>
              )}
              <div className="verso-rec">
                RECORD ID: {doc.recordId}<br />
                CONTENT PACK: base-2026.10-a · VISIBILITY CHAIN INTACT
              </div>
              <div className="flip-back-hint">TAP ANYWHERE TO FLIP BACK</div>
            </div>
          </div>
        </div>
      </div>

      {penMode && (
        <div className="pen-area">
          <textarea
            autoFocus value={penText} onChange={e => setPenText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveAnnotation() }
              if (e.key === 'Escape') { e.stopPropagation(); setPenText(''); setPenMode(false) }
            }}
            placeholder="red pen — note on the file…"
            aria-label="Annotation text"
          />
          <div className="pen-hint">
            <span>ENTER TO FILE · ESC TO DROP</span>
            <span>
              <button onClick={saveAnnotation}>FILE IT</button>
              <button onClick={() => { setPenText(''); setPenMode(false) }}>CANCEL</button>
            </span>
          </div>
        </div>
      )}

      <div className="action-bar">
        <button className="act-btn" onClick={() => setFlipped(f => !f)}>
          <IcFlip /> <span>FLIP · CITE</span>
        </button>
        <button className={`act-btn pen${penMode ? ' ready' : ''}`} onClick={() => setPenMode(p => !p)}>
          <IcPen /> <span>RED PEN</span>
        </button>
        {pendingDecision && onGoDecide && (
          <button className="act-btn pen" onClick={onGoDecide}>
            <IcDecisions /> <span>DECIDE IT</span>
          </button>
        )}
        {onFileAway && (
          <button className="act-btn" onClick={onFileAway}>
            <IcFiles /> <span>FILE THIS NOTE</span>
          </button>
        )}
        {isGazette && (
          <>
            <StampButton label="APPROVED" onStamp={applyStamp('APPROVED', RED)} disabled={stamped}
              onPress={p => (p ? pressGhost('APPROVED', RED) : liftGhost())} />
            <StampButton label="DECLINED" blue onStamp={applyStamp('DECLINED', BLUE)} disabled={stamped}
              onPress={p => (p ? pressGhost('DECLINED', BLUE) : liftGhost())} />
          </>
        )}
        {!isGazette && stamped && (
          <button className="act-btn" disabled>
            <IcCheck /> <span>ACTED ON</span>
          </button>
        )}
        {isTell && !mark.tellResult && (mark.tellMarks?.length ?? 0) > 0 && onMark && (
          <button
            className="act-btn pen"
            onClick={() => {
              const marks = new Set(mark.tellMarks ?? [])
              const truths = new Set(
                doc.kind === 'tell' ? doc.files.flatMap(f => f.lines.filter(l => l.tell).map(l => l.id)) : [],
              )
              const hit = marks.size === truths.size && [...truths].every(t => marks.has(t))
              onMark({ ...mark, tellResult: hit ? 'hit' : 'miss' })
              onToast(hit
                ? 'RECEIPT BUILT — PROOF STRENGTH +35 · COVER INTEGRITY −20'
                : 'WRONG MARK — 2 HOURS BURNED; THE COMMITTEE NOTICES')
            }}
          >
            <IcCheck /> <span>FILE THE FINDING</span>
          </button>
        )}
      </div>
    </div>
  )
}
