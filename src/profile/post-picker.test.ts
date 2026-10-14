// Guards for the post picker (§federation): only catalogue offices marked playable are
// offered, and each post decides what the player still has to choose — nothing (President,
// FCT Minister), a state (Governor), or a state then an LGA (Chairman).
import { describe, expect, it } from 'vitest'
import { ensureReferenceOffices, postRoute, selectableOffices, stateChoicesFor, startingOfficeForState } from './profile-state'
import { sheetFromAxes } from './profile-sheet'
import { normalizeAxes } from './schema'
import { defaultFederationReference } from './client'
import { FCT_MINISTER_OFFICE as FCT_MIN } from './delta-tutorial'
import { PLAYABLE_OFFICES, PRESIDENT_OFFICE, LGA_CHAIRMAN_OFFICE, TIER_ORDER } from './playable-offices'
import { DELTA_TUTORIAL_OFFICE, FCT_MINISTER_OFFICE } from './delta-tutorial'
import type { FederationState } from './types'

const states: FederationState[] = [
  { code: 'DT', name: 'Delta', capital: 'Asaba', tier: 'state', zone: 'South-South', senatorialDistricts: null },
  { code: 'KN', name: 'Kano', capital: 'Kano', tier: 'state', zone: 'North-West', senatorialDistricts: null },
  { code: 'FC', name: 'FCT', capital: 'Abuja', tier: 'fct', zone: null, senatorialDistricts: null },
]

describe('the playable post set', () => {
  it('offers one executive per tier plus the FCT minister', () => {
    expect(PLAYABLE_OFFICES.map(o => o.id).sort()).toEqual(
      ['fct/minister', 'federal/president', 'local/chairman', 'state/governor'],
    )
    expect(PLAYABLE_OFFICES.every(o => o.playable)).toBe(true)
    expect(TIER_ORDER).toEqual(['federal', 'state', 'fct', 'local'])
  })

  it('prefers the database flag when the catalogue carries one', () => {
    const dbRows = [
      { ...PRESIDENT_OFFICE, playable: true },
      { ...FCT_MINISTER_OFFICE, playable: true },
      { ...DELTA_TUTORIAL_OFFICE, playable: false },
    ]
    expect(selectableOffices(dbRows).map(o => o.id)).toEqual(['federal/president', 'fct/minister'])
  })

  it('falls back to the canonical set when no row is flagged (un-migrated database)', () => {
    const unmarked = PLAYABLE_OFFICES.map(({ playable: _p, ...rest }) => rest)
    expect(selectableOffices(unmarked)).toHaveLength(4)
  })

  it('offers all four posts from the offline reference — Governor and FCT included', () => {
    // Regression: ensureReferenceOffices merged the canonical rows in, but the two rows the
    // offline reference already carried (Governor, FCT Minister) went in un-flagged, so the
    // picker saw a partial playable set and silently dropped half the cards.
    const offices = ensureReferenceOffices(defaultFederationReference.offices)
    expect(selectableOffices(offices).map(o => o.id).sort()).toEqual(
      ['fct/minister', 'federal/president', 'local/chairman', 'state/governor'],
    )
  })
})

describe('each post routes to the right jurisdiction step', () => {
  it('President is nationwide — the seat is the FCT, nothing to pick', () => {
    expect(postRoute(PRESIDENT_OFFICE)).toEqual({ kind: 'direct', stateCode: 'FC' })
  })

  it('the FCT Minister administers the territory — appointed, nothing to pick', () => {
    expect(postRoute(FCT_MINISTER_OFFICE)).toEqual({ kind: 'direct', stateCode: 'FC' })
    expect(FCT_MINISTER_OFFICE.route).toBe('appointed')
  })

  it('a Governor picks one of the 36 states, never the FCT', () => {
    expect(postRoute(DELTA_TUTORIAL_OFFICE)).toEqual({ kind: 'state' })
    expect(stateChoicesFor(DELTA_TUTORIAL_OFFICE, states).map(s => s.code)).toEqual(['DT', 'KN'])
    expect(startingOfficeForState('FC')).toBe('fct/minister')
  })

  it('each tier names its own government, and a nationwide post has a seat', () => {
    const sheetFor = (office: Parameters<typeof sheetFromAxes>[5]) =>
      sheetFromAxes(normalizeAxes({}), 0, undefined, 'FCT', 'Abuja', office, 'APC', 'A. Tester', '34')
    expect(sheetFor(PRESIDENT_OFFICE).office).toBe('FEDERAL GOVERNMENT')
    expect(sheetFor(PRESIDENT_OFFICE).stateLabel).toBe('SEAT')
    expect(sheetFor(DELTA_TUTORIAL_OFFICE).office).toBe('STATE GOVERNMENT')
    expect(sheetFor(DELTA_TUTORIAL_OFFICE).stateLabel).toBe('STATE')
    expect(sheetFor(FCT_MIN).office).toBe('FCT ADMINISTRATION')
    expect(sheetFor(LGA_CHAIRMAN_OFFICE).office).toBe('LOCAL GOVERNMENT')
  })

  it('an LGA Chairman picks a state, then a council within it', () => {
    expect(postRoute(LGA_CHAIRMAN_OFFICE)).toEqual({ kind: 'state-then-lga' })
    expect(stateChoicesFor(LGA_CHAIRMAN_OFFICE, states).map(s => s.code)).toEqual(['DT', 'KN', 'FC'])
  })
})
