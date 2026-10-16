/* @mandate/components/atlas/atlas-data — the Position Atlas, as data.
 *
 * The catalogue holds 10,192 seats; a phone cannot render all of them, and neither should
 * an SSR pass. So the atlas is built per tier, most senior first, with a row cap and the
 * remainder reported as a number — never silently dropped.
 *
 * Holders come from the living world: the 250 key actors hold the senior seats, and every
 * other seat resolves to a named background holder generated from the same seed. Nothing
 * here reads the DOM, the clock or Math.random.
 */

import { POSITIONS, POSITION_COUNTS, type Position, type PositionCounts, type PositionTier } from '../../sim/positions'
import { generateParties } from '../../sim/parties'
import { generateKeyCast, holderOf, seniorityRank } from '../../sim/npcs'

export const ATLAS_TIER_ORDER: readonly PositionTier[] = ['federal', 'state', 'lga', 'ward']

export const ATLAS_TIER_LABEL: Record<PositionTier, string> = {
  federal: 'Federal',
  state: 'State',
  lga: 'Local Government',
  ward: 'Ward',
}

/** What each tier is for, in one line, for the atlas header. */
export const ATLAS_TIER_NOTE: Record<PositionTier, string> = {
  federal: 'The President, the National Assembly, the ministries.',
  state: '36 governorships, their deputies and the state houses.',
  lga: 'One chairman for each of the 774 councils.',
  ward: 'The ward councillors — where every machine is actually built.',
}

export interface AtlasSeat {
  id: string
  title: string
  jurisdiction: string
  termYears: number
  salaryMonthly: number
  campaignCostNaira: number
  faacShare: number
  appointmentType: Position['appointmentType']
  powers: string[]
  /** who holds it today */
  holderName: string
  holderParty: string
  /** true when the holder is one of the 250 key actors the weekly loop runs */
  holderIsKey: boolean
}

export interface AtlasSection {
  tier: PositionTier
  label: string
  note: string
  /** seats of this tier in the catalogue */
  total: number
  /** seats rendered */
  shown: number
  seats: AtlasSeat[]
}

export interface Atlas {
  seed: number
  counts: PositionCounts
  sections: AtlasSection[]
}

export interface AtlasOptions {
  seed: number
  /** rows per tier */
  rowLimit?: number
  positions?: readonly Position[]
}

export function buildAtlas(opts: AtlasOptions): Atlas {
  const positions = opts.positions ?? POSITIONS
  const rowLimit = Math.max(1, opts.rowLimit ?? 6)
  const parties = generateParties(opts.seed)
  const cast = generateKeyCast(opts.seed, positions, parties)
  const heldByKey = new Map<string, { name: string; party: string }>()
  for (const npc of cast) {
    if (npc.positionId) heldByKey.set(npc.positionId, { name: npc.name, party: npc.partyCode ?? '' })
  }

  const sections = ATLAS_TIER_ORDER.map(tier => {
    const all = positions.filter(p => p.tier === tier)
    const ordered = [...all].sort((a, b) => seniorityRank(b) - seniorityRank(a) || (a.id < b.id ? -1 : 1))
    const shown = ordered.slice(0, rowLimit)
    const seats: AtlasSeat[] = shown.map(position => {
      const key = heldByKey.get(position.id)
      const background = key ? null : holderOf(opts.seed, position, [], parties)
      const holder = { name: key?.name ?? background!.name, party: key?.party ?? background!.partyCode }
      return {
        id: position.id,
        title: position.title,
        jurisdiction: position.jurisdiction,
        termYears: position.termYears,
        salaryMonthly: position.salaryMonthly,
        campaignCostNaira: position.campaignCostNaira,
        faacShare: position.faacShare,
        appointmentType: position.appointmentType,
        powers: position.powers,
        holderName: holder.name,
        holderParty: holder.party,
        holderIsKey: Boolean(key),
      }
    })
    return {
      tier,
      label: ATLAS_TIER_LABEL[tier],
      note: ATLAS_TIER_NOTE[tier],
      total: all.length,
      shown: seats.length,
      seats,
    }
  })

  return { seed: opts.seed, counts: POSITION_COUNTS, sections }
}

/** 10192 → "10,192". Hand-grouped so the copy never depends on ICU locale data. */
export function groupDigits(n: number): string {
  const s = Math.abs(Math.trunc(n)).toString()
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ','
    out += s[i]
  }
  return n < 0 ? `-${out}` : out
}

/** The header line: "10,192 seats · 1,245 playable on day one". */
export function atlasHeadline(counts: PositionCounts): string {
  return `${groupDigits(counts.total)} seats · ${groupDigits(counts.playableCore)} playable on day one`
}

/** Every seat of a tier, in atlas order — for a search or a scroll that needs the lot. */
export function seatsOfTier(tier: PositionTier, positions: readonly Position[] = POSITIONS): Position[] {
  return positions.filter(p => p.tier === tier).sort((a, b) => seniorityRank(b) - seniorityRank(a) || (a.id < b.id ? -1 : 1))
}
