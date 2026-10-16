/* @mandate/sim/media.ts — the press.
 *
 * Twelve outlets with owners, reach, a party bias vector and a price per story. The press
 * is a market: planting a story costs money, the bias decides whose frame it carries, and
 * the same outlet can be bought by a rival next week. Names are fictional.
 */

import { sfc32, subSeed, hash32, randInt, pick, chanceBp } from './rng'
import type { Party } from './parties'

export interface MediaOutlet {
  id: string
  name: string
  /** who owns it — an NPC id, or null for a reader-owned/cooperative masthead */
  ownerId: string | null
  /** audience, in thousands of readers/viewers */
  reachThousands: number
  /** bias per party code, -100 (hostile) .. +100 (friendly) */
  bias: Record<string, number>
  /** ₦ per planted story */
  pricePerStory: number
  /** how far a story travels to the other outlets, bp */
  syndicationBp: number
}

const OUTLET_NAMES: readonly string[] = [
  'The Gazette', 'Sapele Times', 'The National Ledger', 'Continental Monitor',
  'The Daily Marker', 'Northern Star', 'Delta Dispatch', 'The Republic',
  'Ward & Country', 'The Capital Post', 'First Draft', 'The Evening Broom',
]

export function generateMedia(seed: number, parties: readonly Party[]): MediaOutlet[] {
  const next = sfc32(
    subSeed(seed, 'media'),
    hash32('media:a'),
    hash32('media:b'),
    hash32('media:c'),
  )
  return OUTLET_NAMES.map((name, i) => {
    const favourite = pick(next, parties)
    const hostile = pick(next, parties)
    const bias: Record<string, number> = {}
    for (const p of parties) bias[p.code] = randInt(next, -55, 15)
    bias[favourite.code] = randInt(next, 30, 85)
    bias[hostile.code] = randInt(next, -90, -45)
    // a quarter of the market is reader-owned / cooperative and cannot be bought outright
    const coop = chanceBp(next, 2500)
    return {
      id: `media/${i + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      ownerId: coop ? null : '',
      reachThousands: randInt(next, 40, 1800),
      bias,
      pricePerStory: randInt(next, 2, 40) * 1_000_000,
      syndicationBp: randInt(next, 1500, 8500),
    }
  })
}

/** The outlet most willing to carry a story for a party — tie-broken by reach, then id. */
export function friendliestOutlet(media: readonly MediaOutlet[], partyCode: string | null): MediaOutlet | null {
  if (media.length === 0) return null
  const ranked = [...media].sort((a, b) => {
    const ba = partyCode ? (a.bias[partyCode] ?? 0) : 0
    const bb = partyCode ? (b.bias[partyCode] ?? 0) : 0
    if (bb !== ba) return bb - ba
    if (b.reachThousands !== a.reachThousands) return b.reachThousands - a.reachThousands
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return ranked[0] ?? null
}

/** The outlet most hostile to a party — used when a leak needs somewhere to land. */
export function harshestOutlet(media: readonly MediaOutlet[], partyCode: string | null): MediaOutlet | null {
  if (media.length === 0) return null
  return media.reduce((worst, m) => {
    const w = partyCode ? (worst.bias[partyCode] ?? 0) : 0
    const c = partyCode ? (m.bias[partyCode] ?? 0) : 0
    return c < w ? m : worst
  }, media[0]!)
}
