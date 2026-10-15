import { describe, it, expect } from 'vitest'
import {
  executeDirtyTrick,
  createInitialSimState,
  createSectorControl,
  CareerSystem,
  MediaSystem,
  ShockSystem,
} from '../sim-core'
import type { GazetteStory } from '../types'

/* These tests originally constructed `new MediaSystem()` and `new ShockSystem()` (commit
   7650c7c). Commit e51ceed replaced both with plain object literals —
   `{ reporters: [], influencers: [], gazetteStories: [] } as any` and
   `{ triggerShock: () => {} } as any` — while it was fixing build errors. A bare literal has
   no `plantDeepfake` method, so `executeDirtyTrick` threw before reaching any assertion, and
   the `shockSystem` double silently swallowed the EFCC-triggered shock instead of recording
   it. The literals were the defect; the real classes are exported from ../sim-core and are
   what these tests were written against.

   MediaSystem keeps `influencers` and `gazetteStories` private, which is what pushed
   e51ceed into `as any`. Nothing here needs to bypass that: `executeDirtyTrick` only reads
   `mediaSystem.reporters` and writes through `addGazetteStory`, so the published stories are
   observed through the array handed to the constructor (MediaSystem stores that reference
   and pushes into it). */

const makeReporter = (id: string, name: string) => ({
  id,
  name,
  outlet: name,
  zone: 'central' as const,
  price: { smear: 10, positive: 15, deepfake: 20 },
  risk: { efccProbe: true, publicBacklash: true },
})

describe('dirty trick → EFCC probe → postless godfather path', () => {
  it('plant-story dirty trick triggers EFCC probe and moves approval', () => {
    const sectorControl = createSectorControl()
    const shockSystem = new ShockSystem()
    const stories: GazetteStory[] = []
    const mediaSystem = new MediaSystem([makeReporter('rep-1', 'Daily Trust')], [], stories)

    // Initialize state with Governor at 50% approval
    const state = createInitialSimState(sectorControl, 50, { faacCurrent: 100, inflation: 0, nairaValue: 1 })

    // Execute plant-story dirty trick
    // This should trigger EFCC risk and affect approval
    const result = executeDirtyTrick('plant-story', {
      target: 'Governor',
      mediaSystem,
      shockSystem,
      npcProfiles: state.npcProfiles,
      state,
    })

    // The trick should have an EFCC risk (true for plant-story)
    expect(result.efccRisk).toBe(true)

    // The trick should have been successful (plant stories always succeed mechanically)
    expect(result.success).toBe(true)

    // There should be an approval change
    expect(result.approvalChange).toBeDefined()

    // Gazette story should have been added
    expect(stories.length).toBeGreaterThan(0)

    // Public approval should have changed
    expect(state.publicApproval).toBeLessThan(50)
  })

  it('deepfake-rival dirty trick triggers EFCC probe', () => {
    const sectorControl = createSectorControl()
    const shockSystem = new ShockSystem()
    const stories: GazetteStory[] = []
    const mediaSystem = new MediaSystem([makeReporter('rep-2', 'ThisDay')], [], stories)

    // Initialize state
    const state = createInitialSimState(sectorControl, 60, { faacCurrent: 100, inflation: 0, nairaValue: 1 })

    // Execute deepfake-rival dirty trick
    const result = executeDirtyTrick('deepfake-rival', {
      target: 'Rival',
      mediaSystem,
      shockSystem,
      npcProfiles: state.npcProfiles,
      state,
    })

    // deepfake-rival has EFCC risk
    expect(result.efccRisk).toBe(true)

    // Should have approval change
    expect(result.approvalChange).toBeDefined()

    // Gazette story should be added
    expect(stories.length).toBeGreaterThan(0)
  })

  /* The EFCC probe is modelled as an investigation *shock* the player is accountable for,
     not as a new post. The real ShockSystem is used so the test asserts what actually
     happens rather than trusting a stub that does nothing. */
  it('an EFCC-risky trick raises an investigation shock the player is accountable for', () => {
    const shockSystem = new ShockSystem()
    const stories: GazetteStory[] = []
    const mediaSystem = new MediaSystem([makeReporter('rep-3', 'Punch')], [], stories)
    const state = createInitialSimState(createSectorControl(), 50)

    executeDirtyTrick('deepfake-rival', {
      target: 'Rival',
      mediaSystem,
      shockSystem,
      npcProfiles: state.npcProfiles,
      state,
    })

    const active = shockSystem.getActiveShocks()
    expect(active.length).toBeGreaterThan(0)
    // executeDirtyTrick is the only caller that passes playerAccountable: true.
    expect(active.every(s => s.playerAccountable)).toBe(true)
  })

  /* The career test previously asserted that a *scandal* removal left a former President as a
     postless godfather. CareerSystem.removeFromOffice documents the opposite mapping in code —
     'impeachment' and 'scandal' are the exile paths, 'lost_primary' and 'defector' are the
     godfather paths — and a removal has never rewritten the level ladder; it records
     `fallen` and the post-loss role, while advanceLevel walks the levels. The test's own title
     at 7650c7c was 'career can fall to godfather role via lost_primary' while its body passed
     'scandal'; e51ceed renamed the title to 'via scandal', reconciling the title to the wrong
     reason instead of the body to the right one. The assertions are corrected to the intended,
     implemented behaviour; no game mechanic was changed. */
  it('career can fall to godfather role via lost_primary', () => {
    const career = new CareerSystem('lgachairman', 'local/chairman')

    // Advance through levels until falling
    career.advanceLevel() // lgachairman -> stategovernor
    career.advanceLevel() // stategovernor -> president

    expect(career.getCareer().level).toBe('president')

    // Falling sets the post-loss role; it does not rewrite the level ladder.
    career.removeFromOffice('lost_primary')

    const prof = career.getCareer()
    expect(prof.fallen).toBe(true)
    expect(prof.level).toBe('president')
    expect(prof.postlossRole).toBe('godfather')
    expect(prof.godfatherOf.length).toBeGreaterThan(0)
  })

  it('career can fall to exile role via scandal', () => {
    const career = new CareerSystem('lgachairman', 'local/chairman')
    career.advanceLevel()
    career.advanceLevel()

    career.removeFromOffice('scandal')

    const prof = career.getCareer()
    expect(prof.fallen).toBe(true)
    expect(prof.postlossRole).toBe('exile')
  })
})
