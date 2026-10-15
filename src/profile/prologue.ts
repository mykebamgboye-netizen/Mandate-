// @mandate/profile/prologue — first-open "who are you" choices that set a starting profile.
// Pattern: a short prologue (Suzerain-style), not a form. Choices map onto the profile axes
// so the first opening feels intentional and the profile is already shaped by the moment the
// player enters the desk.

import type { ProfileOffice, ProfileAxes, ProfileIdentity } from './types'
import { normalizeAxes } from './schema'

export type Origin = 'civil-service' | 'party-youth' | 'business' | 'activist'

export interface OriginChoice {
  id: Origin
  label: string
  sub: string
  deltas: Partial<Record<keyof ProfileAxes, number>>
  patron?: { name: string; role: string; loyalty: number }
}

export const ORIGINS: OriginChoice[] = [
  {
    id: 'civil-service',
    label: 'Civil service',
    sub: 'You came up through the ministries — papers, procedure, patience.',
    deltas: {
      competence: 800,
      institutionalMemory: 1200,
      partyLoyalty: -400,
    },
    patron: { name: 'The Head of Service', role: 'Permanent Secretary', loyalty: 4 },
  },
  {
    id: 'party-youth',
    label: 'Party youth wing',
    sub: 'You built turnout on the streets and the party machine knows your name.',
    deltas: {
      popularSupport: 900,
      partyLoyalty: 1000,
      pressTone: 200,
    },
    patron: { name: 'State Party Chairman', role: 'Party Chairman', loyalty: 4 },
  },
  {
    id: 'business',
    label: 'Business / contracts',
    sub: 'You know where the money moves and who holds the purse strings.',
    deltas: {
      competence: 400,
      eliteTrust: 700,
    },
    patron: { name: 'A Godfather', role: 'Party Elder', loyalty: 3 },
  },
  {
    id: 'activist',
    label: 'Activist / civil society',
    sub: 'You cut your teeth outside the system — that cuts both ways inside it.',
    deltas: {
      integrity: 800,
      popularSupport: 600,
      partyLoyalty: -600,
      eliteTrust: -500,
    },
  },
]

export type Bringer = 'godfather' | 'grassroots' | 'technocrat'

export interface BringerChoice {
  id: Bringer
  label: string
  sub: string
  deltas: Partial<Record<keyof ProfileAxes, number>>
}

export const BRINGERS: BringerChoice[] = [
  {
    id: 'godfather',
    label: 'A godfather brought you',
    sub: 'You owe someone. That is the price of the ticket.',
    deltas: {
      partyLoyalty: -500,
      eliteTrust: 1200,
      patronageBank: 1_000_000_000,
    },
  },
  {
    id: 'grassroots',
    label: 'The grassroots brought you',
    sub: 'No patron, no machine — just a crowd that showed up.',
    deltas: {
      popularSupport: 1000,
      partyLoyalty: 400,
      integrity: 300,
    },
  },
  {
    id: 'technocrat',
    label: 'A technocrat slate',
    sub: 'You were drafted for delivery, not loyalty. People will test that.',
    deltas: {
      competence: 1000,
      mandateLegitimacy: 500,
      popularSupport: -300,
    },
  },
]

export type FirstScar = 'none' | 'contract-query' | 'protest'

export interface ScarChoice {
  id: FirstScar
  label: string
  sub: string
  deltas: Partial<Record<keyof ProfileAxes, number>>
}

export const FIRST_SCARS: ScarChoice[] = [
  {
    id: 'none',
    label: 'No scar yet',
    sub: 'They say clean hands are rare — yours are still clean.',
    deltas: {
      integrity: 400,
      pressTone: 200,
      mandateLegitimacy: 200,
    },
  },
  {
    id: 'contract-query',
    label: 'One contract query, long settled',
    sub: 'A procurement file was inspected and closed. It still lives in someone\'s drawer.',
    deltas: {
      integrity: -300,
      institutionalMemory: 500,
      pressTone: -200,
    },
  },
  {
    id: 'protest',
    label: 'A protest you rode out',
    sub: 'A street pushed you; you did not break. They remember how you held.',
    deltas: {
      popularSupport: 600,
      integrity: -200,
      pressTone: -400,
    },
  },
]

/* ---------- mechanical explainers, for the prologue screen ----------
   Each choice quietly applies basis-point deltas to the profile axes; the
   sub-line carries the fiction but not the numbers. The chips make the
   mechanics visible at the exact moment the player commits to them. */

export const AXIS_EFFECT_LABEL: Partial<Record<keyof ProfileAxes, string>> = {
  competence: 'Competence',
  integrity: 'Integrity',
  popularSupport: 'Popular support',
  partyLoyalty: 'Party loyalty',
  eliteTrust: 'Elite trust',
  pressTone: 'Press tone',
  constituencyAlignment: 'Constituency alignment',
  mandateLegitimacy: 'Mandate legitimacy',
  institutionalMemory: 'Institutional memory',
}

export function effectChips(
  deltas: Partial<Record<keyof ProfileAxes, number>>,
  patron?: { name: string; role: string; loyalty: number },
): string[] {
  const chips: string[] = []
  for (const k of Object.keys(deltas) as Array<keyof ProfileAxes>) {
    const v = deltas[k]
    if (typeof v !== 'number' || v === 0) continue
    if (k === 'patronageBank') {
      chips.push('+₦' + v.toLocaleString('en-NG') + ' to the patronage bank')
      continue
    }
    const label = AXIS_EFFECT_LABEL[k] ?? k
    const points = Math.round(v / 100)
    const sign = v > 0 ? '+' : '−'
    chips.push(`${sign}${Math.abs(points)} ${label}`)
  }
  if (patron) {
    chips.push(`A patron — ${patron.name} (${patron.role}, loyalty ${patron.loyalty}/5)`)
  }
  return chips
}

// Apply a prologue to a candidate profile object (client-side before the DB write).
export function applyPrologue(
  base: ProfileOffice,
  identity: ProfileIdentity,
  partyCode: string | null,
  origin: Origin,
  bringer: Bringer,
  scar: FirstScar,
): {
  office: ProfileOffice
  identity: ProfileIdentity
  party: {
    current: string | null
    history: { party: string; window: string }[]
    defectionRisk: number
  }
  axes: ProfileAxes
  patronageBank: number
  patron?: { name: string; role: string; loyalty: number }
} {
  const raw = normalizeAxes({})
  const apply = (deltas: Partial<Record<keyof ProfileAxes, number>>) => {
    for (const k of Object.keys(deltas) as Array<keyof ProfileAxes>) {
      const v = deltas[k]
      if (typeof v === 'number') {
        const cur = raw[k]
        raw[k] = k === 'pressTone' ? cur + v : Math.max(0, Math.min(10000, cur + v))
      }
    }
  }
  apply(ORIGINS.find(o => o.id === origin)!.deltas)
  apply(BRINGERS.find(b => b.id === bringer)!.deltas)
  apply(FIRST_SCARS.find(s => s.id === scar)!.deltas)

  // patronageBank is naira, summed separately.
  const patronageBank = raw.patronageBank
  delete (raw as any).patronageBank

  const patron = ORIGINS.find(o => o.id === origin)?.patron

  const partyHistory: { party: string; window: string }[] = []
  if (partyCode && bringer === 'godfather') {
    partyHistory.push({ party: partyCode, window: 'prior term' })
  } else if (partyCode && (bringer === 'technocrat' || bringer === 'grassroots')) {
    partyHistory.push({ party: partyCode, window: 'prior term' })
  }

  return {
    office: base,
    identity: identity as ProfileIdentity,
    party: {
      current: partyCode,
      history: partyHistory,
      defectionRisk: bringer === 'godfather' ? 0.35 : bringer === 'grassroots' ? 0.15 : 0.22,
    },
    axes: raw,
    patronageBank,
    patron,
  }
}


export const PARTIES: { id: string; name: string; note: string }[] = [
  { id: 'APC', name: 'All Progressives Congress', note: 'now ruling — the machine the outgoing aide rode.' },
  { id: 'LP', name: 'Labour Party', note: 'the new organizing base, the one you can break or ride.' },
  { id: 'PDP', name: 'People’s Democratic Party', note: 'the old opposition — institutional memory, still deep pockets.' },
  { id: 'NNP', name: 'National Rescue Party', note: 'a smaller current — clean break or ghost coalition.' },
  { id: 'APGA', name: 'All Progressives Grand Alliance', note: 'regional spine, faith-faithful, hard to swamp.' },
]
