/* Hold-to-commit (§26.2). Nothing irreversible is a tap:
   Level 1 — routine: single tap.
   Level 2 — policy: press and hold 1.0s, red circle fills clockwise.
   Level 3 — career-ending: press and hold 3.0s; amber at 1s ("IRREVERSIBLE"),
             pulsing red after 2s, edges darken, then a full-screen slam.
   Releasing early snaps the circle back and says what it costs. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGame } from './game-context'

export type CommitLevel = 1 | 2 | 3

export const SPEC: Record<CommitLevel, { ms: number; caption: string; early: string }> = {
  1: { ms: 0, caption: 'TAP', early: '' },
  2: { ms: 1000, caption: 'HOLD 1s', early: 'HOLD TO SIGN — RELEASED TOO SOON' },
  3: { ms: 3000, caption: 'HOLD 3s', early: 'THIS ENDS CAREERS. HOLD 3s TO CONFIRM' },
}

export function buzz(pattern: number | number[], enabled: boolean) {
  if (!enabled) return
  try { navigator.vibrate?.(pattern) } catch { /* no haptics available */ }
}

const R = 14
const C = 2 * Math.PI * R

interface Props {
  level: CommitLevel
  onCommit: (progress: number) => void
  /** fired when the hold is released before the threshold */
  onEarly?: () => void
  /** fired the instant pressure begins (ghost preview, pressed styling) */
  onStart?: () => void
  disabled?: boolean
  className?: string
  ariaLabel: string
  /** hidden until held — the option label is passed as children */
  children: ReactNode
}

export function HoldToCommit({
  level, onCommit, onEarly, onStart, disabled, className = '', ariaLabel, children,
}: Props) {
  const { settings } = useGame()
  const spec = SPEC[level]
  const [p, setP] = useState(0)
  const [holding, setHolding] = useState(false)
  const startRef = useRef(0)
  const rafRef = useRef(0)
  const firedRef = useRef<Set<number>>(new Set())

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const phase: 'red' | 'amber' | 'alarm' =
    level === 3 && p >= 2 / 3 ? 'alarm' : level === 3 && p >= 1 / 3 ? 'amber' : 'red'

  const stop = () => {
    cancelAnimationFrame(rafRef.current)
    setHolding(false)
    setP(0)
  }

  const tick = (now: number) => {
    const held = now - startRef.current
    const prog = Math.min(held / spec.ms, 1)
    setP(prog)
    // haptics: level 2 — light tick at 500ms, medium click at 1000ms.
    // level 3 — tick at 1s, double-tick at 2s, heavy thud at 3s.
    if (level === 2) {
      if (held >= 500 && !firedRef.current.has(500)) { firedRef.current.add(500); buzz(8, settings.haptics) }
    } else if (level === 3) {
      if (held >= 1000 && !firedRef.current.has(1000)) { firedRef.current.add(1000); buzz(12, settings.haptics) }
      if (held >= 2000 && !firedRef.current.has(2000)) { firedRef.current.add(2000); buzz([14, 60, 14], settings.haptics) }
    }
    if (prog < 1) rafRef.current = requestAnimationFrame(tick)
  }

  const down = () => {
    if (disabled) return
    if (level === 1) { onStart?.(); return }
    onStart?.()
    startRef.current = performance.now()
    firedRef.current = new Set()
    setHolding(true)
    setP(0)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  const up = () => {
    if (disabled) return
    if (level === 1) { onCommit(1); return }
    if (!holding) return
    const held = performance.now() - startRef.current
    const prog = Math.min(held / spec.ms, 1)
    stop()
    if (prog >= 1) {
      buzz(level === 3 ? [30, 40, 90] : 24, settings.haptics)
      onCommit(1)
    } else {
      onEarly?.()
    }
  }

  const cancel = () => {
    if (level === 1 || !holding) return
    if (p > 0.05) onEarly?.()
    stop()
  }

  return (
    <button
      className={`hold${className ? ' ' + className : ''}${holding ? ' holding' : ''}${level === 3 ? ' irreversible' : ''}`}
      data-phase={holding ? phase : undefined}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <span className="hold-body">{children}</span>
      {level > 1 && (
        <span className="hold-ring" aria-hidden>
          <svg viewBox="0 0 34 34" width="34" height="34">
            <circle className="hold-track" cx="17" cy="17" r={R} />
            <circle
              className="hold-fill" cx="17" cy="17" r={R}
              strokeDasharray={C} strokeDashoffset={C * (1 - p)}
              transform="rotate(-90 17 17)"
            />
          </svg>
        </span>
      )}
      {level > 1 && holding && (
        <span className="hold-word" aria-live="polite">
          {phase === 'amber' ? 'IRREVERSIBLE' : phase === 'alarm' ? 'COMMITTING…' : spec.caption}
        </span>
      )}
    </button>
  )
}
