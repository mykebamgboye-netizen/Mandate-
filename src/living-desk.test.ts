import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocBody } from './templates'
import { advanceTurn, createLivingWorld, type TurnReport } from './sim/living'
import type { PlayerTurn } from './sim/game-state'
import {
  LIVING_KEY, LIVING_PAPER_CAP, LIVING_PRESS_CAP,
  answerPaper, answersFromTray, applyAnswers, approachPaper, closeLivingWeek, deathPaper,
  ensureWorld, livingCast, livingPapers, livingPress, loadWorld, naira, pollPaper,
  resolvePartyCode, reviveWorld, runLivingWeek, seatIdForIdentity, serialiseWorld,
  upcomingPolls, worldSeedFor,
  type StampState,
} from './living-desk'

/* The living world is only visible if these four things hold: one desk keeps one Nigeria,
 * one week of desk runs exactly one Monday, the week arrives as paper the tray can open,
 * and nothing is ever rewritten from scratch on load. */

function mem() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
  }
}

const PLAYER = { name: 'M. A. Bamgboye', positionId: 'state/DT/governor', partyCode: 'PA', approval: 55 }

/** The last item of a list, without `Array.prototype.at`, which the repo's ES2020 lib
 *  deliberately does not know: the same lib is what stops an ES2022 method reaching the
 *  shipped bundle, and Vite transpiles syntax rather than polyfilling methods. */
function last<T>(list: readonly T[]): T {
  return list[list.length - 1]!
}

function playerTurn(over: Partial<PlayerTurn> = {}): PlayerTurn {
  return {
    date: '2026-01-05',
    addressedToPlayer: [],
    officesGained: [],
    officesLost: [],
    deathsOfKnown: [],
    elections: [],
    ...over,
  }
}

function report(over: Partial<TurnReport> = {}): TurnReport {
  return {
    week: 2,
    date: '2026-01-05',
    actions: [],
    deaths: [],
    elections: [],
    notes: [],
    playerTurn: playerTurn(),
    journal: [],
    ...over,
  }
}

/** The fields the tray and DocumentView read off every document. A paper missing one of
 *  these either crashes the shelf or renders a blank sheet. */
const REQUIRED_DOC_FIELDS = ['id', 'title', 'trayLine', 'stock', 'clip', 'stain', 'mark', 'date', 'authority', 'authorityText', 'recordId', 'audit'] as const

describe('the seat a desk sits at', () => {
  it('resolves the identity\'s own words onto a seat in the catalogue', () => {
    expect(seatIdForIdentity({ post: 'Executive Governor of Delta State', state: 'Delta' })).toBe('state/DT/governor')
    expect(seatIdForIdentity({ post: 'President' })).toBe('federal/president')
    expect(seatIdForIdentity({ post: 'Vice President' })).toBe('federal/vice-president')
    expect(seatIdForIdentity({ post: 'Chairman, Local Government', state: 'Delta', lga: 'Sapele' })).toBe('lga/DT/Sapele/chairman')
    expect(seatIdForIdentity({ post: 'Minister of the Federal Capital Territory', state: 'Federal Capital Territory' }))
      .toBe('federal/minister/federal-capital-territory')
    expect(seatIdForIdentity({ post: 'Minister of Works' })).toBe('federal/minister/works')
    expect(seatIdForIdentity({ post: 'Senator', state: 'Kano' })).toMatch(/^federal\/senator\/KN\//)
  })

  it('puts a council on that council\'s seat, not the first one alphabetically', () => {
    const sapele = seatIdForIdentity({ post: 'Chairman, Local Government', state: 'Delta', lga: 'Sapele' })
    const warri = seatIdForIdentity({ post: 'Chairman, Local Government', state: 'Delta', lga: 'Warri South' })
    expect(sapele).toBe('lga/DT/Sapele/chairman')
    expect(warri).toBe('lga/DT/Warri South/chairman')
    expect(sapele).not.toBe(warri)
  })

  it('leaves a seat it cannot place as null rather than guessing one', () => {
    expect(seatIdForIdentity({ post: 'Permanent Secretary' })).toBeNull()
    expect(seatIdForIdentity({ post: 'Vice President' })).toBe('federal/vice-president')
  })

  it('trusts a catalogue id it is handed', () => {
    expect(seatIdForIdentity({ positionId: 'federal/rep/LA/12', post: 'Governor', state: 'Delta' })).toBe('federal/rep/LA/12')
  })
})

describe('the seed of a desk\'s Nigeria', () => {
  it('is the same every time for the same desk', () => {
    const a = worldSeedFor({ name: 'A', post: 'Governor', state: 'Delta' })
    const b = worldSeedFor({ name: 'A', post: 'Governor', state: 'Delta' })
    expect(a).toBe(b)
    expect(a).toBeGreaterThan(0)
  })

  it('gives a different country to a different seat', () => {
    const delta = worldSeedFor({ name: 'A', post: 'Governor', state: 'Delta' })
    const kano = worldSeedFor({ name: 'A', post: 'Governor', state: 'Kano' })
    const council = worldSeedFor({ name: 'A', post: 'Chairman', state: 'Delta', lga: 'Sapele' })
    expect(new Set([delta, kano, council]).size).toBe(3)
  })

  it('maps a party name onto the world\'s party, and refuses one it does not know', () => {
    const world = createLivingWorld(7, { keyCast: 12 })
    expect(resolvePartyCode(world.parties, 'Progressive Alliance')).toBe('PA')
    expect(resolvePartyCode(world.parties, 'pa')).toBe('PA')
    expect(resolvePartyCode(world.parties, 'All Progressives Congress')).toBeNull()
  })
})

describe('the world on disk', () => {
  it('round-trips the week, the cast and the matrix', () => {
    const world = createLivingWorld(11, { keyCast: 20 })
    world.week = 9
    world.date = '2026-03-02'
    world.journal.push({ date: '2026-03-02', kind: 'betrayal', summary: 'Somebody moved.' })
    const edge = world.relationships.get('player')!
    const [firstId, firstRel] = [...edge][0]!
    firstRel.trust = -42

    const back = reviveWorld(serialiseWorld(world))!
    expect(back.week).toBe(9)
    expect(back.date).toBe('2026-03-02')
    expect(back.npcs).toHaveLength(world.npcs.length)
    expect(back.journal).toHaveLength(1)
    expect(back.relationships.get('player')?.get(firstId)?.trust).toBe(-42)
    expect(back.parties).toHaveLength(8)
    expect(back.positions.size).toBeGreaterThan(10_000)
    expect(back.seats.governorsByState.get('DT')).toBe('state/DT/governor')
  })

  it('refuses a payload it cannot trust instead of inventing a world', () => {
    expect(reviveWorld('not json')).toBeNull()
    expect(reviveWorld('{"seed":1}')).toBeNull()
    expect(reviveWorld(JSON.stringify({ seed: 1, week: 1, npcs: [], players: [] }))).toBeNull()
  })

  it('opens a country once and then advances the same one', () => {
    const storage = mem()
    const first = ensureWorld(storage, PLAYER)
    expect(first.created).toBe(true)

    // the desk identity may change between sessions; the country must not
    const second = ensureWorld(storage, { ...PLAYER, name: 'Someone Else', partyCode: 'PDM' })
    expect(second.created).toBe(false)
    expect(second.world.seed).toBe(first.world.seed)
    expect(second.world.players[0]!.name).toBe('Someone Else')
    expect(second.world.players[0]!.partyCode).toBe('PDM')
    expect(second.world.players[0]!.positionId).toBe('state/DT/governor')
  })

  it('keeps the country when the desk save is gone', () => {
    const storage = mem()
    runLivingWeek(storage, PLAYER)
    expect(storage.map.has(LIVING_KEY)).toBe(true)
    const reloaded = loadWorld(storage)
    expect(reloaded?.week).toBe(2)
  })
})

describe('one week of world per week of desk', () => {
  it('runs exactly one Monday and keeps it', () => {
    const storage = mem()
    const first = runLivingWeek(storage, PLAYER)
    expect(first.world.week).toBe(2)
    expect(first.report.week).toBe(1)

    const second = runLivingWeek(storage, PLAYER)
    expect(second.world.week).toBe(3)
    expect(second.report.week).toBe(2)
    expect(loadWorld(storage)?.week).toBe(3)
  })

  it('gives two identical desks the same country and the same weeks', () => {
    const a = runLivingWeek(mem(), PLAYER)
    const b = runLivingWeek(mem(), PLAYER)
    expect(a.world.seed).toBe(b.world.seed)
    expect(a.report.actions.map(x => x.detail)).toEqual(b.report.actions.map(x => x.detail))
  })

  it('puts paper on the tray every single week, even a quiet one', () => {
    const storage = mem()
    for (let week = 0; week < 8; week++) {
      const { world, report: r } = runLivingWeek(storage, PLAYER)
      const papers = livingPapers(world, r)
      expect(papers.length).toBeGreaterThan(0)
      expect(papers.length).toBeLessThanOrEqual(LIVING_PAPER_CAP)
      for (const doc of papers) {
        for (const field of REQUIRED_DOC_FIELDS) {
          expect(doc[field], `${doc.id} is missing ${field}`).toBeTruthy()
        }
      }
      // the country note is the floor: the world is never invisible
      expect(papers.some(d => d.id.endsWith('/country'))).toBe(true)
      expect(new Set(papers.map(d => d.id)).size).toBe(papers.length)
    }
  })
})

describe('the asks, the dead and the poll, as paper', () => {
  const world = createLivingWorld(21, { keyCast: 40 })
  const actor = world.npcs.find(n => n.positionId)!
  const actorId = actor.id

  it('turns a request for money into a note with the figure in it', () => {
    const papers = livingPapers(world, report({
      playerTurn: playerTurn({
        addressedToPlayer: [{
          npcId: actorId, npcName: actor.name, kind: 'bribe',
          detail: `${actor.name} needs ₦20m and knows you have it.`,
          amountNaira: 20_000_000,
        }],
      }),
    }))
    const ask = papers.find(d => d.kind === 'note' && d.title.includes(actor.name))!
    expect(ask.kind).toBe('note')
    expect(ask.mark).toBe('urgent')
    expect(ask.trayLine).toContain(actor.name)
    const lines = (ask as Extract<typeof ask, { kind: 'note' }>).lines
    expect(lines.join(' ')).toContain('₦20m')
    expect(lines.join(' ')).toContain('The register records only what you do next.')
  })

  it('prints a death the player knew about as an obituary clipping', () => {
    const dead = world.npcs[0]!
    const papers = livingPapers(world, report({
      playerTurn: playerTurn({ deathsOfKnown: [{ npcId: dead.id, name: dead.name }] }),
    }))
    const obit = papers.find(d => d.kind === 'clipping')!
    expect(obit).toBeTruthy()
    expect(obit.title).toContain(dead.name)
    expect(obit.mark).toBe('urgent')
    const clip = obit as Extract<typeof obit, { kind: 'clipping' }>
    expect(clip.headline).toContain('dies')
    expect(clip.paras.length).toBeGreaterThan(1)
  })

  it('marks a lost seat the way an urgent paper is marked', () => {
    const papers = livingPapers(world, report({
      playerTurn: playerTurn({ officesLost: ['Governor'] }),
    }))
    const poll = papers.find(d => d.id.endsWith('/poll'))!
    expect(poll.mark).toBe('urgent')
    expect(poll.title).toContain('YOU LOST')
    expect((poll as Extract<typeof poll, { kind: 'note' }>).lines.join(' ')).toContain('no longer hold')
  })

  it('hands a chief of staff the asks first, and never more than the cap', () => {
    const papers = livingPapers(world, report({
      playerTurn: playerTurn({
        addressedToPlayer: [
          { npcId: 'x1', npcName: 'A', kind: 'outreach', detail: 'outreach' },
          { npcId: 'x2', npcName: 'B', kind: 'bribe', detail: 'bribe', amountNaira: 1_000 },
          { npcId: 'x3', npcName: 'C', kind: 'favour', detail: 'favour' },
          { npcId: 'x4', npcName: 'D', kind: 'leak', detail: 'leak' },
          { npcId: 'x5', npcName: 'E', kind: 'truce', detail: 'truce' },
        ],
      }),
    }))
    expect(papers).toHaveLength(LIVING_PAPER_CAP)
    expect(papers[0]!.title).toContain('REQUEST FOR MONEY')
    expect(papers[1]!.title).toContain('LEAK')
    expect(last(papers).id.endsWith('/country')).toBe(true)
  })
})

describe('the desk answers, and the country hears it', () => {
  /** A world with one approach on the tray, and a way to stamp it. */
  function approachOnTray(kind: 'bribe' | 'favour' | 'leak' | 'truce' | 'outreach', amountNaira?: number) {
    const world = createLivingWorld(61, { keyCast: 40 })
    const actor = world.npcs.find(n => n.positionId)!
    const report0 = report({
      playerTurn: playerTurn({
        addressedToPlayer: [{
          npcId: actor.id, npcName: actor.name, kind,
          detail: `${actor.name} is asking.`,
          ...(amountNaira === undefined ? {} : { amountNaira }),
        }],
      }),
    })
    const papers = livingPapers(world, report0)
    const ask = papers.find(d => d.kind === 'note' && d.ask)!
    return { world, report0, actor, papers, ask }
  }

  const stamp = (label: 'APPROVED' | 'DECLINED') => ({ stamps: [{ label }] })

  it('carries the ask on the paper and tells the reader what each stamp does', () => {
    const { ask, actor } = approachOnTray('bribe', 20_000_000)
    expect(ask.kind).toBe('note')
    if (ask.kind !== 'note') throw new Error('unreachable')
    expect(ask.ask).toEqual({ npcId: actor.id, npcName: actor.name, kind: 'bribe', amountNaira: 20_000_000 })
    const body = ask.lines.join(' ')
    expect(body).toContain('Stamped APPROVED')
    expect(body).toContain('Stamped DECLINED')
  })

  it('reads a stamp back as an answer, and reads nothing else as one', () => {
    const { world, papers, ask } = approachOnTray('favour')
    const marks: Record<string, StampState> = { [ask.id]: stamp('APPROVED') }
    expect(answersFromTray(papers, marks)).toEqual([{
      docId: ask.id,
      npcId: (ask as Extract<typeof ask, { kind: 'note' }>).ask!.npcId,
      npcName: (ask as Extract<typeof ask, { kind: 'note' }>).ask!.npcName,
      kind: 'favour',
      granted: true,
    }])
    // an opened paper, an annotated one, and a refusal
    expect(answersFromTray(papers, {})).toHaveLength(0)
    expect(answersFromTray(papers, { [ask.id]: { stamps: [] } })).toHaveLength(0)
    expect(answersFromTray(papers, { [ask.id]: stamp('DECLINED') })[0]!.granted).toBe(false)
    // a stamp on a paper that asks nothing is not an answer: the country note and the
    // receipt itself carry no ask, so neither can be mistaken for a request
    const country = papers.find(d => d.id.endsWith('/country'))!
    const receipt = answerPaper(applyAnswers(world, answersFromTray(papers, { [ask.id]: stamp('APPROVED') })), report())!
    expect(answersFromTray([country, receipt], {
      [country.id]: stamp('APPROVED'),
      [receipt.id]: stamp('DECLINED'),
    })).toHaveLength(0)
  })

  it('moves the man who asked, on both sides of the relationship', () => {
    const { world, ask, actor } = approachOnTray('favour')
    const before = world.relationships.get('player')!.get(actor.id)!.trust
    const mirrorBefore = world.relationships.get(actor.id)!.get('player')!.trust
    const [effect] = applyAnswers(world, answersFromTray([ask], { [ask.id]: stamp('APPROVED') }))
    expect(effect!.granted).toBe(true)
    expect(effect!.before).toBe(before)
    expect(effect!.after).toBe(before + 12)
    expect(world.relationships.get(actor.id)!.get('player')!.trust).toBe(mirrorBefore + 12)
    // the man's own file carries it, and the week's decay cannot eat it
    expect(last(actor.history).event).toBe('desk granted')
    expect(world.relationships.get('player')!.get(actor.id)!.lastInteraction).toBe(world.date)
    expect(last(world.journal).kind).toBe('decision')
  })

  it('leaves a refused man colder than he came, on his own side too', () => {
    const { world, ask, actor } = approachOnTray('leak')
    const before = world.relationships.get(actor.id)!.get('player')!.trust
    const [effect] = applyAnswers(world, answersFromTray([ask], { [ask.id]: stamp('DECLINED') }))
    expect(effect!.granted).toBe(false)
    expect(effect!.after - effect!.before).toBe(-14)
    expect(world.relationships.get(actor.id)!.get('player')!.trust).toBe(before - 14)
    expect(effect!.outcome).toContain('cannot be walked back')
    expect(last(actor.history).event).toBe('desk refused')
  })

  it('pays a bribe out of the purse, and records what the purse could not hold', () => {
    const full = approachOnTray('bribe', 20_000_000)
    full.world.players[0]!.bank = 50_000_000
    const [paid] = applyAnswers(full.world, answersFromTray([full.ask], { [full.ask.id]: stamp('APPROVED') }))
    expect(paid!.paidNaira).toBe(20_000_000)
    expect(full.world.players[0]!.bank).toBe(30_000_000)
    expect(full.world.relationships.get('player')!.get(full.actor.id)!.debt).toBe(0)
    expect(paid!.after - paid!.before).toBe(18)
    expect(paid!.outcome).toContain('₦20m')

    const short = approachOnTray('bribe', 20_000_000)
    short.world.players[0]!.bank = 8_000_000
    const [part] = applyAnswers(short.world, answersFromTray([short.ask], { [short.ask.id]: stamp('APPROVED') }))
    expect(part!.paidNaira).toBe(8_000_000)
    expect(short.world.players[0]!.bank).toBe(0)
    expect(short.world.relationships.get('player')!.get(short.actor.id)!.debt).toBe(12_000_000)
    // a promise is worth less than a payment, and more than a refusal
    expect(part!.after - part!.before).toBe(6)
    expect(part!.outcome).toContain('₦12m')
  })

  it('runs one Monday with the answer already on the man\u2019s file', () => {
    const { world, ask, actor } = approachOnTray('bribe', 20_000_000)
    world.players[0]!.bank = 50_000_000
    const storage = mem()
    // put this world on disk as the desk's country, so the close advances the same one
    storage.setItem(LIVING_KEY, serialiseWorld(world))
    const { effects } = runLivingWeek(storage, { ...PLAYER, bank: 50_000_000 }, {
      tray: [ask],
      marks: { [ask.id]: stamp('APPROVED') },
    })
    expect(effects).toHaveLength(1)
    expect(effects[0]!.kind).toBe('bribe')
    expect(effects[0]!.paidNaira).toBe(20_000_000)
    // the number the patronage strip is written back from
    expect(loadWorld(storage)!.players[0]!.bank).toBe(30_000_000)
    expect(loadWorld(storage)!.relationships.get(actor.id)!.get('player')!.trust)
      .toBeGreaterThanOrEqual(effects[0]!.after - 1)
  })

  it('answers only what is on the closing tray, so an old stamp is never paid twice', () => {
    const { world, ask } = approachOnTray('bribe', 20_000_000)
    world.players[0]!.bank = 100_000_000
    const storage = mem()
    storage.setItem(LIVING_KEY, serialiseWorld(world))
    // the marked paper is from an earlier week: the tray it would have been answered on is gone
    const { effects } = runLivingWeek(storage, { ...PLAYER, bank: 100_000_000 }, {
      tray: [],
      marks: { [ask.id]: stamp('APPROVED') },
    })
    expect(effects).toHaveLength(0)
    expect(loadWorld(storage)!.players[0]!.bank).toBe(100_000_000)
  })

  /* The desk's week close does exactly one thing to the country: it calls closeLivingWeek
     with the tray it is filing. These tests walk that path — stamped paper in, papers,
     press, purse and polls out — so the wiring cannot rot behind a passing unit. */
  it('walks the desk\u2019s own close: stamped paper in, money, standing and paper out', () => {
    const { world, papers, actor } = approachOnTray('bribe', 20_000_000)
    const storage = mem()
    storage.setItem(LIVING_KEY, serialiseWorld(world))
    const bribe = papers.find(d => d.kind === 'note' && d.ask?.kind === 'bribe')!
    const close = closeLivingWeek({
      storage,
      player: { ...PLAYER, bank: 50_000_000 },
      tray: [bribe],
      marks: { [bribe.id]: stamp('APPROVED') },
    })
    expect(close.effects).toHaveLength(1)
    expect(close.bank).toBe(30_000_000)
    expect(close.approvalDelta).toBe(0)
    // the receipt is on Monday's tray, and the man is warmer than he was
    expect(close.papers[close.papers.length - 2]?.id.endsWith('/answers')).toBe(true)
    expect(close.world.relationships.get('player')!.get(actor.id)!.trust)
      .toBeGreaterThan(close.effects[0]!.before)
    // and the world on disk is the world the desk just ran
    expect(loadWorld(storage)!.week).toBe(close.world.week)
  })

  it('makes a leak it declines to buy back run: in the press, and in the polls', () => {
    /* the same desk, twice: one close lets the story run, the other buys it back */
    const desk = () => {
      const world = createLivingWorld(61, { keyCast: 40 })
      world.players[0]!.bank = 0
      const actor = world.npcs.find(n => n.positionId)!
      const leak = approachPaper(world, {
        npcId: actor.id, npcName: actor.name, kind: 'leak',
        detail: `${actor.name} has something and wants paying for it.`,
      }, report())
      const storage = mem()
      storage.setItem(LIVING_KEY, serialiseWorld(world))
      return { storage, leak }
    }
    const runs = desk()
    const close = closeLivingWeek({
      storage: runs.storage, player: PLAYER, tray: [runs.leak],
      marks: { [runs.leak.id]: stamp('DECLINED') },
    })
    expect(close.effects).toHaveLength(1)
    expect(close.approvalDelta).toBe(-4)
    // it ran: the press folder carries it, damaging, and it names the seat rather than a stranger
    const ran = close.stories.find(s => s.id.includes('/ran-'))
    expect(ran).toBeTruthy()
    expect(ran!.magnitude).toBe(3)
    expect(ran!.impact).toBe('approval')
    expect(ran!.title).toContain('The file on')
    expect(ran!.description).toContain('public approval')
    // and the receipt says what it cost, rather than leaving the number to be discovered
    const receipt = close.papers.find(d => d.id.endsWith('/answers'))!
    if (receipt.kind !== 'note') throw new Error('unreachable')
    expect(receipt.lines.join(' ')).toContain('Approval fell 4 points.')

    const bought = desk()
    const pulled = closeLivingWeek({
      storage: bought.storage, player: PLAYER, tray: [bought.leak],
      marks: { [bought.leak.id]: stamp('APPROVED') },
    })
    expect(pulled.effects).toHaveLength(1)
    expect(pulled.stories.some(s => s.id.includes('/ran-'))).toBe(false)
    expect(pulled.approvalDelta).toBe(0)
  })

  it('files a receipt the Monday after, and nothing at all when nothing was answered', () => {
    const { world, ask } = approachOnTray('outreach')
    const effects = applyAnswers(world, answersFromTray([ask], { [ask.id]: stamp('APPROVED') }))
    expect(answerPaper([], report())).toBeNull()
    const receipt = answerPaper(effects, report())!
    expect(receipt.title).toContain('THE DESK ANSWERED')
    expect(receipt.from).toBe('The desk register')
    const body = receipt.lines.join(' ')
    expect(body).toContain('GRANTED')
    expect(body).toContain('→')
    expect(body).toContain('left unstamped writes nothing')
    const html = renderToStaticMarkup(createElement(DocBody, { doc: receipt }))
    expect(html).toContain('WHAT THE STAMPS WROTE')
  })

  /* Reading a real year of the country turned up the reason four of the five kinds of
     approach never arrived: the brain looked the player up in the NPC index, which does not
     contain them, and skipped the desk's own edges. These two tests are the guard. */
  it('lets the country address the desk with more than money', () => {
    const world = createLivingWorld(4242)
    world.players[0]!.bank = 40_000_000_000
    const kinds = new Set<string>()
    for (let i = 0; i < 104; i++) {
      for (const a of advanceTurn(world).playerTurn.addressedToPlayer) kinds.add(a.kind)
    }
    expect(kinds.has('truce')).toBe(true)
    expect(kinds.size).toBeGreaterThan(1)
  })

  it('carries a refusal into the country: more enemies, and a leak no silent desk receives', () => {
    const probe = (refuse: boolean) => {
      const world = createLivingWorld(4242)
      world.players[0]!.bank = 40_000_000_000
      const refused = new Set<string>()
      let leaks = 0
      let leaksFromRefused = 0
      for (let i = 0; i < 156; i++) {
        const r = advanceTurn(world)
        for (const action of r.actions) {
          if (action.type === 'leak_blackmail' && action.targetId === 'player') {
            leaks += 1
            if (refused.has(action.npcId)) leaksFromRefused += 1
          }
        }
        if (!refuse) continue
        applyAnswers(world, r.playerTurn.addressedToPlayer.map(a => ({
          docId: `probe/${i}/${a.npcId}`, npcId: a.npcId, npcName: a.npcName,
          kind: a.kind, granted: false,
          ...(a.amountNaira === undefined ? {} : { amountNaira: a.amountNaira }),
        })))
        for (const a of r.playerTurn.addressedToPlayer) refused.add(a.npcId)
      }
      const edges = [...world.relationships.get('player')!.values()]
      return { leaks, leaksFromRefused, enemies: edges.filter(e => e.trust < -40).length }
    }
    const silent = probe(false)
    const refuser = probe(true)
    expect(refuser.enemies).toBeGreaterThan(silent.enemies)
    expect(refuser.leaks).toBeGreaterThan(silent.leaks)
    // and every leak that landed came from a man this desk had refused
    expect(refuser.leaksFromRefused).toBe(refuser.leaks)
  })

  it('puts the receipt on the tray, keeps the country note, and never exceeds the cap', () => {
    const { world, report0: r0, papers, ask } = approachOnTray('bribe', 5_000_000)
    const effects = applyAnswers(world, answersFromTray(papers, { [ask.id]: stamp('DECLINED') }))
    const after = livingPapers(world, r0, effects)
    expect(after.find(d => d.id.endsWith('/answers'))).toBeTruthy()
    expect(last(after).id.endsWith('/country')).toBe(true)
    expect(after.length).toBeLessThanOrEqual(LIVING_PAPER_CAP)
    // and a receipt never crowds the country note out of a busy week
    const busy = livingPapers(world, report({
      playerTurn: playerTurn({
        addressedToPlayer: world.npcs.slice(0, 8).map(n => ({
          npcId: n.id, npcName: n.name, kind: 'favour' as const, detail: 'an ask',
        })),
      }),
    }), effects)
    expect(busy.length).toBe(LIVING_PAPER_CAP)
    expect(last(busy).id.endsWith('/country')).toBe(true)
  })
})

describe('the press the world writes', () => {
  it('runs a leak at magnitude three and caps the week', () => {
    const world = createLivingWorld(31, { keyCast: 20 })
    const victim = world.npcs[3]!
    const stories = livingPress(world, report({
      actions: [
        { type: 'leak_blackmail', npcId: world.npcs[1]!.id, targetId: victim.id, detail: 'A tape on a name.' },
        { type: 'plant_story', npcId: world.npcs[2]!.id, amountNaira: 5_000_000, detail: 'A performance, printed.' },
        { type: 'defect', npcId: world.npcs[4]!.id, targetId: 'PDM', detail: 'A member crosses.' },
      ],
    }))
    expect(stories).toHaveLength(3)
    expect(stories.length).toBeLessThanOrEqual(LIVING_PRESS_CAP)
    expect(stories[0]!.title).toContain(victim.name)
    expect(stories[0]!.magnitude).toBe(3)
    expect(stories[0]!.affectedSectors).toEqual([victim.homeState])
    expect(stories.some(s => s.description.includes('₦5m'))).toBe(true)
  })

  it('prints nothing about a week that did nothing', () => {
    const world = createLivingWorld(31, { keyCast: 12 })
    expect(livingPress(world, report())).toHaveLength(0)
  })

  it('leads with the story this desk let run, however busy the week was', () => {
    const world = createLivingWorld(31, { keyCast: 20 })
    const ran = world.npcs[1]!
    const busy = report({
      actions: [
        { type: 'leak_blackmail', npcId: world.npcs[2]!.id, targetId: world.npcs[3]!.id, detail: 'A tape on a name.' },
        { type: 'leak_blackmail', npcId: world.npcs[4]!.id, targetId: world.npcs[5]!.id, detail: 'A ledger, photographed.' },
        { type: 'defect', npcId: world.npcs[6]!.id, targetId: 'PDM', detail: 'A member crosses.' },
        { type: 'plant_story', npcId: world.npcs[7]!.id, amountNaira: 5_000_000, detail: 'A placement.' },
      ],
      deaths: [{ npcId: world.npcs[8]!.id, name: world.npcs[8]!.name, successors: [] }],
    })
    const stories = livingPress(world, busy, [{
      docId: 'living/2/ask-leak-x', npcId: ran.id, npcName: ran.name, kind: 'leak',
      granted: false, before: 0, after: -14, paidNaira: 0, approvalDelta: -4,
      outcome: 'ran it',
    }])
    expect(stories).toHaveLength(LIVING_PRESS_CAP)
    expect(stories[0]!.id).toContain('/ran-')
  })
})

describe('the cast and the calendar', () => {
  it('reads trust as dots, keeps the raw number, and sorts by intensity', () => {
    const world = createLivingWorld(41, { keyCast: 30 })
    const edges = world.relationships.get('player')!
    const ids = [...edges.keys()].slice(0, 3)
    edges.get(ids[0]!)!.trust = 100
    edges.get(ids[1]!)!.trust = -100
    edges.get(ids[2]!)!.trust = 0
    const cast = livingCast(world, 1000)
    const byId = new Map(cast.map(m => [m.id, m]))
    expect(cast).toHaveLength(edges.size)
    expect(cast.every(m => m.loyalty >= 1 && m.loyalty <= 5)).toBe(true)
    expect(byId.get(ids[0]!)!.loyalty).toBe(5)
    expect(byId.get(ids[1]!)!.loyalty).toBe(1)
    expect(byId.get(ids[2]!)!.loyalty).toBe(3)
    // most intense first: an enemy at -100 outranks a stranger at +20
    expect(Math.abs(cast[0]!.trust)).toBe(100)
    for (let i = 1; i < cast.length; i++) {
      expect(Math.abs(cast[i - 1]!.trust)).toBeGreaterThanOrEqual(Math.abs(cast[i]!.trust))
    }
    expect(livingCast(world, 4)).toHaveLength(4)
  })

  it('turns a debt into weeks, and says nothing when nothing is owed', () => {
    const world = createLivingWorld(41, { keyCast: 30 })
    const edges = world.relationships.get('player')!
    const ids = [...edges.keys()].slice(0, 2)
    edges.get(ids[0]!)!.debt = 6_000_000_000
    edges.get(ids[1]!)!.debt = 0
    const byId = new Map(livingCast(world, 1000).map(m => [m.id, m]))
    expect(byId.get(ids[0]!)!.owes).toBe(6_000_000_000)
    expect(byId.get(ids[0]!)!.ROI_due_weeks).toBe(0)
    expect(byId.get(ids[1]!)!.ROI_due_weeks).toBeUndefined()
  })

  it('lists the polls still ahead, soonest first', () => {
    const polls = upcomingPolls('2026-01-05', 5)
    expect(polls).toHaveLength(5)
    for (const p of polls) expect(p.date >= '2026-01-05').toBe(true)
    const dates = polls.map(p => p.date)
    expect([...dates].sort()).toEqual(dates)
    expect(polls.some(p => p.kind === 'presidential')).toBe(true)
    expect(polls[0]!.dateLabel).toMatch(/\d{4}$/)
  })
})

describe('the papers render in the desk\u2019s own document view', () => {
  /* The world is only visible if the paper it writes actually draws. These papers go
     through the same DocBody switch every authored document does, so a note that would
     render blank fails here rather than on the player's screen. */
  it('draws every paper a week of world produces', () => {
    const storage = mem()
    for (let week = 0; week < 6; week++) {
      const { world, report: r } = runLivingWeek(storage, { ...PLAYER, approval: 20 + week * 12 })
      for (const doc of livingPapers(world, r)) {
        const html = renderToStaticMarkup(createElement(DocBody, { doc }))
        expect(html.length, `${doc.id} drew nothing`).toBeGreaterThan(40)
        expect(html).not.toContain('[object Object]')
        if (doc.kind === 'clipping') expect(html).toContain(doc.outlet)
        if (doc.kind === 'note') expect(html).toContain(doc.re)
      }
    }
  })

  it('draws the obituary and the return of the poll', () => {
    const world = createLivingWorld(51, { keyCast: 40 })
    const dead = world.npcs[0]!
    const obit = renderToStaticMarkup(createElement(DocBody, {
      doc: deathPaper(world, { npcId: dead.id, name: dead.name }, report()),
    }))
    expect(obit).toContain('OBITUARY')
    expect(obit).toContain(dead.name)

    const lost = renderToStaticMarkup(createElement(DocBody, {
      doc: pollPaper(report({ playerTurn: playerTurn({ officesLost: ['Governor'] }) })),
    }))
    expect(lost).toContain('RETURN OF THE POLL')
    expect(lost).toContain('The Returning Officer')
  })
})

describe('money and the small print', () => {
  it('prints naira the way the purse does', () => {
    expect(naira(1_400_000_000)).toBe('₦1.40bn')
    expect(naira(20_000_000)).toBe('₦20m')
    expect(naira(150_000)).toBe('₦150k')
    expect(naira(0)).toBe('₦0')
  })
})
