// @mandate/profile/profile-sheet — renders a candidate Profile as the onboarding one-pager
// ("INFORMATION + vetting"). Decoupled from React so App.tsx can own the UI while this file
// owns the sheet shape and the prologue→sheet derivation.

import type { FederationOffice } from './types'
import { normalizeAxes } from './schema'

export interface ProfileSheet {
  name: string
  handle: string
  state: string
  /** 'STATE' normally; 'SEAT' for nationwide posts (the President sits in Abuja) */
  stateLabel: string
  capital: string
  lga: string | null
  district: string | null
  age: string
  office: string
  post: string
  route: string
  termStart: string
  party: string
  partyCode: string | null
  defectionRisk: string
  patronageBank: string
  axes: { label: string; value: string; band: string }[]
  patrons: { name: string; role: string; loyalty: string }[]
}

function bpBand(bp: number): string {
  if (bp < 2000) return 'LOW'
  if (bp < 4500) return 'WEAK'
  if (bp < 6500) return 'EVEN'
  if (bp < 8500) return 'STRONG'
  return 'HIGH'
}

function toneBand(bp: number): string {
  if (bp < -6000) return 'HOSTILE'
  if (bp < -2000) return 'COLD'
  if (bp < 2000) return 'EVEN'
  if (bp < 6000) return 'WARM'
  return 'SUPPORTIVE'
}

export function sheetFromAxes(
  axes: ReturnType<typeof normalizeAxes>,
  patronageBank: number,
  patron: { name: string; role: string; loyalty: number } | undefined,
  stateName: string,
  stateCapital: string,
  office: FederationOffice,
  partyName: string | null,
  name: string,
  age: string | null,
  lgaName?: string | null,
): ProfileSheet {
  const axesRows = [
    { label: 'COMPETENCE', value: axes.competence.toFixed(0), band: bpBand(axes.competence) },
    { label: 'INTEGRITY', value: axes.integrity.toFixed(0), band: bpBand(axes.integrity) },
    { label: 'POPULAR SUPPORT', value: axes.popularSupport.toFixed(0), band: bpBand(axes.popularSupport) },
    { label: 'PARTY LOYALTY', value: axes.partyLoyalty.toFixed(0), band: bpBand(axes.partyLoyalty) },
    { label: 'ELITE TRUST', value: axes.eliteTrust.toFixed(0), band: bpBand(axes.eliteTrust) },
    { label: 'PRESS TONE', value: (axes.pressTone >= 0 ? '+' : '') + axes.pressTone.toFixed(0), band: toneBand(axes.pressTone) },
    { label: 'CONSTITUENCY ALIGNMENT', value: axes.constituencyAlignment.toFixed(0), band: bpBand(axes.constituencyAlignment) },
    { label: 'PATRONAGE BANK', value: patronageBank.toLocaleString('en-NG'), band: patronageBank >= 1_000_000_000 ? 'STRONG' : patronageBank >= 100_000_000 ? 'EVEN' : 'WEAK' },
    { label: 'MANDATE LEGITIMACY', value: axes.mandateLegitimacy.toFixed(0), band: bpBand(axes.mandateLegitimacy) },
    { label: 'INSTITUTIONAL MEMORY', value: axes.institutionalMemory.toFixed(0), band: bpBand(axes.institutionalMemory) },
  ]

  const patrons: { name: string; role: string; loyalty: string }[] = []
  if (patron) {
    patrons.push({ name: patron.name, role: patron.role, loyalty: patron.loyalty.toString() })
  }

  /* Each tier names its own government — a President does not run a 'STATE GOVERNMENT'. */
  const officeLabel: string =
    office.tier === 'federal' ? 'FEDERAL GOVERNMENT'
    : office.tier === 'fct' ? 'FCT ADMINISTRATION'
    : office.tier === 'local' ? 'LOCAL GOVERNMENT'
    : 'STATE GOVERNMENT'
  /* A nationwide post has a seat, not a state: the President governs from Abuja. */
  const stateLabel = office.jurisdiction === 'nation' ? 'SEAT' : 'STATE'

  return {
    name,
    handle: name.trim().split(/\s+/).map(s => s[0]).join('').toUpperCase().slice(0, 4) || 'PROF',
    state: stateName,
    stateLabel,
    capital: stateCapital,
    lga: lgaName ?? null,
    district: null,
    age: age ?? '—',
    office: officeLabel,
    post: office.post,
    route: office.route.toUpperCase(),
    termStart: '—',
    party: partyName ?? 'INDEPENDENT',
    partyCode: partyName ?? null,
    defectionRisk: '—',
    patronageBank: patronageBank.toLocaleString('en-NG'),
    axes: axesRows,
    patrons,
  }
}

// Re-derives the candidate axes from a completed prologue (origin + bringer + scar), plus any
// candidate-provided baseline. This is the function the prologue step calls before rendering the sheet.
export function prologueAxes(
  base: ReturnType<typeof normalizeAxes>,
  originDeltas: Partial<Record<keyof ReturnType<typeof normalizeAxes>, number>>,
  bringerDeltas: Partial<Record<keyof ReturnType<typeof normalizeAxes>, number>>,
  scarDeltas: Partial<Record<keyof ReturnType<typeof normalizeAxes>, number>>,
  bringerPatronage: number,
): ReturnType<typeof normalizeAxes> {
  const raw = normalizeAxes(base)
  const apply = (deltas: Partial<Record<keyof ReturnType<typeof normalizeAxes>, number>>) => {
    for (const k of Object.keys(deltas) as Array<keyof ReturnType<typeof normalizeAxes>>) {
      const v = deltas[k]
      if (typeof v === 'number') {
        if (k === 'pressTone') {
          raw.pressTone = Math.max(-10000, Math.min(10000, raw.pressTone + v))
        } else if (k === 'patronageBank') {
          raw.patronageBank = Math.max(0, raw.patronageBank + v)
        } else {
          raw[k] = Math.max(0, Math.min(10000, raw[k] + v))
        }
      }
    }
  }
  apply(originDeltas)
  apply(bringerDeltas)
  apply(scarDeltas)
  raw.patronageBank = Math.max(0, raw.patronageBank + bringerPatronage)
  return raw
}

// Keep a small local helper so onboarding can mirror the schema-layer starting bank.
export function startingPatronageBankForOffice(_officeId: string, _stateCode: string): number {
  return 0
}
