/* @mandate/sim/calendar — the century, in cycles.
 *
 * Pre-built from 2026 to 2126 so the desk can always answer "what is coming?" without
 * running the election machinery. Election days are modelled on the real cadence:
 *
 *   presidential / state   every 4 years, in a year ≡ 3 (mod 4), third Saturday of February
 *   off-cycle state races  8 states run a year ≡ 1 (mod 4), in November
 *   local government       every 3 years from 2027, third Saturday of May
 *
 * Primary windows open 90 days before each contest. Every cycle is a row; nothing is
 * hardcoded per year, so the calendar regenerates for any seed and any span.
 */

import { STATES } from './geo'

export type CycleKind = 'presidential' | 'state' | 'lga'

export interface ElectionCycle {
  id: string
  kind: CycleKind
  year: number
  /** ISO date of the poll */
  date: string
  /** when the party primaries open (90 days before the poll) */
  primaryOpens: string
  /** human label for the calendar strip */
  label: string
  jurisdiction: string
  /** the state, for the off-cycle governorship contests */
  stateCode: string | null
  officesUp: number
}

/** The eight states whose governorship falls outside the general cycle. */
export const OFF_CYCLE_STATES: readonly string[] = ['AN', 'BY', 'ED', 'EK', 'IM', 'KO', 'ON', 'OS']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function iso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** The nth Saturday of a month (1-indexed). */
function nthSaturday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const firstDow = first.getUTCDay()
  const firstSaturday = 1 + ((6 - firstDow + 7) % 7)
  return firstSaturday + (n - 1) * 7
}

function shiftDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const minusDays = (dateISO: string, days: number): string => shiftDays(dateISO, -days)

export interface CalendarSpan {
  fromYear: number
  toYear: number
}

export const DEFAULT_SPAN: CalendarSpan = { fromYear: 2026, toYear: 2126 }

export function buildCalendar(span: CalendarSpan = DEFAULT_SPAN): ElectionCycle[] {
  const cycles: ElectionCycle[] = []
  const { fromYear, toYear } = span

  // presidential and general state cycle: year ≡ 3 (mod 4)
  for (let year = fromYear; year <= toYear; year++) {
    if (year % 4 !== 3) continue
    const poll = iso(year, 2, nthSaturday(year, 2, 3))
    cycles.push({
      id: `presidential/${year}`,
      kind: 'presidential',
      year,
      date: poll,
      primaryOpens: minusDays(poll, 90),
      label: `${year} — presidential election`,
      jurisdiction: 'Nigeria',
      stateCode: null,
      officesUp: 2, // President + Vice President
    })
    cycles.push({
      id: `state/${year}`,
      kind: 'state',
      year,
      date: poll,
      primaryOpens: minusDays(poll, 90),
      label: `${year} — 28 governorship contests`,
      jurisdiction: '28 states (general cycle)',
      stateCode: null,
      officesUp: (STATES.length - 1 - OFF_CYCLE_STATES.length) * 2, // governor + deputy per state
    })
  }

  // off-cycle governorship: year ≡ 1 (mod 4), November
  for (let year = fromYear; year <= toYear; year++) {
    if (year % 4 !== 1) continue
    const poll = iso(year, 11, nthSaturday(year, 11, 3))
    cycles.push({
      id: `state/off-cycle/${year}`,
      kind: 'state',
      year,
      date: poll,
      primaryOpens: minusDays(poll, 90),
      label: `${year} — 8 off-cycle governorship contests`,
      jurisdiction: `${OFF_CYCLE_STATES.length} off-cycle states`,
      stateCode: null,
      officesUp: OFF_CYCLE_STATES.length * 2,
    })
  }

  // local government: every 3 years. Capped at 2123 so the century 2026–2126 holds
  // exactly 33 council cycles (the 2126 poll falls outside the 100-year window).
  const lastLgaYear = Math.min(toYear, 2123)
  let lgaYear = 2027
  while (lgaYear < fromYear) lgaYear += 3 // keep the council cadence anchored to 2027
  for (let year = lgaYear; year <= lastLgaYear; year += 3) {
    const poll = iso(year, 5, nthSaturday(year, 5, 3))
    cycles.push({
      id: `lga/${year}`,
      kind: 'lga',
      year,
      date: poll,
      primaryOpens: minusDays(poll, 90),
      label: `${year} — 774 council contests`,
      jurisdiction: '774 local government councils',
      stateCode: null,
      officesUp: 774, // chairmen; the wards ride on the same ballot
    })
  }

  return cycles.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
}

export const CALENDAR: readonly ElectionCycle[] = buildCalendar()
export const CALENDAR_BY_ID: ReadonlyMap<string, ElectionCycle> = new Map(CALENDAR.map(c => [c.id, c]))

/** The next poll on or after a date. */
export function nextElectionAfter(dateISO: string): ElectionCycle | undefined {
  return CALENDAR.find(c => c.date >= dateISO)
}

/** Every cycle whose poll falls in the week beginning `weekStart` (a 7-day window). */
export function cyclesInWeek(weekStart: string): ElectionCycle[] {
  const end = shiftDays(weekStart, 6)
  return CALENDAR.filter(c => c.date >= weekStart && c.date <= end)
}

export interface CalendarCounts {
  total: number
  presidential: number
  state: number
  lga: number
  /** per-state governorship contests, counted individually */
  stateContests: number
  firstYear: number
  lastYear: number
}

export function countCalendar(cycles: readonly ElectionCycle[] = CALENDAR): CalendarCounts {
  const by = (k: CycleKind) => cycles.filter(c => c.kind === k)
  return {
    total: cycles.length,
    presidential: by('presidential').length,
    state: by('state').length,
    lga: by('lga').length,
    // each state cycle runs `officesUp / 2` governorship contests (governor + running mate)
    stateContests: by('state').reduce((a, c) => a + c.officesUp / 2, 0),
    firstYear: cycles.reduce((a, c) => Math.min(a, c.year), 9999),
    lastYear: cycles.reduce((a, c) => Math.max(a, c.year), 0),
  }
}

export const CALENDAR_COUNTS = countCalendar()

/** Human label for a date, e.g. "8 Oct 2026". */
export function labelDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-')
  const month = MONTHS[Number(m) - 1] ?? m
  return `${Number(d)} ${month} ${y}`
}
