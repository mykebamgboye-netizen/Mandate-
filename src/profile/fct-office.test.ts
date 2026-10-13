// Regression guard for the FCT (s.299): the territory is not a state and has no
// governorship. The picker used to pin 'state/governor' for every card, so picking the
// FCT produced "Governor of FCT" / "STATE GOVERNMENT · Governor · ELECTED".
import { describe, expect, it } from 'vitest'
import { FCT_OFFICE_ID, FCT_STATE_CODE, startingOfficeForState } from './profile-state'
import { FCT_MINISTER_OFFICE, DELTA_TUTORIAL_OFFICE } from './delta-tutorial'
import { sheetFromAxes } from './profile-sheet'
import { normalizeAxes } from './schema'
import { defaultFederationReference } from './client'

describe('FCT is administered, not governed', () => {
  it('routes the FCT card to an appointed fct-tier office', () => {
    expect(startingOfficeForState(FCT_STATE_CODE)).toBe(FCT_OFFICE_ID)
    expect(FCT_MINISTER_OFFICE.tier).toBe('fct')
    expect(FCT_MINISTER_OFFICE.route).toBe('appointed')
    expect(FCT_MINISTER_OFFICE.jurisdiction).toBe('territory')
    expect(FCT_MINISTER_OFFICE.authorityNote).toMatch(/s\.299/)
    expect(FCT_MINISTER_OFFICE.post).not.toMatch(/governor/i)
  })

  it('still sends the 36 states to the governorship', () => {
    expect(startingOfficeForState('DT')).toBe('state/governor')
    expect(startingOfficeForState('LA')).toBe('state/governor')
    expect(startingOfficeForState('KN')).toBe('state/governor')
    expect(DELTA_TUTORIAL_OFFICE.post).toBe('Governor')
  })

  it('is available to the offline fallback too', () => {
    expect(defaultFederationReference.offices.map(o => o.id)).toContain(FCT_OFFICE_ID)
  })

  it('prints FCT ADMINISTRATION on the record sheet, never STATE GOVERNMENT', () => {
    const sheet = sheetFromAxes(
      normalizeAxes({}), 0, undefined, 'FCT', 'Abuja', FCT_MINISTER_OFFICE, 'APC', 'A. Tester', '34',
    )
    expect(sheet.office).toBe('FCT ADMINISTRATION')
    expect(sheet.route).toBe('APPOINTED')
    expect(sheet.post).toBe('Minister of the Federal Capital Territory')
  })
})
