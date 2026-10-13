// Regression guard for the prologue → sheet patronage base.
//
// nextSheetState used to derive its axes from normalizeAxes({}), whose patronageBank
// default is 0. So the very first "revise my record" silently replaced the treasury's
// opening balance with ₦0 (or ₦1bn if you picked the godfather, who only *adds* ₦1bn),
// while the budget screen kept reporting OPENING_BALANCE. The prologue deltas are
// adjustments on top of the desk you inherit, so the base must be OPENING_BALANCE.
import { describe, expect, it } from 'vitest'
import { nextSheetState } from './profile-state'
import { OPENING_BALANCE } from '../content'
import { DELTA_TUTORIAL_STATE, DELTA_TUTORIAL_OFFICE } from './delta-tutorial'

const base = {
  phase: 'prologue' as const,
  states: [DELTA_TUTORIAL_STATE],
  offices: [DELTA_TUTORIAL_OFFICE],
  parties: [],
  stateCode: DELTA_TUTORIAL_STATE.code,
  officeId: DELTA_TUTORIAL_OFFICE.id,
  origin: 'civil-service' as const,
  bringer: 'grassroots' as const,
  scar: 'none' as const,
  name: 'A. Tester',
  age: '34',
  pronouns: '',
  locale: '',
  bio: '',
  altName: '',
  partyCode: null,
  lgaName: null,
  sheet: null,
  error: null,
}

const naira = (n: number) => n.toLocaleString('en-NG')

describe('prologue sheet keeps the inherited patronage bank', () => {
  it('starts from the treasury opening balance, not zero', () => {
    const next = nextSheetState(base)
    expect(next.sheet?.patronageBank).toBe(naira(OPENING_BALANCE))
    expect(next.sheet?.axes.find(a => a.label === 'PATRONAGE BANK')?.value).toBe(naira(OPENING_BALANCE))
  })

  it('adds the godfather premium on top of that balance', () => {
    const next = nextSheetState({ ...base, bringer: 'godfather' })
    expect(next.sheet?.patronageBank).toBe(naira(OPENING_BALANCE + 1_000_000_000))
  })
})
