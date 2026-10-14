import { describe, expect, it } from 'vitest'
import {
  POST_SECTOR_MATRIX, SECTORS, SECTOR_IDS, matrixFor, postSectorBrief, sectorLabel, tierFromOfficeId,
} from './sectors'
import {
  DERIVATION,
  FAAC_VERTICAL,
  FCT_EARMARK,
  LG_AUTONOMY,
  OFFICE_REVENUE,
  revenueBrief,
  revenueFor,
  verticalFormulaLine,
} from './revenue'
import { SCRIPTED_SCENARIOS, SHOCK_DECK, SHOCKS_PER_QUARTER, SHOCK_TYPES, pressureBrief } from './pressure'
import { CAREER_FALLS, CAREER_LADDER, careerBrief, nextRung, rungFor } from './career'
import { PLAYABLE_OFFICES } from './profile/playable-offices'

const PLAYABLE_IDS = PLAYABLE_OFFICES.map((o) => o.id)
const DECK_IDS = new Set(SHOCK_DECK.map((s) => s.id))

describe('the twelve sectors', () => {
  it('is the design’s own list, in order', () => {
    expect(SECTOR_IDS).toEqual([
      'security',
      'economy_finance',
      'works',
      'health',
      'education',
      'agriculture',
      'oil_gas',
      'trade',
      'environment',
      'justice',
      'information',
      'traditional_religious',
    ])
    expect(Object.keys(SECTORS)).toHaveLength(12)
  })

  it('gives every sector a line and a tier-by-tier answer', () => {
    for (const id of SECTOR_IDS) {
      const s = SECTORS[id]
      expect(s.id, id).toBe(id)
      expect(s.label.length, id).toBeGreaterThan(0)
      expect(s.line.length, id).toBeGreaterThan(0)
      expect(s.federal.length, id).toBeGreaterThan(0)
      expect(s.state.length, id).toBeGreaterThan(0)
      expect(s.local.length, id).toBeGreaterThan(0)
    }
    expect(sectorLabel('oil_gas')).toBe('Oil & Gas')
  })

  it('marks the sectors a sub-national seat cannot move at all', () => {
    expect(SECTORS.security.federalOnly).toBe(true)
    expect(SECTORS.oil_gas.federalOnly).toBe(true)
    expect(SECTORS.works.federalOnly).toBeUndefined()
  })
})

describe('the post × sector matrix', () => {
  it('covers every playable office', () => {
    for (const id of PLAYABLE_IDS) {
      expect(matrixFor(id), id).not.toBeNull()
    }
  })

  it('never lets a seat control a lever the constitution puts elsewhere', () => {
    const governor = matrixFor('state/governor')!
    expect(governor.cannotControl.map((c) => c.sector)).toContain('security')
    expect(governor.cannotControl.map((c) => c.sector)).toContain('economy_finance')
    expect(governor.cannotControl.some((c) => /police/i.test(c.scope ?? ''))).toBe(true)

    const federal = matrixFor('federal/president')!
    expect(federal.controls.map((c) => c.sector)).toEqual([
      'security',
      'economy_finance',
      'oil_gas',
      'information',
    ])
    expect(federal.cannotControl).toHaveLength(0)

    const local = matrixFor('local/chairman')!
    expect(local.controls.map((c) => c.sector)).toEqual(['health', 'education', 'trade', 'environment'])
    expect(local.blamedFor.map((c) => c.sector)).toContain('environment')
  })

  it('keeps the FCT minister’s tenure out of his own hands', () => {
    const fct = POST_SECTOR_MATRIX['fct/minister']
    expect(fct.cannotControl.some((c) => /President can sack you/i.test(c.scope ?? ''))).toBe(true)
  })
})

describe('the money facts', () => {
  it('has a vertical formula that sums to exactly 100', () => {
    const sum = FAAC_VERTICAL.federal + FAAC_VERTICAL.states + FAAC_VERTICAL.local
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9)
    expect(FAAC_VERTICAL.federal).toBe(52.68)
    expect(FAAC_VERTICAL.states).toBe(26.72)
    expect(FAAC_VERTICAL.local).toBe(20.6)
  })

  it('treats derivation as prior to the formula, not inside it', () => {
    expect(DERIVATION.pct).toBe(13)
    expect(DERIVATION.prior).toBe(true)
    // 13% off the top is not a fourth vertical share: the three already total 100
    expect(FAAC_VERTICAL.federal + FAAC_VERTICAL.states + FAAC_VERTICAL.local + DERIVATION.pct).not.toBe(100)
  })

  it('keeps the FCT earmark inside the federal side, never added on top', () => {
    expect(FCT_EARMARK.pct).toBe(1)
    expect(FCT_EARMARK.line).toMatch(/already 100/)
  })

  it('pins the local government autonomy judgment to 11 July 2024', () => {
    expect(LG_AUTONOMY.date).toBe('2024-07-11')
    expect(LG_AUTONOMY.line).toMatch(/directly/)
  })

  it('gives each seat its own revenue reading and cites the sections', () => {
    for (const id of PLAYABLE_IDS) {
      const rev = revenueFor(id)
      expect(rev, id).not.toBeNull()
      expect(rev!.lines.length, id).toBeGreaterThan(0)
      expect(rev!.cites.length, id).toBeGreaterThan(0)
    }
    expect(OFFICE_REVENUE['federal/president'].share).toEqual({ pct: 52.68, of: 'federation account' })
    expect(OFFICE_REVENUE['local/chairman'].share).toEqual({ pct: 20.6, of: 'federation account' })
  })

  it('flags the figures that could not be sourced instead of printing them as fact', () => {
    expect(OFFICE_REVENUE['federal/president'].verify?.length).toBeGreaterThan(0)
    expect(OFFICE_REVENUE['federal/president'].verify!.join(' ')).toMatch(/could not be (confirmed|sourced)/)
    expect(OFFICE_REVENUE['fct/minister'].verify?.length).toBeGreaterThan(0)
  })

  it('prints the formula line with the unverified marker attached', () => {
    expect(verticalFormulaLine()).toBe('FG 52.68% · STATES 26.72% · LGA 20.6% [verify]')
  })
})

describe('the pressure model', () => {
  it('fires the design’s five shocks a quarter across five kinds', () => {
    expect(SHOCKS_PER_QUARTER).toBe(5)
    expect(SHOCK_TYPES).toHaveLength(5)
    expect(SHOCK_TYPES.map((t) => t.id).sort()).toEqual(
      ['climate', 'global_oil', 'judicial', 'national_faac', 'security'].sort(),
    )
  })

  it('uses real, corrected figures and records the correction', () => {
    for (const shock of SHOCK_DECK) {
      expect(shock.what.length, shock.id).toBeGreaterThan(0)
      expect(shock.federal.length, shock.id).toBeGreaterThan(0)
      expect(shock.state.length, shock.id).toBeGreaterThan(0)
      expect(shock.local.length, shock.id).toBeGreaterThan(0)
      expect(SHOCK_TYPES.map((t) => t.id), shock.id).toContain(shock.type)
    }

    const subsidy = SHOCK_DECK.find((s) => s.id === 'subsidy_2023')!
    expect(subsidy.what).toMatch(/34\.19/)
    expect(subsidy.what).toMatch(/₦185/)
    expect(subsidy.correction).toMatch(/₦850\+/)

    const oil = SHOCK_DECK.find((s) => s.id === 'oil_crash_2016')!
    expect(oil.what).toMatch(/111\.80/)
    expect(oil.what).toMatch(/30\.70/)
    expect(oil.correction).toMatch(/1\.51/)

    const flood = SHOCK_DECK.find((s) => s.id === 'flood_2022')!
    expect(flood.correction).toMatch(/estimate/)

    const asuu = SHOCK_DECK.find((s) => s.id === 'asuu_2022')!
    expect(asuu.period).toBe('14 February – 14 October 2022')
    expect(asuu.what).toMatch(/242 days/)

    const judgment = SHOCK_DECK.find((s) => s.id === 'autonomy_judgment_2024')!
    expect(judgment.period).toBe('11 July 2024')
  })

  it('runs the four scripted scenarios on shocks that exist in the deck', () => {
    expect(SCRIPTED_SCENARIOS.map((s) => s.id)).toEqual([
      'triple_shock_president',
      'triple_shock_governor',
      'triple_shock_fct',
      'triple_shock_lga',
    ])
    for (const scenario of SCRIPTED_SCENARIOS) {
      expect(PLAYABLE_IDS, scenario.id).toContain(scenario.officeId)
      expect(scenario.shocks.length, scenario.id).toBeGreaterThan(0)
      for (const shock of scenario.shocks) {
        expect(DECK_IDS, `${scenario.id}/${shock}`).toContain(shock)
      }
      expect(scenario.expectedPressure.length, scenario.id).toBeGreaterThan(0)
      expect(scenario.playerActions.length, scenario.id).toBeGreaterThan(0)
    }
    // the design gives some seats a win condition, the others a loss: none of them neither
    const byId = (id: string) => SCRIPTED_SCENARIOS.find((s) => s.id === id)!
    expect(byId('triple_shock_president').win).toMatch(/approval above 35%|impeachment/)
    expect(byId('triple_shock_governor').lose).toMatch(/impeachment/)
    expect(byId('triple_shock_lga').lose).toBeTruthy()
    expect(byId('triple_shock_lga').postlessRisk).toMatch(/godfather/)
    expect(byId('triple_shock_fct').expectedPressure.map((p) => p.axis)).toContain('works')
  })

  it('binds the governor run to a seat with no hands on the naira or the unions', () => {
    const gov = SCRIPTED_SCENARIOS.find((s) => s.id === 'triple_shock_governor')!
    expect(gov.state).toBe('Delta')
    expect(gov.cannotControl).toEqual(['the oil price', 'the naira', 'ASUU'])
    // and the same seat's matrix agrees it cannot touch the police either
    expect(matrixFor('state/governor')!.cannotControl.map((c) => c.sector)).toContain('security')
  })
})

describe('the desk brief on the post', () => {
  it('reads the tier off the office id', () => {
    expect(tierFromOfficeId('federal/president')).toBe('federal')
    expect(tierFromOfficeId('state/governor')).toBe('state')
    expect(tierFromOfficeId('fct/minister')).toBe('fct')
    expect(tierFromOfficeId('local/chairman')).toBe('local')
  })

  it('writes the levers, the blame and the no-goes for every playable seat', () => {
    for (const id of PLAYABLE_IDS) {
      const lines = postSectorBrief(id)
      expect(lines.length, id).toBeGreaterThan(3)
      expect(lines[0], id).toMatch(/^YOU HOLD — /)
      expect(lines.join(' '), id).toMatch(/BLAMED FOR|CANNOT TOUCH/)
    }
    const governor = postSectorBrief('state/governor').join(' ')
    expect(governor).toContain('CANNOT TOUCH')
    expect(governor).toContain('the police')
    const council = postSectorBrief('local/chairman').join(' ')
    expect(council).toContain('primary')
    expect(postSectorBrief('unmapped/office')).toEqual([])
  })

  it('gives every seat its money page with the sections attached', () => {
    for (const id of PLAYABLE_IDS) {
      const lines = revenueBrief(id)
      expect(lines.length, id).toBeGreaterThan(3)
      expect(lines.join(' '), id).toContain('CITES — ')
    }
    expect(revenueBrief('federal/president').join(' ')).toContain('SHARE — 52.68%')
    expect(revenueBrief('local/chairman').join(' ')).toContain('SHARE — 20.6%')
    expect(revenueBrief('federal/president').join(' ')).toContain('[verify]')
    expect(revenueBrief('nobody/at/all')).toEqual([])
  })

  it('states the pressure model and the executive paradox', () => {
    const brief = pressureBrief().join(' ')
    expect(brief).toContain('5 shocks a quarter')
    expect(brief).toContain('Commissioner of Police answers to the Inspector-General')
    for (const t of SHOCK_TYPES) expect(brief).toContain(t.label)
  })

  it('places the seat on the ladder and names the way off it', () => {
    const federal = careerBrief('federal/president').join(' ')
    expect(federal).toContain('NEXT RUNG — none')
    expect(federal).toContain('THE WAYS OFF')
    const local = careerBrief('local/councillor').join(' ')
    expect(local).toContain('NEXT RUNG — Council Chairman')
    expect(local).toContain(CAREER_FALLS.map((f) => f.label).join(' · '))
  })
})

describe('the career model', () => {
  it('ladders councillor → chairman → assembly → governor → president', () => {
    expect(CAREER_LADDER.map((r) => r.officeId)).toEqual([
      'local/councillor',
      'local/chairman',
      'state/assembly',
      'state/governor',
      'federal/president',
    ])
    expect(new Set(CAREER_LADDER.map((r) => r.id)).size).toBe(5)
    for (const rung of CAREER_LADDER) {
      expect(rung.gives.length, rung.id).toBeGreaterThan(0)
      expect(rung.costs.length, rung.id).toBeGreaterThan(0)
    }
    expect(nextRung('local/councillor')?.id).toBe('lga_chairman')
    expect(nextRung('state/governor')?.id).toBe('president')
    expect(nextRung('federal/president')).toBeUndefined()
    expect(rungFor('state/governor')?.tier).toBe('state')
  })

  it('offers all three ways off the ladder, each still playable', () => {
    expect(CAREER_FALLS.map((f) => f.id)).toEqual(['postless_godfather', 'exile', 'prosecution'])
    for (const fall of CAREER_FALLS) {
      expect(fall.trigger.length, fall.id).toBeGreaterThan(0)
      expect(fall.play.length, fall.id).toBeGreaterThan(0)
      expect(fall.retains.length, fall.id).toBeGreaterThan(0)
    }
    expect(CAREER_FALLS[0].trigger).toMatch(/2bn|₦2bn/)
  })
})
