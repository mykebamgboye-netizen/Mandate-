/* MANDATE — the derivation.
   Nothing below is tied to one state or one office: the desk's week number, date, seat,
   cabinet, chamber, fund, deadlines and term line all come out of the player's own record
   plus the analog world's clock. The clock is the only fixed thing (Week 41, October 2026),
   and even that is read off a date rather than typed as display text. */

import { FEDERATION_STATES } from '../profile/client'
import { placesFor, FCT_AREA_COUNCILS } from './places'
import { wordsFor } from './lexicon'
import { moneyFor } from './money'
import type { Calendar, Scenario, ScenarioInput, Term } from './types'
import type { Tier } from '../profile/types'

/** The analog world's desk day. Week 41 of 2026 falls here; everything else is derived. */
export const WORLD_NOW = '2026-10-08'

/** Inauguration days of the world's calendar, by tier (s.180 / s.7 terms). */
export function defaultTermStart(tier: Tier): string {
  if (tier === 'fct') return '2026-06-01'
  if (tier === 'local') return '2026-07-01'
  return '2026-05-29'
}

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (isoDate: string, days: number) => {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return iso(d)
}

/** ISO-8601 week number of a date. */
function isoWeekOf(isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00Z')
  const day = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** '15 OCT' — how the files write a near date. */
function shortDay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`
}

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z')
  const b = new Date(toIso + 'T00:00:00Z')
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (b.getUTCDate() < a.getUTCDate()) months -= 1
  return Math.max(0, months)
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  const day = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + months)
  if (d.getUTCDate() < day) d.setUTCDate(0)
  return iso(d)
}

/** The player's display name and the initials the files use. */
export function nameParts(name: string | null): { player: string; shortName: string; initials: string } {
  const full = (name ?? '').trim()
  if (!full) return { player: 'The office-holder', shortName: 'the office-holder', initials: '—' }
  const parts = full.split(/\s+/)
  const initials = parts.map(p => p[0]).join('').replace(/[^A-Za-z.]/g, '').slice(0, 3).toUpperCase()
  const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const rest = parts.slice(0, -1).map(p => (p.length > 2 ? p[0].toUpperCase() + '.' : p)).join(' ')
  return {
    player: full,
    shortName: (rest ? rest + ' ' : '') + surname,
    initials: initials || surname[0].toUpperCase(),
  }
}

/** Which state a nation-wide or appointed seat sits on, and what the seat is called. */
function seatFor(input: ScenarioInput, capital: string | null): string {
  if (input.tier === 'local') return input.lgaName ?? capital ?? 'the council'
  return capital ?? 'the capital'
}

export function deriveScenario(input: ScenarioInput): Scenario {
  const stateRow = input.stateCode
    ? FEDERATION_STATES.find(s => s.code === input.stateCode) ?? null
    : null
  const stateName = input.stateName ?? stateRow?.name ?? null
  const capital = input.capital ?? stateRow?.capital ?? null
  const places = placesFor(input.stateCode)
  const zones = places.districts.length > 0
    ? places.districts
    : stateName ? [`${stateName} North`, `${stateName} Central`, `${stateName} South`] : []
  const towns = input.stateCode === 'FC' ? FCT_AREA_COUNCILS.slice(1, 4) : places.towns
  const lgaCount = input.tier === 'local' && input.lgaName ? null
    : stateName ? places.councils : null

  const seat = seatFor(input, capital)
  const elected = input.route === 'elected'
  const w = wordsFor({
    tier: input.tier,
    elected,
    post: input.post,
    seat,
    stateName,
    capital,
    lgaName: input.lgaName,
    towns,
    districts: zones,
    councils: places.councils,
  })

  /* ---- calendar: read off the world clock, never typed ---- */
  const d = new Date(WORLD_NOW + 'T00:00:00Z')
  const weekNumber = isoWeekOf(WORLD_NOW)
  const year = d.getUTCFullYear()
  const month = MONTHS[d.getUTCMonth()]
  const dayName = DAYS[d.getUTCDay()]
  const dayNum = d.getUTCDate()
  const shortDate = `${dayNum} ${month.slice(0, 3)} ${year}`

  const unionDeadline = input.tier === 'federal' || input.tier === 'state'
    ? 'ASUU ultimatum'
    : "Teachers' ultimatum"
  const windowDeadline = input.tier === 'federal' || input.tier === 'state'
    ? 'NLC window closes'
    : 'Arrears window closes'
  const allocationDeadline = input.tier === 'federal'
    ? 'Federation allocation drops'
    : input.tier === 'fct'
      ? 'FCTA allocation drops'
      : input.tier === 'local'
        ? 'JAAC allocation drops'
        : 'FAAC drops'
  const deadlines = [
    { label: unionDeadline, days: 7 },
    { label: windowDeadline, days: 12 },
    { label: allocationDeadline, days: 13 },
  ].map(x => {
    const at = addDays(WORLD_NOW, x.days)
    return { label: x.label, date: shortDay(at), iso: at }
  })

  const prevMonthIso = addMonths(WORLD_NOW, -1)
  const prevMonth = MONTHS[new Date(prevMonthIso + 'T00:00:00Z').getUTCMonth()]
  const calendar: Calendar = {
    iso: WORLD_NOW,
    weekNumber,
    year,
    dayLine: `${dayName} · ${dayNum} ${month} ${year}`,
    weekLine: `${w.cabinetShort} WEEK ${weekNumber} · ${seat.toUpperCase()}`,
    monthLabel: `${month} ${year}`,
    prevMonth,
    letterDate: shortDay(addDays(WORLD_NOW, -2)),
    floodWindow: `${shortDay(addDays(WORLD_NOW, 2))}–${shortDay(addDays(WORLD_NOW, 5))}`,
    shortDate: `${dayNum} ${month.slice(0, 3)} ${year}`,
    decisionsHead: `DECISIONS · ${shortDate}`,
    stampDate: `${shortDate} · ${w.cabinetShort}`,
    deadlines,
    deadlineLine: deadlines.map(x => `${x.label} ${x.date.toLowerCase().replace(/(\d+) (\w)/, (_, n, c) => `${n} ${c.toUpperCase()}`)}`).join(' · '),
    filedLine: `WEEK ${weekNumber} FILED ✓ — THE DESK IS CLEAN. INBOX REOPENS MONDAY.`,
    tickLine: `TIDYING THE DESK OVERNIGHT — WEEK ${weekNumber} → FILED`,
  }

  /* ---- term: months in office since the inauguration, months to the poll ---- */
  const termStart = input.termStart ?? defaultTermStart(input.tier)
  const monthsInOffice = monthsBetween(termStart, WORLD_NOW)
  let term: Term
  if (!elected) {
    term = {
      line: `APPOINTED SEAT · ${monthsInOffice} MONTHS IN · SERVES AT THE PLEASURE OF THE PRESIDENT`,
      monthsInOffice,
      monthsToPoll: null,
      pollLabel: null,
      note: `${w.termNote} No ballot put you here and none can remove you but the one who sent you.`,
    }
  } else {
    const years = input.tier === 'local' ? 3 : 4
    const termEnd = addMonths(termStart, years * 12)
    const poll = addMonths(termEnd, -3)
    const monthsToPoll = monthsBetween(WORLD_NOW, poll)
    term = {
      line: `FIRST TERM · ${monthsInOffice} MONTHS IN · ${w.electionLine} ${monthsToPoll} MONTHS AWAY`,
      monthsInOffice,
      monthsToPoll,
      pollLabel: `${shortDay(poll)} ${poll.slice(0, 4)}`,
      note: `Lose the poll and the term ends there. One life, no reload.`,
    }
  }

  /* ---- money: the tier factor, derived from the anchors themselves ---- */
  const money = moneyFor({
    tier: input.tier,
    stateName,
    seat,
    lgaName: input.lgaName,
    councils: places.councils,
    allocation: w.allocation,
    allocationFull: w.allocationFull,
    fundTitle: w.fundTitle,
    appropriationAuthority: w.appropriationAuthority,
  })

  const { player, shortName, initials } = nameParts(input.name)
  const jurisdictionName = input.tier === 'federal'
    ? 'the Federation'
    : input.tier === 'fct'
      ? 'the Federal Capital Territory'
      : input.tier === 'local'
        ? `${input.lgaName ?? 'the council'} Local Government`
        : `${stateName ?? 'the state'}${stateName ? ' State' : ''}`
  const jurisdictionShort = input.tier === 'federal'
    ? 'FEDERATION'
    : input.tier === 'fct'
      ? 'FCT'
      : input.tier === 'local'
        ? (input.lgaName ?? 'COUNCIL').toUpperCase()
        : (stateName ?? 'STATE').toUpperCase()

  return {
    input,
    tier: input.tier,
    elected,
    player,
    shortName,
    initials,
    age: input.age,
    post: input.post,
    officeTitle: w.officeTitle,
    partyCode: input.partyCode,
    partyName: input.partyName ?? input.partyCode,
    seat,
    jurisdictionName,
    jurisdictionShort,
    stateName,
    stateCode: input.stateCode,
    capital,
    lgaName: input.lgaName,
    lgaCount,
    zones,
    towns,
    country: 'NIGERIA',
    w,
    calendar,
    money,
    term,
  }
}

/** Record ids look like MANDATE/2026/W41/EXCO — the desk's own shorthand. */
export function recordId(s: Scenario, kind: string): string {
  return `MANDATE/${s.calendar.year}/W${s.calendar.weekNumber}/${kind}`
}
