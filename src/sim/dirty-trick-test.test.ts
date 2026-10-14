import { describe, it, expect } from 'vitest'
import { executeDirtyTrick, createInitialSimState, createSectorControl } from './sim-core'

describe('dirty trick → EFCC probe → postless godfather path', () => {
  it('plant-story dirty trick triggers EFCC probe and moves approval', () => {
    const sectorControl = createSectorControl()
    const mediaSystem = { reporters: [], influencers: [], gazetteStories: [] } as any

    // Initialize state with Governor at 50% approval
    const state = createInitialSimState(sectorControl, 50, { faacCurrent: 100, inflation: 0, nairaValue: 1 })

    // Add a reporter to the media system for the plant-story trick
    mediaSystem.reporters.push({
      id: 'rep-1',
      name: 'Daily Trust',
      outlet: 'Daily Trust',
      zone: 'central',
      price: { smear: 10, positive: 15, deepfake: 20 },
      risk: { efccProbe: true, publicBacklash: true }
    })
    state.media = {
      reporters: mediaSystem.reporters,
      influencers: mediaSystem.influencers,
      gazetteStories: mediaSystem.gazetteStories
    }

    // Execute plant-story dirty trick
    // This should trigger EFCC risk and affect approval
    const result = executeDirtyTrick('plant-story', {
      target: 'Governor',
      mediaSystem,
      shockSystem: { triggerShock: () => {} } as any,
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
    expect(mediaSystem.gazetteStories.length).toBeGreaterThan(0)

    // Public approval should have changed
    expect(state.publicApproval).toBeLessThan(50)
  })

  it('deepfake-rival dirty trick triggers EFCC probe', () => {
    const sectorControl = createSectorControl()
    const mediaSystem = { reporters: [], influencers: [], gazetteStories: [] } as any

    // Initialize state
    const state = createInitialSimState(sectorControl, 60, { faacCurrent: 100, inflation: 0, nairaValue: 1 })

    // Add a reporter to the media system
    mediaSystem.reporters.push({
      id: 'rep-2',
      name: 'ThisDay',
      outlet: 'ThisDay',
      zone: 'central',
      price: { smear: 10, positive: 15, deepfake: 20 },
      risk: { efccProbe: true, publicBacklash: true }
    })
    state.media = {
      reporters: mediaSystem.reporters,
      influencers: mediaSystem.influencers,
      gazetteStories: mediaSystem.gazetteStories
    }

    // Execute deepfake-rival dirty trick
    const result = executeDirtyTrick('deepfake-rival', {
      target: 'Rival',
      mediaSystem,
      shockSystem: { triggerShock: () => {} } as any,
      npcProfiles: state.npcProfiles,
      state,
    })

    // deepfake-rival has EFCC risk
    expect(result.efccRisk).toBe(true)

    // Should have approval change
    expect(result.approvalChange).toBeDefined()

    // Gazette story should be added
    expect(mediaSystem.gazetteStories.length).toBeGreaterThan(0)
  })

  it('career can fall to godfather role via scandal', () => {
    // Test that a career can fall to godfather role
    const CareerSystem = (await import('./sim-core')).CareerSystem
    const career = new CareerSystem('lgachairman', 'local/chairman')

    // Advance through levels until falling
    career.advanceLevel() // lgachairman -> stategovernor
    career.advanceLevel() // stategovernor -> president
    // Fall to godfather via scandal
    career.removeFromOffice('scandal')

    const prof = career.getCareer()
    expect(prof.level).toBe('godfather')
    expect(prof.postlossRole).toBe('godfather')
  })
})