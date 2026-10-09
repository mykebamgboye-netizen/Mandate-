/* The Stamp: press-and-hold, release to slam.
   Hold duration is the pressure proxy; splatter is drawn on canvas; heavy thud. */
import { IcStamp } from './icons'
import { HoldToCommit } from './hold'

export interface AppliedStamp {
  id: string
  label: string
  color: string
  pressure: number
  xPct: number
  yPct: number
  rot: number
}

/* deterministic little PRNG so re-renders keep the same splatter */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/* heavy thud: low sine drop + filtered noise burst */
export function thud() {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.18)
    g.gain.setValueAtTime(0.5, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(g).connect(ctx.destination)
    osc.start(now); osc.stop(now + 0.3)
    const len = Math.floor(ctx.sampleRate * 0.08)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    const ng = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 900
    ng.gain.value = 0.22
    src.buffer = buf
    src.connect(lp).connect(ng).connect(ctx.destination)
    src.start(now)
    setTimeout(() => ctx.close().catch(() => undefined), 600)
  } catch { /* audio optional */ }
}

/* draw ink splatter around the landing point */
export function drawSplatter(
  canvas: HTMLCanvasElement,
  stamps: AppliedStamp[],
) {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx || !rect.width) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, rect.height)
  for (const st of stamps) {
    const rnd = mulberry32(hashStr(st.id))
    const cx = (st.xPct / 100) * rect.width
    const cy = (st.yPct / 100) * rect.height
    const reach = 90 + st.pressure * 120
    const n = Math.floor(14 + st.pressure * 34)
    ctx.fillStyle = st.color
    ctx.globalAlpha = 0.5
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2
      const dist = 30 + rnd() * reach
      const r = 0.6 + rnd() * (1.6 + st.pressure * 4.2)
      const x = cx + Math.cos(ang) * dist
      const y = cy + Math.sin(ang) * dist * 0.72
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (0.7 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    /* a couple of streaks thrown off the stamp edge */
    ctx.globalAlpha = 0.32
    for (let i = 0; i < 3; i++) {
      const ang = rnd() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 30)
      const len = 20 + rnd() * (30 + st.pressure * 60)
      ctx.quadraticCurveTo(
        cx + Math.cos(ang) * (40 + len * 0.6) + (rnd() * 16 - 8),
        cy + Math.sin(ang) * (30 + len * 0.5) + (rnd() * 16 - 8),
        cx + Math.cos(ang) * (40 + len),
        cy + Math.sin(ang) * (30 + len) * 0.8,
      )
      ctx.lineWidth = 0.8 + rnd() * 1.4
      ctx.strokeStyle = st.color
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

interface Props {
  label: string
  blue?: boolean
  onStamp: (pressure: number) => void
  disabled?: boolean
  /** press-and-hold lifecycle: true on press, false on release/cancel.
      Fires AFTER onStamp on release, so a landing-position snapshot taken
      during the hold is still readable when onStamp runs. */
  onPress?: (pressing: boolean) => void
}
interface Props {
  label: string
  blue?: boolean
  onStamp: (pressure: number) => void
  disabled?: boolean
  /** press-and-hold lifecycle: true on press, false on release/cancel.
      Fires AFTER onStamp on release, so a landing-position snapshot taken
      during the hold is still readable when onStamp runs. */
  onPress?: (pressing: boolean) => void
}

/* Level 2 (policy) on the hold-to-commit ladder: one full second of pressure
   before ink lands. Releasing early writes nothing (see hold.tsx). */
export function StampButton({ label, blue, onStamp, disabled, onPress }: Props) {
  return (
    <HoldToCommit
      level={2}
      disabled={disabled}
      className={`act-btn stamp-btn${blue ? ' blue' : ''}`}
      ariaLabel={`Hold to stamp ${label}`}
      onStart={() => onPress?.(true)}
      onCommit={() => {
        onStamp(1)          // landing first — the ghost snapshot is still valid
        onPress?.(false)
        thud()
      }}
      onEarly={() => onPress?.(false)}
    >
      <IcStamp />
      <span>HOLD · {label}</span>
    </HoldToCommit>
  )
}
