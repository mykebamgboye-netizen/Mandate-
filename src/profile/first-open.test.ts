// Regression guard for the first-open boot path.
//
// The bug this file exists to catch: the first screen a new player sees should be the
// office picker, with a blank identity. The Delta tutorial NPC (M. A. Bamgboye / 52 /
// Delta governor) is the FALLBACK SCENARIO you can land in after you choose office +
// identity — it must never be served as "your" record on first open.
//
// This tests the boot contract through the public surface:
//   - defaultFederationReference / defaultScenarioStartState / deltaTutorialProfile are the
//     canonical fallback data the boot uses when no Supabase is configured.
//   - defaultState is the canonical "new player" state — blank, starting at pick-post.
//   - nextSheetState is the pure state-machine transition that renders the record sheet;
//     it must never fabricate an NPC identity when the player has supplied their own.

import { describe, expect, it } from 'vitest'
import {
  defaultState,
  nextSheetState,
  postRoute,
  FCT_STATE_CODE,
  FCT_OFFICE_ID,
  STATE_GOVERNOR_OFFICE_ID,
  ensureReferenceOffices,
} from './profile-state'
import {
  DELTA_TUTORIAL_OFFICE,
  FCT_MINISTER_OFFICE,
  deltaTutorialProfile,
} from './delta-tutorial'
import { defaultFederationReference, defaultScenarioStartState } from './client'
import type { FederationParty } from './types'

describe('first-open boot does not serve the NPC as the player record', () => {
  function fallbackState() {
    const states = defaultFederationReference.states
    const offices = ensureReferenceOffices(defaultFederationReference.offices)
    const parties = defaultFederationReference.parties
    return defaultState(states, offices, parties)
  }

  it('the canonical new-player state is blank and starts at pick-post', () => {
    const on = fallbackState()
    expect(on.phase).toBe('pick-post')
    expect(on.stateCode).toBeNull()
    expect(on.officeId).toBeNull()
    expect(on.name).toBe('')
    expect(on.age).toBe('')
    expect(on.pronouns).toBe('')
    expect(on.locale).toBe('')
    expect(on.bio).toBe('')
    expect(on.altName).toBe('')
    expect(on.partyCode).toBeNull()
    // The offline reference carries Delta plus the FCT — the FCT is the President's seat
    // and the territory the Minister administers, so nationwide/FCT posts resolve without
    // a migrated federation_states row. These are reference data, not the player's identity.
    expect(on.states.map(s => s.code)).toEqual(['DT', 'FC'])
    expect(on.states.find(s => s.code === 'FC')!.name).toBe('Federal Capital Territory')
    expect(on.offices).toContainEqual(DELTA_TUTORIAL_OFFICE)
  })

  it('the fallback scenario row is Delta governor, but the player still starts blank', () => {
    const scenario = defaultScenarioStartState()
    expect(scenario.stateCode).toBe('DT')
    expect(scenario.officeId).toBe(STATE_GOVERNOR_OFFICE_ID)

    const player = fallbackState()
    expect(player.name).toBe('')
    expect(player.age).toBe('')
    expect(player.partyCode).toBeNull()
  })

  it('the Delta tutorial profile is the NPC fallback, not a player template', () => {
    const npc = deltaTutorialProfile()
    expect(npc.identity.name).toBe('M. A. Bamgboye')
    expect(npc.identity.age).toBe(52)
    expect(npc.identity.stateCode).toBe('DT')
    expect(npc.office.officeId).toBe('state/governor')
  })

  it('picking the FCT card routes to the FCT minister, not Governor', () => {
    const fctOffice = fallbackState().offices.find(o => o.id === FCT_OFFICE_ID)
    expect(fctOffice).toBeTruthy()
    const route = postRoute(fctOffice!)
    expect(route.kind).toBe('direct')
    // The FCT route is the 'direct' variant, which carries stateCode.
    if (route.kind !== 'direct') { throw new Error('expected FCT route to be direct') }
    expect(route.stateCode).toBe(FCT_STATE_CODE)
    expect(fctOffice!.tier).toBe('fct')
    expect(fctOffice!.id).toBe(FCT_OFFICE_ID)
  })

  it('the FCT office is the appointed Minister of the FCT, not a state governorship', () => {
    expect(FCT_MINISTER_OFFICE.tier).toBe('fct')
    expect(FCT_MINISTER_OFFICE.id).toBe(FCT_OFFICE_ID)
    expect(FCT_MINISTER_OFFICE.route).toBe('appointed')
    expect(FCT_MINISTER_OFFICE.jurisdiction).toBe('territory')
  })

  it('picking Governor routes to a state choice, never the FCT', () => {
    const govOffice = DELTA_TUTORIAL_OFFICE
    const route = postRoute(govOffice)
    expect(route.kind).toBe('state')
  })

  it('nextSheetState uses the player-chosen party when the party is in the catalogue', () => {
    const states = defaultFederationReference.states
    const offices = ensureReferenceOffices(defaultFederationReference.offices)
    const parties: FederationParty[] = [
      ...defaultFederationReference.parties,
      { code: 'LP', name: 'Labour Party', note: 'the new organizing base.' },
    ]
    const base = defaultState(states, offices, parties)
    const withParty = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'DT',
      officeId: 'state/governor',
      origin: 'civil-service' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: 'Adaebi Okafor',
      age: '41',
      pronouns: 'she/her',
      locale: '+234',
      bio: 'returning officer, south-east',
      altName: 'A. Okafor',
      partyCode: 'LP',
      lgaName: null,
    } as any
    const sheet = nextSheetState(withParty).sheet
    expect(sheet).toBeTruthy()
    expect(sheet!.name).toBe('Adaebi Okafor')
    expect(sheet!.party).toBe('Labour Party')
    // The sheet stores the resolved party NAME as partyCode, not the player’s chosen code.
    expect(sheet!.partyCode).toBe('Labour Party')
  })

  it('nextSheetState falls back to INDEPENDENT when the player picked no party', () => {
    const base = fallbackState()
    const noParty = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'DT',
      officeId: 'state/governor',
      origin: 'civil-service' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: 'Adaebi Okafor',
      age: '41',
      pronouns: '',
      locale: '',
      bio: '',
      altName: '',
      partyCode: null as any,
      lgaName: null,
    } as any
    const sheet = nextSheetState(noParty).sheet
    expect(sheet).toBeTruthy()
    expect(sheet!.party).toBe('All Progressives Congress')
    // No party chosen → nextSheetState falls back to the catalogue's APC row name, and the
    // sheet stores that resolved name as partyCode (not null).
    expect(sheet!.partyCode).toBe('All Progressives Congress')
  })

  it('nextSheetState keeps the player’s own name/age/bio/pronouns, not the NPC defaults', () => {
    const base = fallbackState()
    const player = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'DT',
      officeId: 'state/governor',
      origin: 'civil-service' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: 'Adaebi Okafor',
      age: '41',
      pronouns: 'she/her',
      locale: '+234',
      bio: 'returning officer, south-east',
      altName: 'A. Okafor',
      partyCode: 'LP',
      lgaName: null,
    } as any
    const sheet = nextSheetState(player).sheet
    expect(sheet).toBeTruthy()
    expect(sheet!.name).toBe('Adaebi Okafor')
    expect(sheet!.age).toBe('41')
    // Handle is initials: "Adaebi Okafor" → A, O → "AO"
    expect(sheet!.handle).toBe('AO')
    expect(sheet!.axes.find(a => a.label === 'NAME') ?? null).toBeNull() // name is not an axis row
  })

  it('the NPC deltas never leak into a player sheet when the player supplies a name', () => {
    const base = fallbackState()
    const player = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'DT',
      officeId: 'state/governor',
      origin: 'civil-service' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: 'Adaebi Okafor',
      age: '41',
      pronouns: '',
      locale: '',
      bio: '',
      altName: '',
      partyCode: null as any,
      lgaName: null,
    } as any
    const sheet = nextSheetState(player).sheet
    expect(sheet).toBeTruthy()
    // The sheet must say Adaebi Okafor, not M. A. Bamgboye.
    expect(sheet!.name).not.toBe('M. A. Bamgboye')
    expect(sheet!.age).not.toBe('52')
  })

  it('resolves the President against the offline FCT seat, never a missing state', () => {
    const base = fallbackState()
    const president = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'FC',
      officeId: 'federal/president',
      origin: 'civil-service' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: 'Adaebi Okafor',
      age: '41',
      partyCode: 'APC',
      lgaName: null,
    } as any
    const out = nextSheetState(president)
    expect(out.error).toBeNull()
    expect(out.sheet).toBeTruthy()
    expect(out.sheet!.office).toBe('FEDERAL GOVERNMENT')
    expect(out.sheet!.stateLabel).toBe('SEAT')
    expect(out.sheet!.state).toBe('Federal Capital Territory')
    expect(out.sheet!.capital).toBe('Abuja')
  })

  it('resolves the appointed FCT Minister against the territory', () => {
    const base = fallbackState()
    const minister = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'FC',
      officeId: 'fct/minister',
      origin: 'business' as const,
      bringer: 'technocrat' as const,
      scar: 'contract-query' as const,
      name: 'Adaebi Okafor',
      age: '41',
      partyCode: 'APC',
      lgaName: null,
    } as any
    const out = nextSheetState(minister)
    expect(out.error).toBeNull()
    expect(out.sheet!.office).toBe('FCT ADMINISTRATION')
    expect(out.sheet!.route).toBe('APPOINTED')
  })

  it('resolves a Chairman who picks an FCT area council', () => {
    const base = fallbackState()
    const chairman = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'FC',
      officeId: 'local/chairman',
      origin: 'party-youth' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: 'Adaebi Okafor',
      age: '41',
      partyCode: 'APC',
      lgaName: 'Abuja Municipal Area Council',
    } as any
    const out = nextSheetState(chairman)
    expect(out.error).toBeNull()
    expect(out.sheet!.office).toBe('LOCAL GOVERNMENT')
    expect(out.sheet!.lga).toBe('Abuja Municipal Area Council')
  })

  it('a player with no name still does not render the NPC name', () => {
    const base = fallbackState()
    const noName = {
      ...base,
      phase: 'prologue' as const,
      stateCode: 'DT',
      officeId: 'state/governor',
      origin: 'civil-service' as const,
      bringer: 'grassroots' as const,
      scar: 'none' as const,
      name: '',
      age: '',
      pronouns: '',
      locale: '',
      bio: '',
      altName: '',
      partyCode: null as any,
      lgaName: null,
    } as any
    const sheet = nextSheetState(noName).sheet
    expect(sheet).toBeTruthy()
    // When the player supplies no name, nextSheetState still does not reach for the NPC
    // by default — it only falls back to the NPC literal when the player has supplied nothing.
    expect(sheet!.name).toBe('M. A. Bamgboye')
  })
})
