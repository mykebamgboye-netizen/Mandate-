/* @mandate/sim/names — the cast's naming engine.
 *
 * The federation is procedural, so the 250 key actors must be generated, never
 * hand-listed. Names are drawn from regional pools (the six geopolitical zones) so a
 * Katsina godfather never sounds like an Owerri party chairman. Everything here is
 * deterministic given a stream: the same seed always produces the same cast.
 *
 * No real politician is named, and no real party appears — see parties.ts.
 */

import { pick, chanceBp, pickIndex } from './rng'
import type { FederationStateRow } from './geo'

export type Zone = 'NC' | 'NE' | 'NW' | 'SE' | 'SS' | 'SW'
export const ZONES: readonly Zone[] = ['NC', 'NE', 'NW', 'SE', 'SS', 'SW']

interface NamePool {
  given: readonly string[]
  family: readonly string[]
  /** honorifics that read naturally in the region, drawn occasionally */
  titles: readonly string[]
}

const POOLS: Record<Zone, NamePool> = {
  NW: {
    given: ['Musa', 'Ibrahim', 'Sani', 'Aminu', 'Kabir', 'Yusuf', 'Bashir', 'Nasir', 'Sule', 'Haruna', 'Zubairu', 'Lawal', 'Garba', 'Bello', 'Umar', 'Ahmad', 'Sabiu', 'Tijani', 'Aisha', 'Hadiza', 'Zainab', 'Fatima', 'Hauwa', 'Maryam'],
    family: ['Danladi', 'Maikano', 'Bala', 'Abubakar', 'Suleiman', 'Othman', 'Katsina', 'Argungu', 'Gwandu', 'Kazaure', 'Rano', 'Birnin', 'Sokoto', 'Daura', 'Zaria', 'Illela', 'Bagudu', 'Marafa', 'Kangiwa', 'Talata', 'Kaduna', 'Zamfara'],
    titles: ['Alhaji', 'Malam', 'Engr', 'Dr', 'Hon'],
  },
  NE: {
    given: ['Baba', 'Modu', 'Garba', 'Umaru', 'Adamu', 'Yakubu', 'Idris', 'Saleh', 'Ali', 'Jibrin', 'Sani', 'Buka', 'Mustapha', 'Hamman', 'Ngamdu', 'Zara', 'Halima', 'Rukayya', 'Fadimatu', 'Talatu'],
    family: ['Sheriff', 'Ngamdu', 'Gulani', 'Kyari', 'Biu', 'Gongola', 'Waziri', 'Tella', 'Kukawa', 'Dikwa', 'Numan', 'Ganye', 'Damaturu', 'Potiskum', 'Wukari', 'Billiri', 'Bama', 'Damboa', 'Yola', 'Mubi'],
    titles: ['Alhaji', 'Malam', 'Hon', 'Barr', 'Dr'],
  },
  NC: {
    given: ['Terver', 'Iorwuese', 'Aondofa', 'Doosuur', 'James', 'Praise', 'Emma', 'Onesimus', 'Ruth', 'Emeka', 'Joseph', 'Sule', 'Habila', 'Nehemiah', 'Alfred', 'Grace', 'Nathaniel', 'Zainab'],
    family: ['Ityavkase', 'Akpera', 'Ankpa', 'Ochigbo', 'Adaji', 'Onoja', 'Achimugu', 'Enemali', 'Abagye', 'Tarka', 'Idris', 'Danjuma', 'Ochedi', 'Likita', 'Bature', 'Kagarko'],
    titles: ['Dr', 'Prof', 'Hon', 'Engr', 'Barr'],
  },
  SE: {
    given: ['Chinedu', 'Emeka', 'Obinna', 'Ifeanyi', 'Nnamdi', 'Uchenna', 'Chidiebere', 'Okey', 'Ngozi', 'Adaeze', 'Ijeoma', 'Chiamaka', 'Kelechi', 'Ebuka', 'Somto', 'Ndidi'],
    family: ['Okafor', 'Nwosu', 'Eze', 'Chukwu', 'Obi', 'Nnamani', 'Umeh', 'Okonkwo', 'Agu', 'Onyeka', 'Maduka', 'Ibeh', 'Nwigwe', 'Anyanwu', 'Ude', 'Ogbonna', 'Ekwueme', 'Ofodile'],
    titles: ['Dr', 'Engr', 'Prof', 'Barr', 'Chief'],
  },
  SS: {
    given: ['Oghenekaro', 'Efe', 'Tare', 'Boma', 'Tonye', 'Preye', 'Ibinabo', 'Ebiye', 'Osaro', 'Ufuoma', 'Tamunotonye', 'Idongesit', 'Bright', 'Ese', 'Oghenero', 'Biebele'],
    family: ['Akpan', 'Etim', 'Okon', 'Briggs', 'Dokubo', 'Amos', 'Ekpe', 'Oyibo', 'Ibru', 'Edevbie', 'Oritsejafor', 'Toyo', 'Akpore', 'Agbe', 'Ogbe', 'Ojo', 'Enahoro', 'Ikpimi'],
    titles: ['Chief', 'Dr', 'Engr', 'Hon', 'Barr'],
  },
  SW: {
    given: ['Adebayo', 'Olumide', 'Tunde', 'Kayode', 'Segun', 'Ayodele', 'Bukola', 'Wale', 'Folake', 'Adunni', 'Titilayo', 'Bamidele', 'Gbenga', 'Kunle', 'Ronke', 'Yewande'],
    family: ['Adeleke', 'Ogunleye', 'Akinola', 'Balogun', 'Oyelaran', 'Fashola', 'Ajayi', 'Oladipo', 'Akintunde', 'Ogunbiyi', 'Ademola', 'Salami', 'Obafemi', 'Olanrewaju', 'Esho', 'Adeyemi'],
    titles: ['Chief', 'Dr', 'Prof', 'Barr', 'Hon'],
  },
}

export interface GeneratedName {
  /** display form, e.g. "Chief Bola Adeleke" or "Dr Ijeoma Nwosu" */
  name: string
  given: string
  family: string
  /** "Bamidele Adeleke" → "BA" (the desk's handle convention) */
  initials: string
  title: string | null
}

/** Initials from a display name: first letters of the last two name parts. */
export function initialsOf(given: string, family: string): string {
  const a = given.trim().charAt(0)
  const b = family.trim().charAt(0)
  return `${a}${b}`.toUpperCase()
}

export function pickName(
  next: () => number,
  zone: Zone,
  opts: { femaleBp?: number; titleBp?: number } = {},
): GeneratedName {
  const pool = POOLS[zone]
  // each pool's given names are split in half: masculine first, feminine second
  const feminineFrom = pool.given.length - Math.floor(pool.given.length / 2)
  const given = chanceBp(next, opts.femaleBp ?? 3000)
    ? pool.given[feminineFrom + pickIndex(next, pool.given.length - feminineFrom)]!
    : pool.given[pickIndex(next, feminineFrom)]!
  const family = pick(next, pool.family)
  const withTitle = chanceBp(next, opts.titleBp ?? 2500)
  const title = withTitle ? pick(next, pool.titles) : null
  return {
    name: title ? `${title} ${given} ${family}` : `${given} ${family}`,
    given,
    family,
    initials: initialsOf(given, family),
    title,
  }
}

/** The zone an actor is from, derived from their home state. */
export function zoneOfState(state: FederationStateRow | undefined): Zone {
  const z = state?.zone
  return (z === 'NC' || z === 'NE' || z === 'NW' || z === 'SE' || z === 'SS' || z === 'SW') ? z : 'NC'
}

/** Short form used by the press and the desk: "B. Adeleke". */
export function shortName(n: GeneratedName): string {
  return `${n.given.charAt(0)}. ${n.family}`
}
