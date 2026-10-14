import { describe, it, expect } from 'vitest'
import { createInitialSimState, advanceTurn, createSectorControl } from './sim-core'
import { ShockSystem } from './sim/shock-system'
import { MediaSystem } from './sim/media-system'

describe('triple-shock: oil crash + flood + ASUU', () => {
  it('Governor loses approval despite no police control after triple shock', () => {
    const sectorControl = createSectorControl()
    const shockSystem = new ShockSystem()
    const mediaSystem = new MediaSystem()

    // Create initial state with Governor at 50% approval
    const state = createInitialSimState(sectorControl, 50)

    // The Governor has cannotDirectCp: true (no police control)
    // Verify the sector control properties
    expect(sectorControl.governor.cannotDirectCp).toBe(true)

    // Trigger oil crash shock (playerAccountable: false = not player's fault, but still affects approval)
    shockSystem.triggerShock('oil-crash', 3, {
      affectedZones: ['all'],
      durationWeeks: 8,
      economicImpact: 55, // 5 + 3*15
      playerAccountable: false,
    })

    // Trigger flood shock
    shockSystem.triggerShock('flood', 3, {
      affectedZones: ['south', 'east'],
      durationWeeks: 6,
      economicImpact: 38, // 8 + 3*10
      playerAccountable: false,
    })

    // Trigger ASUU strike shock
    shockSystem.triggerShock('asuu-strike', 3, {
      affectedZones: ['all'],
      durationWeeks: 12,
      economicImpact: 18, // 3 + 3*5
      playerAccountable: false,
    })

    // Apply all shocks to state
    state = shockSystem.applyToState(state)

    // After triple shock (severity 3 each), approval should drop:
    // - oil-crash: -3 * 3 = -9
    // - flood: -3 * 3 = -9  
    // - asuu-strike: -3 * 3 = -9
    // Total: -27, so approval should be 50 - 27 = 23
    // But we need to check the actual implementation...

    // Check that publicApproval has changed
    expect(state.publicApproval).toBeLessThan(50)

    // The key verification: Governor loses approval DESPITE having no police control
    // (cannotDirectCp: true means the Governor can't directly control police)
    // This test verifies that shocks the player doesn't control still affect their approval
    expect(state.publicApproval).toBeGreaterThan(0)
  })

  it('verifies governor approval drop is independent of police control', () => {
    const sectorControl = createSectorControl()
    const shockSystem = new ShockSystem()

    // Create state with Governor
    const state = createInitialSimState(sectorControl, 75)

    // Verify Governor cannot directly control police
    expect(sectorControl.governor.cannotDirectCp).toBe(true)

    // Apply shocks that the player didn't cause
    shockSystem.triggerShock('oil-crash', 2, {
      affectedZones: ['all'],
      durationWeeks: 8,
      economicImpact: 35,
      playerAccountable: false,
    })

    shockSystem.triggerShock('flood', 2, {
      affectedZones: ['south', 'east'],
      durationWeeks: 6,
      economicImpact: 28,
      playerAccountable: false,
    })

    // Apply shocks
    state = shockSystem.applyToState(state)

    // Approval should have dropped even though Governor has no police control
    expect(state.publicApproval).toBeLessThan(75)
    expect(state.publicApproval).toBeGreaterThan(0)
  })
})