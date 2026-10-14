/* MANDATE — the four axioms the rest of the model is built on.
   They are not decoration: each one names the code that enforces it, so a principle that
   stops being true has somewhere to fail. */

import type { AxisKey } from './profile/types'
import { AXIS_KEYS } from './profile/types'

export type PrincipleId =
  | 'politics_governance'
  | 'borrowed_power'
  | 'relationship_memory'
  | 'statehood'

export interface Principle {
  id: PrincipleId
  label: string
  line: string
  /** the modules that make the principle false-able if it ever stops holding */
  enforcedBy: string[]
  /** the record axes it is read through, where it has any */
  axes: AxisKey[]
}

/** The two tracks the first axiom separates: winning is not governing. */
export const TRACKS: { politics: AxisKey[]; governance: AxisKey[] } = {
  politics: ['popularSupport', 'partyLoyalty', 'eliteTrust', 'pressTone', 'patronageBank', 'mandateLegitimacy'],
  governance: ['competence', 'integrity', 'constituencyAlignment', 'institutionalMemory'],
}

export const CORE_PRINCIPLES: Principle[] = [
  {
    id: 'politics_governance',
    label: 'Politics ≠ Governance',
    line: 'Two tracks, scored apart. You can win an election you cannot administer, and administer a state you cannot hold.',
    enforcedBy: ['profile/types.AXIS_KEYS (two disjoint track sets)', 'sectors.POST_SECTOR_MATRIX (levers vs blame)'],
    axes: [...TRACKS.politics],
  },
  {
    id: 'borrowed_power',
    label: 'All power is borrowed',
    line: 'The 1999 Constitution limits apply: every seat holds what the instrument that created it grants, and nothing else.',
    enforcedBy: [
      'sectors.POST_SECTOR_MATRIX.cannotControl',
      'revenue.OFFICE_REVENUE (term caps s.135(2)/s.180(2); s.80; s.214; s.302)',
      'pressure (the executive paradox: no governor commands a Commissioner of Police)',
    ],
    axes: [],
  },
  {
    id: 'relationship_memory',
    label: 'Relationships have memory',
    line: 'Every ally keeps a ledger on you and prices the next favour against the last one paid.',
    enforcedBy: [
      'profile axes: eliteTrust · institutionalMemory · patronageBank',
      'scenario assets (the Fifth Schedule declarations carry trust and price ranges)',
      'career.CAREER_FALLS (patronage outlives the office)',
    ],
    axes: ['eliteTrust', 'institutionalMemory', 'patronageBank'],
  },
  {
    id: 'statehood',
    label: 'Statehood across twelve sectors',
    line: 'Capacity + legitimacy + autonomy, read across the twelve sectors — capacity is what you hold, legitimacy is what you are blamed for, autonomy is what the constitution keeps from you.',
    enforcedBy: ['sectors.SECTOR_IDS (12)', 'sectors.POST_SECTOR_MATRIX (controls / blamedFor / cannotControl)'],
    axes: ['mandateLegitimacy', 'competence'],
  },
]

/** The axioms, as the Desk Brief prints them. */
export function principleBrief(): string[] {
  return [
    'THE AXIOMS THIS DESK RUNS ON',
    ...CORE_PRINCIPLES.map((p) => `• ${p.label} — ${p.line}`),
  ]
}

export function principleFor(id: PrincipleId): Principle | undefined {
  return CORE_PRINCIPLES.find((p) => p.id === id)
}

/** Every axis that is on neither track would be a value nothing can move. */
export function untrackedAxes(): AxisKey[] {
  const on = new Set<AxisKey>([...TRACKS.politics, ...TRACKS.governance])
  return AXIS_KEYS.filter((k) => !on.has(k))
}
