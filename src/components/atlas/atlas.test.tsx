import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PositionAtlas from './PositionAtlas'
import { buildAtlas, atlasHeadline, groupDigits, seatsOfTier, ATLAS_TIER_ORDER } from './atlas-data'
import { POSITION_COUNTS } from '../../sim/positions'

const SEED = 0xc0ffee

describe('the atlas data', () => {
  it('counts the whole federation', () => {
    const atlas = buildAtlas({ seed: SEED, rowLimit: 4 })
    expect(atlas.counts.total).toBe(10_192)
    expect(atlas.counts.playableCore).toBe(1_245)
    expect(atlas.sections).toHaveLength(4)
    const byTier = Object.fromEntries(atlas.sections.map(s => [s.tier, s.total]))
    expect(byTier).toEqual({ federal: 501, state: 108, lga: 774, ward: 8809 })
  })

  it('renders the top of each tier and reports the remainder', () => {
    const atlas = buildAtlas({ seed: SEED, rowLimit: 3 })
    for (const section of atlas.sections) {
      expect(section.seats).toHaveLength(3)
      expect(section.shown).toBe(3)
      expect(section.shown).toBeLessThanOrEqual(section.total)
    }
  })

  it('names a living holder for every seat it shows', () => {
    const atlas = buildAtlas({ seed: SEED, rowLimit: 6 })
    const seats = atlas.sections.flatMap(s => s.seats)
    expect(seats.length).toBe(4 * 6)
    for (const seat of seats) {
      expect(seat.holderName.length).toBeGreaterThan(3)
      expect(seat.holderName).not.toBe(seat.title)
    }
    // the senior seats are held by the 250 key actors the weekly loop runs
    expect(seats.filter(s => s.holderIsKey).length).toBeGreaterThan(0)
  })

  it('puts the most senior seat of each tier first', () => {
    const atlas = buildAtlas({ seed: SEED, rowLimit: 2 })
    const federal = atlas.sections.find(s => s.tier === 'federal')!
    expect(federal.seats[0]!.id).toBe('federal/president')
    const state = atlas.sections.find(s => s.tier === 'state')!
    expect(state.seats[0]!.title).toBe('Governor')
  })

  it('is deterministic for a seed and different for another seed', () => {
    const a = buildAtlas({ seed: SEED, rowLimit: 4 })
    const b = buildAtlas({ seed: SEED, rowLimit: 4 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = buildAtlas({ seed: SEED + 5, rowLimit: 4 })
    const names = (x: typeof a) => x.sections.flatMap(s => s.seats.map(t => t.holderName)).join()
    expect(names(c)).not.toBe(names(a))
  })

  it('exposes every seat of a tier, not only the cap', () => {
    expect(seatsOfTier('lga')).toHaveLength(774)
    expect(seatsOfTier('ward')).toHaveLength(8809)
    expect(ATLAS_TIER_ORDER).toEqual(['federal', 'state', 'lga', 'ward'])
  })

  it('groups digits and writes the headline by hand', () => {
    expect(groupDigits(10192)).toBe('10,192')
    expect(groupDigits(1245)).toBe('1,245')
    expect(groupDigits(8809)).toBe('8,809')
    expect(atlasHeadline(POSITION_COUNTS)).toBe('10,192 seats · 1,245 playable on day one')
  })
})

describe('the atlas screen', () => {
  const html = renderToStaticMarkup(<PositionAtlas seed={SEED} rowLimit={3} />)

  it('renders every tier with its size', () => {
    expect(html).toContain('POSITION ATLAS')
    expect(html).toContain('10,192 seats · 1,245 playable on day one')
    expect(html).toContain('FEDERAL')
    expect(html).toContain('STATE')
    expect(html).toContain('LOCAL GOVERNMENT')
    expect(html).toContain('WARD')
    expect(html).toContain('8,809 seats')
    expect(html).toContain('774 seats')
  })

  it('shows the holder, the salary, the term and the cost of a run', () => {
    expect(html).toContain('President')
    expect(html).toContain('₦1.4m/mo')          // the President's salary, as the purse prints it
    expect(html).toContain('-year term')
    expect(html).toContain('run: ')
    expect(html).toContain('showing the 3 most senior of 8,809')
  })

  it('offers a run action only when the desk can act on it', () => {
    expect(html).not.toContain('RUN HERE')
    const withRun = renderToStaticMarkup(<PositionAtlas seed={SEED} rowLimit={2} onRunFor={() => undefined} />)
    expect(withRun).toContain('RUN HERE')
  })

  it('marks the appointed seats, which are not won at a poll', () => {
    // the federal tier runs President → VP → 109 senators → 360 reps → 30 ministers, so a
    // ministry only appears once the whole legislative bench is above it: 1 + 1 + 109 + 360
    const deep = buildAtlas({ seed: SEED, rowLimit: 501 })
    const federal = deep.sections.find(s => s.tier === 'federal')!
    expect(federal.seats).toHaveLength(501)
    expect(federal.seats[471]!.appointmentType).toBe('appointed')
    const ministers = federal.seats.filter(s => s.appointmentType === 'appointed')
    expect(ministers).toHaveLength(30)
    expect(ministers[0]!.title.startsWith('Minister of')).toBe(true)
  })

  it('renders the focused tier first', () => {
    const focused = renderToStaticMarkup(<PositionAtlas seed={SEED} rowLimit={1} focusTier="lga" />)
    expect(focused.indexOf('LOCAL GOVERNMENT')).toBeLessThan(focused.indexOf('FEDERAL'))
  })
})
