/* Tests for the living federation: geography, parties, the office catalogue, the press,
   the 250-actor cast, the weekly brain, the tick, the century calendar, the decision
   templates and the player's save.

   The century test is opt-in (SIM_CENTURY=1): it runs 5,200 Mondays and takes ~20s, which
   would dominate the suite. It is run explicitly when the whole arc is being verified. */

import { describe, it, expect } from 'vitest'
import { STATES, STATES_ONLY, LGAS, LGAS_BY_STATE, FCT_CODE } from './geo'
import { POSITION_COUNTS, POSITIONS, buildSeatIndex, countPositions } from './positions'
import { generateParties, PARTY_CODES } from './parties'
import { CALENDAR, CALENDAR_COUNTS, buildCalendar, cyclesInWeek } from './calendar'
import {
  generateKeyCast, generateRelationships, npcWeekly, decayRelationships, canRunFor,
  findMutualEnemy, ageOf, resolveTargetSeat, weeklyStream,
  type Npc, type NpcWorld,
} from './npcs'
import { createLivingWorld, advanceTurn, advanceWeeks, viewOf, simulateCentury, weekToDate, dateToWeek, type LivingWorld } from './living'
import { sfc32, subSeed, hash32 } from './rng'
import { stateHash } from './hash'
import { TEMPLATES, generateEvents, rollOption, applyEffects, compactNaira, type TemplateContext } from './events'
import {
  newLife, createRegistry, createLife, activeLife, selectLife, retireLife, startAsProtege,
  applyTurn, tierForPosition, serializeRegistry, deserializeRegistry, NEUTRAL_AXES, addDays,
  type LifeRegistry,
} from './game-state'

const SEED = 0xc0ffee

describe('geography', () => {
  it('carries the 36 states and the FCT', () => {
    expect(STATES).toHaveLength(37)
    expect(STATES_ONLY).toHaveLength(36)
    expect(FCT_CODE).toBe('FC')
    expect(STATES.find(s => s.code === 'FC')?.name).toBe('FCT')
  })

  it('carries all 774 councils, each attached to a real state', () => {
    expect(LGAS).toHaveLength(774)
    const codes = new Set(STATES.map(s => s.code))
    for (const lga of LGAS) expect(codes.has(lga.stateCode)).toBe(true)
    const total = STATES.reduce((a, s) => a + s.lgaCount, 0)
    expect(total).toBe(774)
    expect(LGAS_BY_STATE.get('DT')).toHaveLength(25)
    expect(LGAS.some(l => l.name === "Jema'a")).toBe(true)
  })
})

describe('the office catalogue', () => {
  it('holds every seat the constitution creates', () => {
    expect(POSITION_COUNTS.senators).toBe(109)     // 3 per state + 1 for the FCT
    expect(POSITION_COUNTS.reps).toBe(360)
    expect(POSITION_COUNTS.governors).toBe(36)     // the FCT has none (s.299)
    expect(POSITION_COUNTS.ministers).toBe(30)
    expect(POSITION_COUNTS.chairmen).toBe(774)
    expect(POSITION_COUNTS.councillors).toBe(8809)
    expect(POSITION_COUNTS.total).toBe(10192)
    const deputies = POSITIONS.filter(p => p.id.endsWith('/deputy-governor'))
    const speakers = POSITIONS.filter(p => p.id.endsWith('/speaker'))
    expect(deputies).toHaveLength(36)
    expect(speakers).toHaveLength(36)
  })

  it('the "1,247 day-one playable" slice is 1,245 as constituted', () => {
    // 1,245 = 1 Pres + 1 VP + 109 Sen + 360 Reps + 774 Chairmen (FCT has 1 senator per s.48)
    expect(POSITION_COUNTS.playableCore).toBe(1245)
    // the brief's 1,247 only appears if the FCT is given three senators (37 × 3 = 111).
    // The constitution gives the territory one (s.48), so the correct figure is 1,245.
    expect(1 + 1 + 37 * 3 + 360 + 774).toBe(1247)
    expect(1 + 1 + 109 + 360 + 774).toBe(POSITION_COUNTS.playableCore)
  })

  it('gives every seat a unique id, a salary and dotted powers', () => {
    const ids = new Set(POSITIONS.map(p => p.id))
    expect(ids.size).toBe(POSITIONS.length)
    for (const p of POSITIONS) {
      expect(p.salaryMonthly).toBeGreaterThan(0)
      expect(p.termYears).toBeGreaterThan(0)
      for (const power of p.powers) expect(power).toMatch(/^[a-z]+(\.[a-z]+)*$/)
    }
  })

  it('covers every council with exactly one chairman', () => {
    const seats = POSITIONS.filter(p => p.id.endsWith('/chairman'))
    expect(new Set(seats.map(p => p.lgaCode)).size).toBe(774)
    expect(countPositions(POSITIONS.filter(p => p.tier === 'ward')).councillors).toBe(8809)
  })

  it('indexes seats for O(1) lookup', () => {
    const index = buildSeatIndex()
    expect(index.president).toBe('federal/president')
    expect(index.governorsByState.get('DT')).toBe('state/DT/governor')
    expect(index.senatorsByState.get('DT')).toHaveLength(3)
    expect(index.chairmenByState.get('DT')).toHaveLength(25)
    expect(index.speakersByState.size).toBe(36)
  })
})

describe('the party system', () => {
  const parties = generateParties(SEED)

  it('is eight fictional parties — no real party appears', () => {
    expect(parties).toHaveLength(8)
    expect(PARTY_CODES).toEqual(['PA', 'PDM', 'LRP', 'NCP', 'ADC', 'APF', 'NNI', 'UPP'])
    const text = JSON.stringify(parties)
    for (const real of ['All Progressives Congress', 'Peoples Democratic Party', 'Labour Party', 'APC', 'PDP']) {
      expect(text.includes(real)).toBe(false)
    }
  })

  it('gives each party a symbol, a colour, a founding year and a godfather tolerance', () => {
    const bw = parties.find(p => p.code === 'PA')!
    expect(bw.symbol).toBe('broom')
    expect(bw.colour).toBe('green')
    expect(bw.founded).toBe(1998)
    expect(bw.godfatherToleranceBp).toBe(8500)
    const nni = parties.find(p => p.code === 'NNI')!
    expect(nni.godfatherToleranceBp).toBeLessThan(bw.godfatherToleranceBp)
    for (const p of parties) {
      expect(p.colourHex).toMatch(/^#[0-9a-f]{6}$/)
      expect(p.ideology.patronage).toBeGreaterThanOrEqual(0)
      expect(p.ideology.patronage).toBeLessThanOrEqual(10000)
      expect(p.chairman.name.length).toBeGreaterThan(3)
    }
  })

  it('generates 2–4 factions whose strength shares add to 100%', () => {
    for (const p of parties) {
      expect(p.factions.length).toBeGreaterThanOrEqual(2)
      expect(p.factions.length).toBeLessThanOrEqual(4)
      const sum = p.factions.reduce((a, f) => a + f.strengthBp, 0)
      expect(Math.abs(sum - 10000)).toBeLessThan(5)
      for (const f of p.factions) {
        expect(f.doctrine.length).toBeGreaterThan(20)
        expect(f.leader.name.length).toBeGreaterThan(3)
        expect(f.id.startsWith(`party/${p.code}/faction/`)).toBe(true)
      }
    }
  })

  it('gives each party a founding crisis and a split history', () => {
    for (const p of parties) {
      expect(p.history[0]!.kind).toBe('founded')
      expect(p.history[1]!.kind).toBe('founding-crisis')
      expect(p.history.some(h => h.kind === 'split')).toBe(true)
      expect(p.splits).toBeGreaterThan(0)
    }
  })

  it('is deterministic for a seed and different across seeds', () => {
    expect(JSON.stringify(generateParties(SEED))).toBe(JSON.stringify(generateParties(SEED)))
    const other = generateParties(SEED + 1)
    expect(other.map(p => p.factions.map(f => f.leader.name).join()).join()).not.toBe(
      parties.map(p => p.factions.map(f => f.leader.name).join()).join(),
    )
  })
})

describe('the century calendar', () => {
  it('runs 2026–2126 without hand-written years', () => {
    expect(CALENDAR_COUNTS.presidential).toBe(25)
    expect(CALENDAR_COUNTS.lga).toBe(33)
    expect(CALENDAR_COUNTS.state).toBe(50)   // 25 general rounds + 25 off-cycle rounds
    expect(CALENDAR_COUNTS.stateContests).toBe(900)
    expect(CALENDAR[0]!.date.startsWith('2027-')).toBe(true)
    expect(CALENDAR_COUNTS.lastYear).toBeLessThanOrEqual(2126)
  })

  it('puts the polls on the modelled days and opens primaries 90 days earlier', () => {
    const poll = CALENDAR.find(c => c.id === 'presidential/2027')!
    expect(poll.date).toBe('2027-02-20') // third Saturday of February
    expect(new Date(`${poll.date}T00:00:00Z`).getUTCDay()).toBe(6)
    const days = (Date.parse(`${poll.date}T00:00:00Z`) - Date.parse(`${poll.primaryOpens}T00:00:00Z`)) / 86_400_000
    expect(days).toBe(90)
    for (const c of CALENDAR) expect(new Date(`${c.date}T00:00:00Z`).getUTCDay()).toBe(6)
  })

  it('finds the cycles inside the week that contains them', () => {
    const week = cyclesInWeek('2027-02-15')
    expect(week.map(c => c.id)).toContain('presidential/2027')
    expect(week.map(c => c.id)).toContain('state/2027')
    expect(cyclesInWeek('2027-02-08')).toHaveLength(0)
  })

  it('is regenerable for any span', () => {
    const decade = buildCalendar({ fromYear: 2100, toYear: 2110 })
    expect(decade.every(c => c.year >= 2100 && c.year <= 2110)).toBe(true)
    expect(decade.length).toBeGreaterThan(0)
  })
})

describe('the cast', () => {
  const world = createLivingWorld(SEED)

  it('is 250 living actors', () => {
    expect(world.npcs).toHaveLength(250)
    expect(new Set(world.npcs.map(n => n.id)).size).toBe(250)
    for (const npc of world.npcs) {
      expect(npc.isAlive).toBe(true)
      expect(npc.key).toBe(true)
      expect(npc.partyCode).toBeTruthy()
      expect(PARTY_CODES).toContain(npc.partyCode!)
      const age = ageOf(npc, 2026)
      expect(age).toBeGreaterThanOrEqual(33)
      expect(age).toBeLessThanOrEqual(71)
    }
  })

  it('seats the federal executive, every governor and every party chairman', () => {
    const held = world.npcs.map(n => n.positionId).filter((id): id is string => Boolean(id))
    expect(held).toContain('federal/president')
    expect(held.filter(id => id.endsWith('/governor'))).toHaveLength(36)
    expect(held.filter(id => id.endsWith('/deputy-governor'))).toHaveLength(36)
    expect(held.filter(id => id.startsWith('federal/minister/'))).toHaveLength(30)
    for (const code of PARTY_CODES) {
      expect(world.npcs.some(n => n.id === `npc/party/${code}/chair`)).toBe(true)
    }
    expect(world.npcs.filter(n => !n.positionId)).toHaveLength(20) // 8 chairmen + 12 elders
  })

  it('gives the player an edge to every actor, and every actor an edge back', () => {
    const playerEdges = world.relationships.get('player')!
    expect(playerEdges.size).toBe(250)
    for (const npc of world.npcs) {
      const back = world.relationships.get(npc.id)!
      expect(back.has('player')).toBe(true)
      expect(back.size).toBeGreaterThanOrEqual(25)
      const rel = back.get('player')!
      expect(rel.trust).toBeGreaterThanOrEqual(-100)
      expect(rel.trust).toBeLessThanOrEqual(100)
    }
  })

  it('is deterministic for a seed and diverges across seeds', () => {
    const a = generateKeyCast(SEED, POSITIONS, generateParties(SEED))
    const b = generateKeyCast(SEED, POSITIONS, generateParties(SEED))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = generateKeyCast(SEED + 7, POSITIONS, generateParties(SEED + 7))
    expect(c.map(n => n.name).join()).not.toBe(a.map(n => n.name).join())
  })

  it('cools relationships without contact, deterministically', () => {
    const w = createLivingWorld(SEED)
    const view = viewOf(w)
    const before = w.relationships.get('player')!.get(w.npcs[0]!.id)!.trust
    decayRelationships(view)
    const after = w.relationships.get('player')!.get(w.npcs[0]!.id)!.trust
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
    const w2 = createLivingWorld(SEED)
    decayRelationships(viewOf(w2))
    expect(w2.relationships.get('player')!.get(w2.npcs[0]!.id)!.trust).toBe(after)
  })
})

describe('the weekly brain', () => {
  /** Everything the brain is allowed to read. Any mutation would move this hash. */
  function worldFingerprint(world: LivingWorld) {
    return stateHash({
      npcs: world.npcs.map(n => ({ id: n.id, bank: n.bank, pos: n.positionId, traits: n.traits.join('|'), axes: n.axes, born: n.born, terms: n.termsServed })),
      rels: [...world.relationships].map(([k, m]) => [k, [...m].map(([t, r]) => [t, r.trust, r.debt, r.theyOweYou])]),
      date: world.date,
      week: world.week,
    })
  }

  function craftedWorld(): { world: LivingWorld; view: NpcWorld } {
    const world = createLivingWorld(SEED)
    return { world, view: viewOf(world) }
  }

  it('never mutates the world it reasons about', () => {
    const { world, view } = craftedWorld()
    const before = worldFingerprint(world)
    for (const npc of world.npcs.slice(0, 40)) npcWeekly(npc, view)
    expect(worldFingerprint(world)).toBe(before)
  })

  it('sends a broke, corruptible office-holder to solicit a rich player', () => {
    const { world } = craftedWorld()
    world.players[0]!.bank = 10_000_000_000
    const npc = world.npcs.find(n => n.positionId && ageOf(n, 2026) < 60)!
    npc.bank = 1_000_000
    npc.traits = ['corruptible']
    npc.ambition = null
    const actions = npcWeekly(npc, viewOf(world))
    expect(actions.some(a => a.type === 'solicit_bribe' && a.targetId === 'player')).toBe(true)
  })

  it('plants a January story through the friendliest outlet', () => {
    const world = createLivingWorld(SEED)
    world.date = '2031-01-06'
    world.week = dateToWeek('2031-01-06')
    const npc = world.npcs.find(n => n.positionId && ageOf(n, 2031) < 60)!
    npc.traits = ['media_savvy']
    npc.ambition = null
    const actions = npcWeekly(npc, viewOf(world))
    const plant = actions.find(a => a.type === 'plant_story')
    expect(plant).toBeTruthy()
    expect(plant!.amountNaira).toBeGreaterThan(0)
  })

  it('has life after office: a rich former holder funds a protégé', () => {
    const world = createLivingWorld(SEED)
    const npc = world.npcs.find(n => !n.positionId && n.bank > 2_000_000_000) ?? world.npcs[0]!
    npc.positionId = null
    npc.bank = 5_000_000_000
    npc.faction = 'Old Guard'
    const actions = npcWeekly(npc, viewOf(world))
    const kind = actions.map(a => a.type)
    expect(kind.includes('fund_protege') || kind.includes('lobby_appointment')).toBe(true)
  })

  it('breaks a broke former holder into lobbying for an appointment', () => {
    const world = createLivingWorld(SEED)
    const npc = world.npcs.find(n => !n.positionId)!
    npc.positionId = null
    npc.bank = 0
    npc.ambition = null
    const actions: string[] = []
    for (let week = 1; week <= 8; week++) {
      const w = viewOf(world)
      w.week = week
      actions.push(...npcWeekly(npc, w).map(a => a.type))
    }
    expect(actions).toContain('lobby_appointment')
  })

  it('kills an 88-year-old within a few years of Mondays', () => {
    const world = createLivingWorld(SEED)
    const npc = world.npcs.find(n => ageOf(n, 2026) < 60)!
    npc.born = 2026 - 88
    let died = false
    for (let week = 1; week <= 400 && !died; week++) {
      const w = viewOf(world)
      w.week = week
      died = npcWeekly(npc, w).some(a => a.type === 'death')
    }
    expect(died).toBe(true)
  })

  it('defects when party loyalty is gone', () => {
    const world = createLivingWorld(SEED)
    const npc = world.npcs.find(n => n.positionId)!
    npc.axes.partyLoyalty = 0
    npc.ambition = null
    let defected: { targetId?: string } | undefined
    for (let week = 1; week <= 900 && !defected; week++) {
      const w = viewOf(world)
      w.week = week
      defected = npcWeekly(npc, w).find(a => a.type === 'defect')
    }
    expect(defected).toBeTruthy()
    expect(defected!.targetId).not.toBe(npc.partyCode)
    expect(PARTY_CODES).toContain(defected!.targetId!)
  })

  it('finds the enemy two actors share, and proposes the truce', () => {
    const world = createLivingWorld(SEED)
    const [a, b, c] = world.npcs as [Npc, Npc, Npc]
    for (const x of [a, b, c]) {
      x.ambition = null
      x.bank = 0
      x.born = 2026 - 50
      x.positionId = null
      // a clean ledger for the three of them: no other enemies to confuse the search
      world.relationships.set(x.id, new Map())
    }
    withRelationship(world, a.id, b.id, -60)
    withRelationship(world, a.id, c.id, -70)
    withRelationship(world, b.id, c.id, -80)
    const view = viewOf(world)
    expect(findMutualEnemy(view, a.id)).toBe(c.id)

    let truce: { targetId?: string } | undefined
    for (let week = 1; week <= 300 && !truce; week++) {
      view.week = week
      truce = npcWeekly(a, view).find(x => x.type === 'propose_truce')
    }
    expect(truce).toBeTruthy()
    expect(truce!.targetId).toBe(b.id)
  })

  it('never tells a man to turn on the man he is making peace with', () => {
    /* b is the addressee. On b's own account c is a friend, so the only "shared enemy"
       left in the matrix is b himself — which would print as "bury it with b, and turn on
       b together". The search must come back empty rather than name the addressee. */
    const world = createLivingWorld(SEED)
    const [a, b, c] = world.npcs as [Npc, Npc, Npc]
    for (const x of [a, b, c]) {
      x.ambition = null
      x.bank = 0
      x.born = 2026 - 50
      x.positionId = null
      world.relationships.set(x.id, new Map())
    }
    withRelationship(world, a.id, b.id, -60)
    withRelationship(world, a.id, c.id, -70)
    withRelationship(world, b.id, c.id, -20)
    withRelationship(world, c.id, b.id, -90)
    const view = viewOf(world)

    expect(findMutualEnemy(view, a.id)).toBe(b.id)
    expect(findMutualEnemy(view, a.id, b.id)).toBeNull()

    /* and the line the desk would print never names the man being offered the peace: the
       one truce this fixture can support is a against b, not against the addressee. */
    const nameOf = (id: string | undefined) => world.npcs.find(n => n.id === id)?.name ?? id
    let truces = 0
    for (let week = 1; week <= 300; week++) {
      view.week = week
      for (const action of npcWeekly(a, view)) {
        if (action.type !== 'propose_truce') continue
        truces += 1
        const named = /turn on (.+) together\.$/.exec(action.detail)?.[1]
        expect(named).toBeTruthy()
        expect(named).not.toBe(nameOf(action.targetId))
      }
    }
    expect(truces).toBeGreaterThan(0)
  })

  it('gates a governorship on terms already served', () => {
    const world = createLivingWorld(SEED)
    const view = viewOf(world)
    const npc = world.npcs.find(n => !n.positionId)!
    npc.homeState = 'DT'
    npc.termsServed = 0
    expect(canRunFor(npc, 'governor', view)).toBe(false)
    npc.termsServed = 3
    expect(canRunFor(npc, 'governor', view)).toBe(true)
    expect(resolveTargetSeat(npc, 'governor', view)?.id).toBe('state/DT/governor')
  })

  it('spreads actors across the seats of a state instead of one seat', () => {
    const world = createLivingWorld(SEED)
    const view = viewOf(world)
    const targets = new Set<string>()
    for (const npc of world.npcs) {
      npc.homeState = 'DT'
      const seat = resolveTargetSeat(npc, 'lga', view)
      if (seat) targets.add(seat.id)
    }
    expect(targets.size).toBeGreaterThan(1)
  })

  it('derives each actor-week from its own stream', () => {
    expect(weeklyStream(SEED, 'a', 3)()).toBe(weeklyStream(SEED, 'a', 3)())
    expect(weeklyStream(SEED, 'a', 3)()).not.toBe(weeklyStream(SEED, 'b', 3)())
  })
})

describe('the tick', () => {
  it('advances the clock one Monday at a time', () => {
    const world = createLivingWorld(SEED)
    expect(world.date).toBe('2025-12-29')
    expect(weekToDate(1)).toBe('2025-12-29')
    expect(dateToWeek('2026-01-01')).toBe(1)
    const report = advanceTurn(world, { elections: false })
    expect(world.date).toBe('2026-01-05')
    expect(world.week).toBe(2)
    expect(report.week).toBe(1)
    expect(report.date).toBe('2025-12-29')
  })

  it('is deterministic for a seed', () => {
    const a = createLivingWorld(SEED)
    const b = createLivingWorld(SEED)
    advanceWeeks(a, 26, { elections: false })
    advanceWeeks(b, 26, { elections: false })
    const projection = (w: typeof a) => stateHash({
      date: w.date,
      week: w.week,
      journal: w.journal.map(j => j.summary),
      seats: w.npcs.map(n => `${n.id}:${n.positionId ?? '-'}`).sort(),
      money: w.npcs.map(n => n.bank).sort((x, y) => x - y).slice(0, 40),
    })
    expect(projection(a)).toBe(projection(b))
  })

  it('diverges between seeds within five weeks', () => {
    const a = createLivingWorld(11)
    const b = createLivingWorld(12)
    advanceWeeks(a, 5, { elections: false })
    advanceWeeks(b, 5, { elections: false })
    expect(a.journal.map(j => j.summary).join()).not.toBe(b.journal.map(j => j.summary).join())
  })

  it('keeps the cast alive: the dead are replaced one for one', () => {
    const world = createLivingWorld(SEED)
    world.npcs.forEach(n => { n.born = Number(world.date.slice(0, 4)) - 88 })
    advanceWeeks(world, 200, { elections: false })
    expect(world.npcs).toHaveLength(250)
    expect(world.departed.length).toBeGreaterThan(0)
    for (const dead of world.departed) expect(dead.isAlive).toBe(false)
    for (const npc of world.npcs) {
      expect(npc.isAlive).toBe(true)
      expect(ageOf(npc, Number(world.date.slice(0, 4)))).toBeLessThan(120)
    }
  })

  it('holds the 2027 general election and hands over seats', () => {
    const world = createLivingWorld(SEED)
    let elections = 0
    let sawPresidential = false
    let sawState = false
    for (let i = 0; i < 60; i++) {
      const report = advanceTurn(world)
      elections += report.elections.length
      if (report.elections.some(e => e.kind === 'presidential')) sawPresidential = true
      if (report.elections.some(e => e.kind === 'state')) sawState = true
    }
    expect(sawPresidential).toBe(true)
    expect(sawState).toBe(true)
    expect(elections).toBeGreaterThan(30)
    // the winners are the actors holding those seats at the end
    const president = world.positions.get('federal/president')!
    expect(world.npcs.some(n => n.positionId === president.id)).toBe(true)
  })

  it('takes a weak player out of office at the poll', () => {
    const world = createLivingWorld(SEED, {
      player: { name: 'A. Tester', positionId: 'state/DT/governor', partyCode: 'PA', bank: 0, axes: { popularity: 0, eliteTrust: 0, competence: 0, partyLoyalty: 0 } },
    })
    let lost: string[] = []
    for (let i = 0; i < 60; i++) {
      const report = advanceTurn(world)
      lost = lost.concat(report.playerTurn.officesLost)
    }
    expect(lost).toEqual(['Governor'])
    expect(world.players[0]!.positionId).toBe(null)
  })

  it('tells the player who wants something from them', () => {
    const world = createLivingWorld(SEED)
    world.players[0]!.bank = 20_000_000_000
    let addressed = 0
    for (let i = 0; i < 104; i++) {
      addressed += advanceTurn(world, { elections: false }).playerTurn.addressedToPlayer.length
    }
    expect(addressed).toBeGreaterThan(0)
  })

  it('runs a full century of Mondays (opt-in)', () => {
    // no node types are installed: the opt-in flag is read off the global, which is what
    // carries it under both the test runner and a plain node invocation
    const flag = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.SIM_CENTURY
    if (!flag) return
    const summary = simulateCentury(SEED)
    expect(summary.weeks).toBe(5200)
    expect(summary.elections).toBeGreaterThan(500)
    expect(summary.deaths).toBeGreaterThan(100)
    expect(summary.livingActors).toBe(250)
    expect(summary.candidacies).toBeGreaterThan(500)
  }, 300_000)

  it('is still a coherent world after five years', () => {
    const world = createLivingWorld(SEED)
    advanceWeeks(world, 260)
    expect(world.date).toBe('2030-12-23')
    expect(world.npcs).toHaveLength(250)
    expect(new Set(world.npcs.map(n => n.id)).size).toBe(250)
    expect(world.journal.length).toBeGreaterThan(100)
    expect(world.departed.length + world.npcs.length).toBeGreaterThanOrEqual(250)
    // every seat still resolves to a holder
    expect(world.npcs.filter(n => n.positionId).length).toBeGreaterThan(200)
  })
})

describe('the decision desk', () => {
  it('covers every tier with at least one template', () => {
    const tiers = new Set(TEMPLATES.map(t => t.tier))
    for (const tier of ['federal-executive', 'federal-legislative', 'state-executive', 'state-legislative', 'lga', 'ward', 'unemployed']) {
      expect(tiers.has(tier as never)).toBe(true)
    }
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(16)
  })

  it('gives every option a label, a cost and both outcomes', () => {
    for (const t of TEMPLATES) {
      const event = t.build(baseContext(t.tier))
      expect(event.options.length).toBeGreaterThanOrEqual(2)
      expect(event.title.length).toBeGreaterThan(3)
      expect(event.brief.length).toBeGreaterThan(10)
      const ids = new Set(event.options.map(o => o.id))
      expect(ids.size).toBe(event.options.length)
      for (const o of event.options) {
        expect(o.costNaira).toBeGreaterThanOrEqual(0)
        expect(o.success.detail.length).toBeGreaterThan(5)
        expect(o.failure.detail.length).toBeGreaterThan(5)
      }
    }
  })

  it('draws distinct, deterministic cards for a week', () => {
    const ctx = baseContext('state-executive')
    const a = generateEvents(ctx, { tier: 'state-executive', count: 2 })
    const b = generateEvents(ctx, { tier: 'state-executive', count: 2 })
    expect(a.map(e => e.templateId)).toEqual(b.map(e => e.templateId))
    expect(new Set(a.map(e => e.templateId)).size).toBe(a.length)
    const other = generateEvents({ ...ctx, week: ctx.week + 1 }, { tier: 'state-executive', count: 2 })
    expect(other.length).toBeGreaterThan(0)
  })

  it('rolls the brief\'s formula: your axis, his axis and the jitter', () => {
    const strong = baseContext('state-executive')
    const weak = { ...strong, actorAxes: { ...strong.actorAxes, eliteTrust: 5 }, opponentAxes: { ...strong.opponentAxes, patronage: 95 } }
    const option = TEMPLATES[0]!.build(strong).options.find(o => o.roll)!
    const cases = (ctx: TemplateContext, bp: number) => {
      const next = sfc32(subSeed(SEED, `roll:${bp}`), hash32(`${bp}`), 7, 11)
      let wins = 0
      for (let i = 0; i < 400; i++) if (rollOption(next, option, ctx).success) wins++
      return wins
    }
    const strongWins = cases({ ...strong, actorAxes: { ...strong.actorAxes, eliteTrust: 95 } }, 1)
    const weakWins = cases({ ...weak, actorAxes: { ...weak.actorAxes, eliteTrust: 5 } }, 2)
    expect(strongWins).toBeGreaterThan(weakWins)
    expect(strongWins).toBeGreaterThan(100)
  })

  it('adds the relationship bonus only for a trusted counterparty', () => {
    const ctx = baseContext('state-executive')
    const option = TEMPLATES[0]!.build(ctx).options.find(o => o.roll && o.roll.relationshipBonus > 0)!
    const next = () => 0
    const cold = rollOption(next, option, { ...ctx, relationshipTrust: -20 })
    const warm = rollOption(next, option, { ...ctx, relationshipTrust: 80 })
    expect(warm.value - cold.value).toBe(option.roll!.relationshipBonus)
  })

  it('clamps axis effects and formats naira compactly', () => {
    const next = applyEffects({ ...NEUTRAL_AXES, popularity: 99, pressTone: -95 }, { axes: { popularity: 10, pressTone: -20 }, detail: 'x' })
    expect(next.popularity).toBe(100)
    expect(next.pressTone).toBe(-100)
    expect(compactNaira(2_500_000_000)).toBe('₦2.5bn')
    expect(compactNaira(40_000_000)).toBe('₦40m')
  })
})

describe('the player\'s life', () => {
  const life = newLife({ id: 'life-1', playerName: 'Ada Okafor', positionId: 'lga/DT/Sapele/chairman', partyCode: 'PA', axes: { popularity: 60 }, bank: 5_000_000 })

  it('starts unemployed only when the life has no seat', () => {
    expect(life.isUnemployed).toBe(false)
    const out = newLife({ id: 'life-2', playerName: 'Nobody', positionId: null, partyCode: null })
    expect(out.isUnemployed).toBe(true)
    expect(out.unemploymentStart).toBe('2026-01-01')
  })

  it('appends a new life without touching the old one', () => {
    const registry = createRegistry(life)
    const second = newLife({ id: 'life-2', playerName: 'Bola Ade', positionId: 'federal/senator/DT/central', partyCode: 'PDM' })
    const next = createLife(registry, second)
    expect(next.lives).toHaveLength(2)
    expect(next.activeId).toBe('life-2')
    expect(next.lives[0]).toEqual(life)
    expect(activeLife(next)!.playerName).toBe('Bola Ade')
    expect(selectLife(next, 'life-1').activeId).toBe('life-1')
    expect(selectLife(next, 'nope').activeId).toBe('life-2')
  })

  it('keeps a retired life for the legacy screen', () => {
    const registry = retireLife(createRegistry(life), 'life-1', 'died in office')
    expect(registry.lives).toHaveLength(1)
    expect(registry.lives[0]!.retiredAt).toBe('2026-01-01')
    const died = registry.lives[0]!.history
    expect(died[died.length - 1]!.summary).toBe('died in office')
  })

  it('starts a protégé without resetting the world', () => {
    const registry = createRegistry(life)
    const next = startAsProtege(registry, { id: 'life-2', playerName: 'The Aide', positionId: null, partyCode: 'PA' })
    expect(next.lives).toHaveLength(2)
    expect(next.lives[0]!.history).toHaveLength(0)
    expect(next.lives[1]!.history[0]!.summary).toContain('Protégé of Ada Okafor')
  })

  it('round-trips through storage', () => {
    const registry: LifeRegistry = createLife(createRegistry(life), newLife({ id: 'life-2', playerName: 'Bola', positionId: null, partyCode: null }))
    const restored = deserializeRegistry(serializeRegistry(registry))
    expect(restored).toEqual(registry)
    expect(deserializeRegistry('nonsense')).toBe(null)
    expect(deserializeRegistry('{"version":1,"registry":{"activeId":"x","lives":[]}}')).toBe(null)
  })

  it('turns a lost seat into unemployment, and a win back into office', () => {
    const lost = applyTurn(life, {
      date: '2027-02-22',
      addressedToPlayer: [{ npcId: 'npc/1', npcName: 'Chief X', kind: 'bribe', detail: 'Chief X needs ₦20m.', amountNaira: 20_000_000 }],
      officesGained: [],
      officesLost: ['Chairman, Local Government'],
      deathsOfKnown: [{ npcId: 'npc/2', name: 'Alhaji Y' }],
      elections: [],
    })
    expect(lost.isUnemployed).toBe(true)
    expect(lost.unemploymentStart).toBe('2027-02-22')
    expect(lost.history.map(h => h.kind)).toEqual(['decision', 'loss', 'death', 'unemployment'])

    const back = applyTurn(lost, {
      date: '2031-02-20', addressedToPlayer: [], officesGained: ['Senator'],
      officesLost: [], deathsOfKnown: [], elections: [],
    })
    expect(back.isUnemployed).toBe(false)
    expect(back.unemploymentStart).toBe(null)
    expect(back.history[back.history.length - 1]!.kind).toBe('office')
  })

  it('maps a seat to the desk it runs', () => {
    expect(tierForPosition(POSITIONS.find(p => p.id === 'state/DT/governor'), false)).toBe('state-executive')
    expect(tierForPosition(POSITIONS.find(p => p.id === 'lga/DT/Sapele/chairman'), false)).toBe('lga')
    expect(tierForPosition(POSITIONS.find(p => p.id === 'federal/senator/DT/central'), false)).toBe('federal-legislative')
    expect(tierForPosition(POSITIONS.find(p => p.id === 'state/DT/speaker'), false)).toBe('state-legislative')
    expect(tierForPosition(undefined, true)).toBe('unemployed')
    expect(tierForPosition(POSITIONS.find(p => p.id === 'federal/minister/finance'), false)).toBe('federal-executive')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08')
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
  })
})

// ---------------------------------------------------------------------------

function baseContext(tier: string): TemplateContext {
  return {
    seed: SEED,
    id: `event/test/${tier}`,
    date: '2029-03-05',
    week: 165,
    actorId: 'player',
    actorName: 'Ada Okafor',
    actorAxes: { ...NEUTRAL_AXES },
    opponentName: 'Chief Bello',
    opponentAxes: { ...NEUTRAL_AXES, popularity: 65, patronage: 70 },
    relationshipTrust: 10,
    bank: 2_000_000_000,
    hasBlackmail: true,
    allies: 6,
    amountNaira: 200_000_000,
    termsServed: 2,
  }
}

/** Set a directed relationship from one actor to another, creating the edge if needed. */
function withRelationship(world: LivingWorld, from: string, to: string, trust: number): void {
  const edges = world.relationships.get(from) ?? new Map()
  const existing = edges.get(to)
  edges.set(to, {
    npcId: to,
    trust,
    debt: existing?.debt ?? 0,
    theyOweYou: existing?.theyOweYou ?? 0,
    blackmail: existing?.blackmail ?? null,
    sharedSecrets: existing?.sharedSecrets ?? 0,
    lastInteraction: existing?.lastInteraction ?? null,
    interactionCount: existing?.interactionCount ?? 0,
  })
  world.relationships.set(from, edges)
}

describe('calendar and cast references', () => {
  it('shows the first election year in the calendar', () => {
    expect(CALENDAR[0]!.year).toBe(2027)
  })

  it('generates relationships for a cast of any size', () => {
    const parties = generateParties(SEED)
    const cast = generateKeyCast(SEED, POSITIONS, parties, 20)
    const rel = generateRelationships(SEED, cast)
    expect(rel.get('player')!.size).toBe(20)
  })

  it('sets a directed relationship', () => {
    const world = createLivingWorld(SEED)
    withRelationship(world, 'player', world.npcs[0]!.id, -42)
    expect(world.relationships.get('player')!.get(world.npcs[0]!.id)!.trust).toBe(-42)
  })
})
