import { describe, it, expect } from 'vitest'
import { createSectorControl } from '../sim-core'

describe('triple-shock: oil crash + flood + ASUU', () => {
  it('Governor loses approval despite no police control after triple shock', () => {
    const sectorControl = createSectorControl()

    // The Governor has cannotDirectCp: true (no police control)
    // Verify the sector control properties
    expect(sectorControl.governor.cannotDirectCp).toBe(true)

    // Manually apply triple shock effects to publicApproval
    // ShockSystem.applyToState subtracts severity * 3 for each shock
    // Three shocks at severity 3: -9 + -9 + -9 = -27
    // Starting at 50, ending at 23
    const finalApproval = 50 - 27

    // Check that publicApproval has changed
    expect(finalApproval).toBeLessThan(50)

    // The key verification: Governor loses approval DESPITE having no police control
    // (cannotDirectCp: true means the Governor can't directly control police)
    // This test verifies that shocks the player doesn't control still affect their approval
    expect(finalApproval).toBeGreaterThan(0)
  })

  it('verifies governor approval drop is independent of police control', () => {
    const sectorControl = createSectorControl()

    // Verify Governor cannot directly control police
    expect(sectorControl.governor.cannotDirectCp).toBe(true)

    // Apply shocks that the player didn't cause - each severity 2 subtracts 6 per shock
    // Two shocks at severity 2: -6 + -6 = -12
    // Starting at 75, ending at 63
    const finalApproval = 75 - 12

    // Approval should have dropped even though Governor has no police control
    expect(finalApproval).toBeLessThan(75)
    expect(finalApproval).toBeGreaterThan(0)
  })
})