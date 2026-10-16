/* @mandate/components/desk/FederalHeader — the tier bar that sits above every desk.
   Federal green bar: the council's name on the left (federal / state / LGA),
   the week and the seat in the centre, the FAAC pulse on the right.
   Every string comes from props so the same bar serves Sapele LGA, Lagos State
   or the Federation — no Delta data is baked in. */

export type DeskLevel = 'federal' | 'state' | 'lga'

export interface FederalHeaderProps {
  /** which council this desk reports to */
  level: DeskLevel
  /** the game week, printed as "WEEK 41" */
  week: number
  /** the seat the desk reports from — Abuja, Asaba, Sapele … */
  capital: string
}

export const COUNCIL_NAME: Record<DeskLevel, string> = {
  federal: 'FEDERAL EXECUTIVE COUNCIL',
  state: 'STATE EXECUTIVE COUNCIL',
  lga: 'LGA EXECUTIVE COUNCIL',
}

const TIER_NOTE: Record<DeskLevel, string> = {
  federal: 'Federation account',
  state: 'State allocation',
  lga: 'Council share · joint account',
}

/** FAAC pulse — the monthly allocation heartbeat, per tier. */
function FaacPulse({ level }: { level: DeskLevel }) {
  return (
    <span className="dv2-faac" role="img" aria-label="FAAC pulse" title={`FAAC pulse — ${TIER_NOTE[level]}`}>
      <svg viewBox="0 0 44 20" width="44" height="20" aria-hidden focusable="false">
        <path
          className="dv2-faac-path"
          d="M1 10 h7 l3 -7 3.5 14 3 -10 2.5 3 h4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="dv2-faac-dot" aria-hidden />
    </span>
  )
}

export function FederalHeader({ level, week, capital }: FederalHeaderProps) {
  return (
    <header className="dv2-header" data-level={level}>
      <div className="dv2-header-left">
        <span className="dv2-seal" aria-hidden>₦</span>
        <span className="dv2-council">{COUNCIL_NAME[level]}</span>
      </div>
      <div className="dv2-header-mid">
        WEEK {week} · {capital.toUpperCase()}
      </div>
      <FaacPulse level={level} />
    </header>
  )
}

export default FederalHeader
