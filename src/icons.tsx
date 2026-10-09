/* Condensed line icons — folder-tab set + header glyphs. */
import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true, ...p,
})

export const IcBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 4 7 12l8 8" /></svg>
)
export const IcInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
)
export const IcShare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 15V4m0 0 4 4m-4-4L8 8" /><path d="M5 13v6h14v-6" /></svg>
)
export const IcFlip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 9a8 8 0 0 1 13-3l3 3" /><path d="M20 15a8 8 0 0 1-13 3l-3-3" /><path d="M20 4v5h-5M4 20v-5h5" /></svg>
)
export const IcPen = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></svg>
)
export const IcStamp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 4h6v4l2 3H7l2-3V4z" /><rect x="5" y="14" width="14" height="4" rx="1" /><path d="M4 20h16" /></svg>
)
export const IcBriefings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h9l3 3v15H6z" /><path d="M9 8h6M9 12h4" /><path d="m12 15 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" /></svg>
)
export const IcAllies = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="9" cy="9" r="3.2" /><circle cx="16.5" cy="10" r="2.6" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M16 14.6c2.2 0 3.9 1.3 4.5 3.7" /></svg>
)
export const IcDecisions = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3.5" y="8" width="17" height="11" rx="1.5" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3.5 13h17" /></svg>
)
export const IcBudget = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 4h6l-1.5 3h-3z" /><path d="M7.5 7h9l2.5 6.5c0 3.6-3 6.5-7 6.5s-7-2.9-7-6.5z" /><path d="M12 10v6m-2-4.5h3.2a1.4 1.4 0 0 1 0 2.8H10" /></svg>
)
export const IcFiles = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3.5 7.5h6l1.5 2h9.5v9.5H3.5z" /><path d="M3.5 7.5V5h5.7l1.4 2" /></svg>
)
export const IcCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5 13 4 4 10-10" /></svg>
)

export const IcClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
)
export const IcLock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="5" y="10.5" width="14" height="9.5" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
)
export const IcSlip = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h9l3 3v15H6z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>
)
