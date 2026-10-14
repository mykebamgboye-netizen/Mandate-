/* MANDATE — the career model.
   An office is a rung, not an identity. You can climb it, and you can fall off it, and the
   fall has three shapes that are all still played: the godfather with no office, the exile
   with a lobby, and the prosecution with a docket. */

import type { Tier } from './profile/types'

export interface CareerRung {
  id: string
  officeId: string
  label: string
  tier: Tier
  /** what the rung is actually good for */
  gives: string
  /** what it costs to be here */
  costs: string
}

export const CAREER_LADDER: CareerRung[] = [
  {
    id: 'councillor',
    officeId: 'local/councillor',
    label: 'Councillor',
    tier: 'local',
    gives: 'A ward, a vote in the council, and the first real knowledge of who the money passes through.',
    costs: 'No signature, no allocation, no police. You are a rumour with a seat.',
  },
  {
    id: 'lga_chairman',
    officeId: 'local/chairman',
    label: 'Council Chairman',
    tier: 'local',
    gives: 'The council allocation, primary health and primary schools, and the market levies.',
    costs: 'Direct FAAC payment since July 2024 also means direct audit. The state can still delay you.',
  },
  {
    id: 'state_assembly',
    officeId: 'state/assembly',
    label: 'State Assembly Member',
    tier: 'state',
    gives: 'A vote on the budget, on the commissioners, and on the governor’s borrowing.',
    costs: 'You can block, and you can be recalled by the same constituency that sent you.',
  },
  {
    id: 'governor',
    officeId: 'state/governor',
    label: 'Governor',
    tier: 'state',
    gives: 'The state budget, works, secondary health and education, land and agriculture.',
    costs: 'The police are not yours, the naira is not yours, and the blame is all yours.',
  },
  {
    id: 'president',
    officeId: 'federal/president',
    label: 'President',
    tier: 'federal',
    gives: 'The Federation Account, the armed forces, the appointments, and the foreign credit line.',
    costs: 'No spending without the National Assembly, and section 143 is always available to someone.',
  },
]

export interface CareerFall {
  id: 'postless_godfather' | 'exile' | 'prosecution'
  label: string
  trigger: string
  play: string
  /** what is still controlled once the office is gone */
  retains: string
}

export const CAREER_FALLS: CareerFall[] = [
  {
    id: 'postless_godfather',
    label: 'The postless godfather',
    trigger: 'Leave office with patronage above ₦2bn and the delegates still answering.',
    play: 'You do not run. You decide who runs, and the allocation passes through your street.',
    retains: 'Party structure, delegate blocs, and the fear of your phone call.',
  },
  {
    id: 'exile',
    label: 'The exile',
    trigger: 'Leave under a probe you can outrun, with a passport you can use.',
    play: 'A lobby in London or Dubai, remittances back to the ward, and a foundation with a good name.',
    retains: 'Money abroad, a diaspora press, and the ability to fund a candidate you never meet.',
  },
  {
    id: 'prosecution',
    label: 'The prosecution',
    trigger: 'Leave under an EFCC or ICPC probe that the next government keeps alive.',
    play: 'A docket, a forfeiture order, and a trial that is adjourned every time you run for something.',
    retains: 'The court list, the press, and — if the case dies — the reconstruction of the record.',
  },
]

/** The career page for the desk brief: this rung, the next one, and the three ways off. */
export function careerBrief(officeId: string): string[] {
  const rung = rungFor(officeId)
  const up = nextRung(officeId)
  const lines: string[] = []
  if (rung) {
    lines.push(`YOU ARE ON — ${rung.label}: ${rung.gives}`)
    lines.push(`WHAT IT COSTS — ${rung.costs}`)
  }
  lines.push(
    up
      ? `NEXT RUNG — ${up.label}: ${up.gives}`
      : 'NEXT RUNG — none. The ladder ends at the Villa; what follows is a fall or a second term.',
  )
  lines.push(`THE WAYS OFF — ${CAREER_FALLS.map((f) => f.label).join(' · ')}.`)
  for (const f of CAREER_FALLS) lines.push(`• ${f.label}: ${f.trigger} ${f.retains}`)
  return lines
}

/** Which rung the office sits on — used to decide what the next climb is. */
export function rungFor(officeId: string): CareerRung | undefined {
  return CAREER_LADDER.find((r) => r.officeId === officeId)
}

/** The rung above, if the current office is on the ladder at all. */
export function nextRung(officeId: string): CareerRung | undefined {
  const i = CAREER_LADDER.findIndex((r) => r.officeId === officeId)
  return i >= 0 ? CAREER_LADDER[i + 1] : undefined
}
