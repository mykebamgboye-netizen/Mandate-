/* REALPOLITIK SIM — Core Simulation Engine.
   Post-sector statehood model. No static systems. Trust is not 0-3.
   Allies are not badges. Every NPC has memory, ambition, and a price.
   Power ≠ control. Post-sector matrix exactly.
   Numbers are downstream of power. FAAC, IGR, inflation are outputs
   of political decisions and external shocks, not the core loop.
   The core loop is managing relationships under pressure.
*/

import type { SectorControl, NPCProfile, Shock, ShockType, PollResult, Reporter, Influencer, GazetteStory, PrimaryContest, INECResult, DefectionCase, CoalitionOffer, DirtyTrick, DirtyTrickResult, MinistryBudgetFight, CareerLevel, CareerProfile, SimState } from './types'

/** Post-Sector Power Matrix — exact distributions from the spec. */
export function createSectorControl(): SectorControl {
  return {
    president: {
      controls: ['army', 'naira'],
      blamedFor: ['oil price', 'floods', 'ASUU strike', 'insecurity', 'economic hardship'],
      faacShare: 0.55
    },
    governor: {
      faacShare: 0.2672,
      isFaacDependent: true,
      cannotDirectCp: true,
      lgaAllocationShare: 0.206
    },
    lga: {
      directAllocation: 0.206,
      councils: 774,
      fiscalAutonomy: false
    },
    federalStructure: {
      totalFaac: 0,
      statesCount: 36,
      faacDependentStates: 32,
      lgaCount: 774
    }
  }
}

/** Shock System — external shocks independent of player control. */
export class ShockSystem {
  private shocks: Shock[] = []
  private turnCounter = 0

  /* initialTurn: restore a saved session — shocks were triggered against a
     counter that has since advanced; without it a fresh build would treat every
     old shock as newly-triggered and never expiring. */
  constructor(initialShocks: Shock[] = [], initialTurn: number = 0) {
    this.shocks = initialShocks
    this.turnCounter = initialTurn
  }

  /** Advance the shock clock one week. advanceTurn calls this; a restored
      session can also call it to keep the counter in step with state.week. */
  tick(): void {
    this.turnCounter++
  }

  getWeek(): number {
    return this.turnCounter
  }

  triggerShock(type: ShockType, severity: 1 | 2 | 3, options: { affectedZones: string[]; durationWeeks: number; economicImpact: number; deathToll?: number; playerAccountable?: boolean }): Shock {
    const shock: Shock = {
      id: `shock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      severity,
      affectedZones: options.affectedZones,
      durationWeeks: options.durationWeeks,
      economicImpact: options.economicImpact,
      ...(options.deathToll !== undefined && { deathToll: options.deathToll }),
      playerAccountable: options.playerAccountable ?? false,
      startWeek: this.turnCounter,
      description: this.describeShock(type, severity)
    }
    this.shocks.push(shock)
    this.notifyShock(shock)
    return shock
  }

  private describeShock(type: ShockType, severity: 1 | 2 | 3): string {
    return (({
      'oil-crash': {
        1: 'Oil price moderate decline, revenue downward review',
        2: 'Oil price $111→$70, FAAC revenue drops 37%',
        3: 'Oil price $111→$30, FAAC revenue drops 73%, fiscal crisis across all tiers'
      },
      'flood': {
        1: 'Localized flooding, minor displacement',
        2: 'States-wide flooding, hundreds displaced, harvest damage',
        3: '600+ dead, states-wide submersion, agricultural collapse'
      },
      'asuu-strike': {
        1: 'ASUU warning strike, 1 month disruption',
        2: 'ASUU strike, 4 months disruption, academic year disrupted',
        3: 'ASUU strike, 8 months total, entire academic session lost'
      },
      'terror-attack': {
        1: 'Incident in one zone, 5-10 dead',
        2: 'Multiple zones, 50+ dead, nationwide fear',
        3: 'Coordinated attacks across zones, 200+ dead, national emergency'
      },
      'currency-crash': {
        1: 'Naira modest depreciation, 5% inflation uptick',
        2: 'Naira $1→₦550, inflation 15%',
        3: 'Naira $1→₦800, inflation 30%, purchasing power halved'
      },
      'banditry': {
        1: 'Localized herder-farmer clashes, few casualties',
        2: 'Widespread banditry, road travel restricted',
        3: 'National security crisis, states under curfew, economic disruption'
      }
    }[type] as Record<1 | 2 | 3, string>)[severity] || 'External shock event')
  }

  private notifyShock(_shock: Shock): void {
    // Shock impacts: economic, approval, NPC memories, media gazette stories
  }

  applyToState(state: SimState): SimState {
    let approvalChange = 0
    let inflationChange = 0

    /* Only shocks still in their duration window bite this week. isOngoing is
       the same predicate getActiveShocks reports with — before this, expired or
       never-expiring shocks (nothing ever advanced turnCounter) drained
       approval every turn forever. */
    for (const shock of this.shocks.filter(s => this.isOngoing(s))) {
      inflationChange += shock.economicImpact * (shock.severity / 3)

      if (shock.playerAccountable) {
        approvalChange -= shock.severity * 5
      } else {
        approvalChange -= shock.severity * 3
      }

      for (const npcId of Object.keys(state.npcProfiles)) {
        const npc = state.npcProfiles[npcId]
        const existingMemories = npc.memories.filter(m => m.event !== shock.id)
        npc.memories = [...existingMemories, { event: shock.id, strength: shock.severity * 10, timestamp: this.turnCounter }].slice(0, 10)
      }
    }

    state.money.inflation = Math.max(0, Math.min(100, state.money.inflation + inflationChange))
    state.publicApproval = Math.max(0, Math.min(100, state.publicApproval + approvalChange))

    return state
  }

  getActiveShocks(): Shock[] {
    return this.shocks.filter(s => this.isOngoing(s))
  }

  isOngoing(shock: Shock): boolean {
    return this.turnCounter - shock.startWeek < (shock.durationWeeks || 1)
  }
}

/** Media / Public Opinion System — dynamic polling by zone. */
export class MediaSystem {
  private polls: PollResult[] = []
  reporters: Reporter[] = []
  private influencers: Influencer[] = []
  private gazetteStories: GazetteStory[] = []
  private turnCounter = 0

  constructor(initialReporters: Reporter[] = [], initialInfluencers: Influencer[] = [], initialGazetteStories: GazetteStory[] = []) {
    this.reporters = initialReporters
    this.influencers = initialInfluencers
    this.gazetteStories = initialGazetteStories
  }

  conductPoll(zone: 'north' | 'south' | 'east' | 'west' | 'central', currentApproval: number): PollResult {
    const marginOfError = 3 + Math.random() * 4
    const rawApproval = currentApproval + (Math.random() - 0.5) * marginOfError * 2
    const approval = Math.max(0, Math.min(100, rawApproval))
    const trend = approval > currentApproval ? 'up' : approval < currentApproval ? 'down' : 'steady'

    const poll: PollResult = {
      zone,
      approval: Math.round(approval),
      sampleSize: 1000 + Math.random() * 500,
      marginOfError: Math.round(marginOfError),
      trend,
      lastUpdated: this.turnCounter
    }

    const existingIdx = this.polls.findIndex(p => p.zone === zone)
    if (existingIdx >= 0) {
      this.polls[existingIdx] = poll
    } else {
      this.polls.push(poll)
    }

    return poll
  }

  getPolls(): PollResult[] {
    return [...this.polls]
  }

  getPollForZone(zone: 'north' | 'south' | 'east' | 'west' | 'central'): PollResult | undefined {
    return this.polls.find(p => p.zone === zone)
  }

  payReporterSmear(reporterId: string, target: string): { success: boolean; result: { story: string; efccProbe: boolean; approvalChange: number } } {
    const reporter = this.reporters.find(r => r.id === reporterId)
    if (!reporter) {
      return { success: false, result: { story: 'Reporter not found', efccProbe: false, approvalChange: 0 } }
    }

    const efccProbe = Math.random() < 0.3
    const approvalChange = -2

    const story = reporter.name + ' of ' + reporter.outlet + ' publishes smear against ' + target + ': allegations of corruption and misuse of office'

    this.addGazetteStory({
      id: 'gazette-' + Date.now(),
      title: 'SMEAR: ' + target,
      impact: 'approval',
      magnitude: 2,
      description: story,
      affectedSectors: ['public_opinion']
    })

    return {
      success: true,
      result: { story: story, efccProbe, approvalChange }
    }
  }

  payInfluencerSmear(influencerId: string, target: string): { success: boolean; result: { post: string; efccProbe: boolean; platformRisk: boolean; approvalChange: number } } {
    const influencer = this.influencers.find(r => r.id === influencerId)
    if (!influencer) {
      return { success: false, result: { post: 'Influencer not found', efccProbe: false, platformRisk: false, approvalChange: 0 } }
    }

    const efccProbe = Math.random() < 0.25
    const platformRisk = Math.random() < 0.15
    const approvalChange = -3

    const post = influencer.name + ' (' + influencer.platform + ') posts: \"Everyone knows ' + target + ' is corrupt. The evidence is overwhelming.\"'

    this.addGazetteStory({
      id: 'gazette-' + Date.now(),
      title: 'INFLUENCER SWIPE: ' + target,
      impact: 'approval',
      magnitude: 3,
      description: post,
      affectedSectors: ['public_opinion', 'media']
    })

    return {
      success: true,
      result: { post, efccProbe, platformRisk, approvalChange }
    }
  }

  plantDeepfake(target: string, options: { viaReporter?: string; viaInfluencer?: string }): { success: boolean; result: { deepfake: string; efccProbe: boolean; approvalChange: number } } {
    const reporter = this.reporters.find(r => r.id === options.viaReporter)
    const influencer = this.influencers.find(r => r.id === options.viaInfluencer)

    const efccProbe = Math.random() < 0.4
    const approvalChange = -5

    let description: string
    if (reporter) {
      description = reporter.name + ' (' + reporter.outlet + ') has planted a deepfake video of ' + target + ' making inflammatory statements'
    } else if (influencer) {
      description = influencer.name + ' (' + influencer.platform + ') has shared a deepfake of ' + target + ' purportedly saying ' + target + ' destroyed the state'
    } else {
      description = 'A deepfake video of ' + target + ' has surfaced on social media making inflammatory statements against the government'
    }

    this.addGazetteStory({
      id: 'gazette-' + Date.now(),
      title: 'DEEPFAKE: ' + target,
      impact: 'both',
      magnitude: 3,
      description: description,
      affectedSectors: ['public_opinion', 'market']
    })

    return {
      success: true,
      result: { deepfake: description, efccProbe, approvalChange }
    }
  }

  /** The gazette stories as a snapshot for save/restore — the same array this
      system pushes into when it was constructed one, or its trimmed successor. */
  getStories(): GazetteStory[] {
    return this.gazetteStories
  }

  addGazetteStory(story: GazetteStory): void {
    this.gazetteStories.push(story)
    if (this.gazetteStories.length > 20) {
      this.gazetteStories = this.gazetteStories.slice(-20)
    }
  }

  tick(): void {
    this.turnCounter++
    this.polls = this.polls.filter(p => this.turnCounter - p.lastUpdated < 50)
  }
}

/** Electoral Politics System — playable primaries with delegate buying, zoning, INEC, tribunals, defections. */
export class ElectoralSystem {
  private primaryContests: PrimaryContest[] = []
  private defectionCases: DefectionCase[] = []
  private incumbents: Record<string, string> = {}

  constructor(initialIncumbents: Record<string, string> = {}) {
    this.incumbents = initialIncumbents
  }

  setPrimaryContest(contest: PrimaryContest): void {
    this.primaryContests.push(contest)
  }

  runPrimary(contestId: string, playerActions: { delegateBuying?: number; zoningCompliance?: boolean; godfatherAlignment?: string; campaignSpending?: number }): { winner: string; delegateCount: number; defectionRisk: number; efccRisk: boolean } {
    const contest = this.primaryContests.find(c => c.id === contestId)
    if (!contest) {
      throw new Error('Primary contest ' + contestId + ' not found')
    }

    const totalDelegates = contest.delegates
    let playerDelegates = 0
    let zoningBonus = 0

    if (contest.zoningRule === 'zoned' && playerActions.zoningCompliance) {
      zoningBonus = Math.floor(totalDelegates * 0.15)
    } else if (contest.zoningRule === 'rotational') {
      zoningBonus = Math.floor(totalDelegates * 0.05)
    }

    let godfatherBonus = 0
    if (playerActions.godfatherAlignment && contest.godfatherInfluence) {
      if (playerActions.godfatherAlignment === contest.godfatherInfluence) {
        godfatherBonus = Math.floor(totalDelegates * 0.25)
      }
    }

    const buyingEffect = Math.min(totalDelegates - playerDelegates - zoningBonus - godfatherBonus, playerActions.delegateBuying ?? 0)
    playerDelegates += buyingEffect
    playerDelegates += zoningBonus + godfatherBonus

    const opponentDelegates = totalDelegates - playerDelegates
    const winner = playerDelegates >= opponentDelegates ? 'player' : 'opponent'

    const baseDefectionRisk = contest.defectionRisk / 100
    const buyingDefectionRisk = (playerActions.delegateBuying ?? 0) * 0.02
    const finalDefectionRisk = Math.min(1, baseDefectionRisk + buyingDefectionRisk)

    const efccRisk = (playerActions.delegateBuying ?? 0) > 0 && Math.random() < 0.4

    return {
      winner: winner,
      delegateCount: playerDelegates,
      defectionRisk: Math.round(finalDefectionRisk * 100),
      efccRisk: efccRisk
    }
  }

  defectFromParty(senator: string, fromParty: string, toParty: string, grounds: string): DefectionCase {
    const defection: DefectionCase = {
      id: 'defection-' + Date.now(),
      senator: senator,
      fromParty: fromParty,
      toParty: toParty,
      grounds: grounds,
      status: 'pending',
      tribunalDate: null
    }
    this.defectionCases.push(defection)
    return defection
  }

  conductElection(office: string, votes: Record<string, number>): INECResult {
    const declaredWinner = Object.entries(votes).reduce(function (a, b) { return a[1] > b[1] ? a : b })[0]
    const results: Record<string, number> = { ...votes }
    const disputes: string[] = []

    if (votes[declaredWinner] / Object.values(votes).reduce(function (a, b) { return a + b }, 0) < 0.3) {
      disputes.push('Inconclusive result — runner-up demanding rerun')
    }

    const incumbentParty = this.incumbents[office]
    if (incumbentParty && incumbentParty !== declaredWinner) {
      disputes.push('Incumbent party disputes result')
    }

    const validity = disputes.length > 0 ? 'questionable' : 'valid'

    return { declaredWinner: declaredWinner, results: results, disputes: disputes, validity: validity }
  }

  tribunalRuling(caseId: string): { status: 'upheld' | 'rejected'; newParty?: string } {
    const idx = this.defectionCases.findIndex(function (c) { return c.id === caseId })
    if (idx < 0) {
      return { status: 'rejected' }
    }

    const case_ = this.defectionCases[idx]
    const outcomes: ('upheld' | 'rejected')[] = ['upheld', 'rejected', 'rejected', 'upheld', 'rejected']
    const result = outcomes[Math.floor(Math.random() * outcomes.length)]

    case_.status = result
    if (result === 'upheld') {
      case_.toParty = 'new/' + case_.senator
    }

    return { status: result, newParty: case_.toParty }
  }
}

/** Coalition-Building System — recruit/lose allies via patronage, appointments, threats. */
export class CoalitionBuilder {
  private offers: CoalitionOffer[] = []
  private allies: Set<string> = new Set()

  offerAlliance(offer: CoalitionOffer): { accepted: boolean; backfire: boolean; approvalChange: number } {
    const { toNPC, type, offering } = offer
    let acceptanceProbability = 0.5

    if (type === 'patronage') {
      acceptanceProbability += (offering.patronagePoints / 10) * 0.1
    } else if (type === 'appointment') {
      acceptanceProbability += 0.15
    } else if (type === 'threat') {
      acceptanceProbability += 0.1
    } else if (type === 'mediaSupport') {
      acceptanceProbability += 0.1
    }

    acceptanceProbability = Math.min(0.95, acceptanceProbability)

    const backfireChance = type === 'threat' ? 0.3 : 0.1
    const backfire = Math.random() < backfireChance

    if (acceptanceProbability > Math.random() && !backfire) {
      this.allies.add(toNPC)
      this.offers.push(offer)
      return { accepted: true, backfire: false, approvalChange: 1 }
    } else if (backfire) {
      this.allies.delete(toNPC)
      return { accepted: false, backfire: true, approvalChange: -3 }
    } else {
      return { accepted: false, backfire: false, approvalChange: 0 }
    }
  }

  loseAlliance(npcId: string): boolean {
    const wasAlly = this.allies.has(npcId)
    this.allies.delete(npcId)
    this.offers = this.offers.filter(function (o) { return o.toNPC !== npcId })
    return wasAlly
  }

  get Allies(): string[] {
    return [...this.allies].sort()
  }

  getAllyNPCProfile(npcId: string, npcProfiles: Record<string, NPCProfile>): NPCProfile | null {
    return npcProfiles[npcId] ?? null
  }
}

/** Bureaucratic Infighting — ministries fight for budget, permanent secretaries slow you, traditional rulers swing 5-10%. */
export class BureaucraticInfighting {
  private ministryFights: MinistryBudgetFight[] = []

  requestMinistryAllocation(ministry: MinistryBudgetFight['ministry'], requested: number): { allocated: number; permanentSecretary: { name: string; loyalty: number; swing: number }; traditionalRulerInfluence: { rulers: string[]; swingPercentage: number; costToSecure: number } } {
    const permanentSecretary = {
      name: this.generateName('permanent-secretary'),
      loyalty: 40 + Math.random() * 40,
      swing: 5 + Math.random() * 5
    }

    const traditionalRulerInfluence = {
      rulers: this.generateTraditionalRulers(),
      swingPercentage: 5 + Math.random() * 5,
      costToSecure: 10 + Math.random() * 20
    }

    const resistanceFactor = permanentSecretary.loyalty / 100
    const baseAllocation = requested * (1 - resistanceFactor * 0.3)
    const allocated = Math.max(1, Math.round(baseAllocation))

    this.ministryFights.push({ ministry: ministry, requested: requested, allocated: allocated, permanentSecretary: permanentSecretary, traditionalRulerInfluence: traditionalRulerInfluence })

    return { allocated: allocated, permanentSecretary: permanentSecretary, traditionalRulerInfluence: traditionalRulerInfluence }
  }

  secureTraditionalRulerSupport(_rulerIndex: number, patronageCost: number): { success: boolean; swingGained: number; approvalChange: number } {
    const success = patronageCost >= 20
    const swingGained = success ? 8 : 0
    const approvalChange = success ? 2 : -2
    return { success: success, swingGained: swingGained, approvalChange: approvalChange }
  }

  private generateName(prefix: string): string {
    const names: Record<string, string[]> = {
      'permanent-secretary': ['Alhaji', 'Dr', 'Prof', 'Chief'],
      'traditional-ruler': ['Oba', 'Emir', 'Sultan', 'Amir']
    }
    const nameSet = names[prefix] || ['Unknown']
    return nameSet[Math.random() * nameSet.length | 0]
  }

  private generateTraditionalRulers(): string[] {
    const rulerNames = ['Oba of Lagos', 'Emir of Kano', 'Sultan of Sokoto', 'Amir of Zamfara', 'Oba of Benin']
    const count = 2 + Math.random() * 3
    var rulers: string[] = []
    for (var i = 0; i < count; i++) {
      rulers.push(rulerNames[i % rulerNames.length])
    }
    return rulers
  }
}

/** Career Trajectory System — fluid career: LGA→Governor→President, appointed roles, senator, or postless godfather/exile. */
export class CareerSystem {
  private career: CareerProfile

  constructor(initialLevel: CareerLevel = 'lgachairman', initialOffice: string = 'local/chairman') {
    this.career = {
      level: initialLevel,
      office: initialOffice,
      tenure: 0,
      achieved: [],
      fallen: false,
      postlossRole: 'godfather',
      godfatherOf: [],
      exileLocation: undefined
    }
  }

  advanceLevel(): CareerProfile {
    const levelOrder: CareerLevel[] = ['lgachairman', 'stategovernor', 'president', 'senator', 'minister', 'godfather', 'exile']
    const currentIdx = levelOrder.indexOf(this.career.level)

    if (currentIdx >= levelOrder.length - 1) {
      return this.career
    }

    const nextLevel = levelOrder[currentIdx + 1]
    let nextOffice: string

    if (nextLevel === 'stategovernor') {
      nextOffice = 'state/governor'
    } else if (nextLevel === 'president') {
      nextOffice = 'federal/president'
    } else if (nextLevel === 'senator') {
      nextOffice = 'state/senator'
    } else if (nextLevel === 'minister') {
      nextOffice = 'federal/minister'
    } else if (nextLevel === 'godfather') {
      nextOffice = 'postless/godfather'
    } else if (nextLevel === 'exile') {
      nextOffice = 'postless/exile'
    } else {
      nextOffice = 'local/chairman'
    }

    const tenureCarryover = Math.max(0, this.career.tenure - 2)

    this.career = {
      level: nextLevel,
      office: nextOffice,
      tenure: tenureCarryover,
      achieved: this.career.achieved,
      fallen: this.career.fallen,
      postlossRole: this.determinePostlossRole(nextLevel),
      godfatherOf: this.career.godfatherOf,
      exileLocation: this.career.exileLocation
    }

    return this.career
  }

  private determinePostlossRole(level: CareerLevel): 'godfather' | 'exile' | 'retired' | 'minister' {
    if (level === 'president') {
      return 'godfather'
    } else if (level === 'stategovernor') {
      return 'godfather'
    } else if (level === 'senator') {
      return 'minister'
    } else if (level === 'minister') {
      return 'retired'
    } else if (level === 'lgachairman') {
      return 'godfather'
    } else if (level === 'godfather') {
      return 'exile'
    } else if (level === 'exile') {
      return 'exile'
    } else {
      return 'retired'
    }
  }

  removeFromOffice(reason: 'impeachment' | 'lost_primary' | 'scandal' | 'defector'): CareerProfile {
    this.career.fallen = true
    var postloss: 'godfather' | 'exile' | 'retired' | 'minister'

    if (reason === 'impeachment') {
      postloss = 'exile'
    } else if (reason === 'lost_primary') {
      postloss = 'godfather'
    } else if (reason === 'scandal') {
      postloss = 'exile'
    } else if (reason === 'defector') {
      postloss = 'godfather'
    } else {
      postloss = 'exile'
    }

    this.career.postlossRole = postloss

    if (postloss === 'godfather') {
      this.career.godfatherOf = ['defeated_rival_1', 'disgruntled_delegate_1']
    }

    return this.career
  }

  getCareer(): CareerProfile {
    return { ...this.career }
  }

  getLevel(): CareerLevel {
    return this.career.level
  }
}

/** Main SimState builder. */
export function createInitialSimState(
  sectorControl?: SectorControl,
  initialPublicApproval: number = 50,
  initialMoney: { faacCurrent: number; inflation: number; nairaValue: number } = { faacCurrent: 100, inflation: 0, nairaValue: 1 }
): SimState {
  return {
    sector: sectorControl ?? createSectorControl(),
    turn: 0,
    week: 1,
    publicApproval: initialPublicApproval,
    shocks: [],
    polls: [],
    npcProfiles: {},
    media: {
      reporters: [],
      influencers: [],
      gazetteStories: []
    },
    electoral: {
      upcomingPrimaries: [],
      ongoingDefection: null,
      incumbents: {}
    },
    coalition: {
      offers: [],
      allies: []
    },
    dirtyTricks: {
      history: [],
      lastUsed: null
    },
    career: {
      level: 'lgachairman' as CareerLevel,
      office: 'local/chairman',
      tenure: 0,
      achieved: [],
      fallen: false,
      postlossRole: 'godfather',
      godfatherOf: [],
      exileLocation: undefined
    } as CareerProfile,
    money: {
      ...initialMoney,
      inflation: initialMoney.inflation,
      nairaValue: initialMoney.nairaValue
    }
  }
}

/** Advance the simulation turn. */
export function advanceTurn(state: SimState, shockSystem: ShockSystem, mediaSystem: MediaSystem): SimState {
  mediaSystem.tick()
  shockSystem.tick() // age the shock clock before applying this week's bites

  state = shockSystem.applyToState(state)

  var activeShocks = shockSystem.getActiveShocks()
  if (activeShocks.length > 0 && Math.random() < 0.1) {
    var shockTypes: ShockType[] = ['oil-crash', 'flood', 'asuu-strike', 'currency-crash']
    var newType = shockTypes[Math.floor(Math.random() * shockTypes.length) as number]
    var severity: 1 | 2 | 3 = [1, 2, 3][Math.floor(Math.random() * 3)] as 1 | 2 | 3

    var affectedZones: string[]
    var economicImpact: number
    var durationWeeks: number

    if (newType === 'oil-crash') {
      affectedZones = ['all']
      economicImpact = 5 + severity * 15
      durationWeeks = 8
    } else if (newType === 'flood') {
      affectedZones = ['south', 'east']
      economicImpact = 8 + severity * 10
      durationWeeks = 6
    } else if (newType === 'asuu-strike') {
      affectedZones = ['all']
      economicImpact = 3 + severity * 5
      durationWeeks = 12
    } else if (newType === 'currency-crash') {
      affectedZones = ['all']
      economicImpact = 10 + severity * 15
      durationWeeks = 4
    } else {
      affectedZones = ['all']
      economicImpact = 5
      durationWeeks = 4
    }

    shockSystem.triggerShock(newType, severity, {
      affectedZones: affectedZones,
      durationWeeks: durationWeeks,
      economicImpact: economicImpact,
      playerAccountable: false
    })
  }

  var zones: ('north' | 'south' | 'east' | 'west' | 'central')[] = ['north', 'south', 'east', 'west', 'central']
  for (var z = 0; z < zones.length; z++) {
    var zone = zones[z]
    var baseApproval = state.publicApproval
    var poll = mediaSystem.conductPoll(zone, baseApproval)
    state.polls.push(poll)
  }

  state.turn++
  state.week++

  return state
}

/* Which off-the-books move leaves a trail, and to which agency. These are read
   by executeDirtyTrick below and by the desk's ops folder, which has to warn a
   hand BEFORE it presses the button — one table, not two that can drift. */
export const EFCC_RISK: Record<DirtyTrick, boolean> = {
  'bribe-official': true,
  'blackmail-target': true,
  'sponsor-protest': true,
  'plant-story': true,
  'deepfake-rival': true,
  'suppress-vote': false
}
export const ICPC_RISK: Record<DirtyTrick, boolean> = {
  'bribe-official': false,
  'blackmail-target': true,
  'sponsor-protest': false,
  'plant-story': true,
  'deepfake-rival': true,
  'suppress-vote': false
}

/** Execute a dirty trick — bribe, blackmail, sponsor protest, plant story — with EFCC/ICPC risk. */
export function executeDirtyTrick(
  trick: DirtyTrick,
  context: { target?: string; actorNPC?: string; money?: number; mediaSystem?: MediaSystem; shockSystem?: ShockSystem; npcProfiles?: Record<string, NPCProfile>; state: SimState }
): DirtyTrickResult {
  var _mediaSystem = context.mediaSystem
  var _shockSystem = context.shockSystem
  var _npcProfiles = context.npcProfiles
  const efccRiskMap: Record<DirtyTrick, boolean> = EFCC_RISK
  const icpcRiskMap: Record<DirtyTrick, boolean> = ICPC_RISK

  var success = false
  var effect = ''
  var approvalChange = 0

  switch (trick) {
    case 'bribe-official': {
      success = Math.random() < 0.7
      effect = success ? 'Official granted your request — patronage points delivered' : 'Official refused the bribe'
      approvalChange = success ? 2 : -3
      break
    }

    case 'blackmail-target': {
      var targetNpc = _npcProfiles?.[context.target ?? '']
      if (!targetNpc) {
        return { success: false, effect: 'Target NPC not found', efccRisk: icpcRiskMap['blackmail-target'], icpcRisk: icpcRiskMap['blackmail-target'], approvalChange: 0, publicReaction: 'indifferent' }
      }
      success = Math.random() < 0.6
      effect = success ? 'Blackmail secured on ' + context.target + ': ' + targetNpc.name + ' is now controllable' : 'Blackmail attempt failed — target was cautious'
      approvalChange = success ? 1 : -5
      break
    }

    case 'sponsor-protest': {
      success = Math.random() < 0.8
      effect = success ? 'Protest staged — supporters gathered, media coverage generated' : 'Protest failed — security forces dispersed crowd'
      approvalChange = success ? -2 : -8
      break
    }

    case 'plant-story': {
      if (!_mediaSystem) {
        return { success: false, effect: 'Media system not available', efccRisk: icpcRiskMap['plant-story'], icpcRisk: icpcRiskMap['plant-story'], approvalChange: 0, publicReaction: 'indifferent' }
      }
      var storyTitle = 'New revelations about ' + (context.target ?? 'the administration') + ': exclusive Gazette report'
      success = true // planting stories in gazette always "succeeds" mechanically
      effect = 'Gazette story published — public opinion shifts'

      var storyResult = _mediaSystem.plantDeepfake(context.target ?? 'rival', {
        viaReporter: _mediaSystem.reporters[Math.floor(Math.random() * _mediaSystem.reporters.length)].id
      })
      approvalChange = storyResult.result.approvalChange

      _mediaSystem.addGazetteStory({
        id: 'gazette-' + Date.now(),
        title: storyTitle,
        impact: 'approval',
        magnitude: 2,
        description: storyResult.result.deepfake,
        affectedSectors: ['public_opinion']
      })

      break
    }

    case 'deepfake-rival': {
      if (!_mediaSystem) {
        return { success: false, effect: 'Media system not available', efccRisk: icpcRiskMap['deepfake-rival'], icpcRisk: icpcRiskMap['deepfake-rival'], approvalChange: 0, publicReaction: 'indifferent' }
      }
      var deepfakeResult = _mediaSystem.plantDeepfake(context.target ?? 'rival', {
        viaReporter: _mediaSystem.reporters[Math.floor(Math.random() * _mediaSystem.reporters.length)].id
      })
      success = true
      effect = deepfakeResult.result.deepfake
      approvalChange = deepfakeResult.result.approvalChange
      break
    }

    case 'suppress-vote': {
      success = Math.random() < 0.5
      effect = success ? 'Voter suppression enacted — opposition turnout reduced' : 'Suppression attempt detected and condemned'
      approvalChange = success ? -5 : -12
      break
    }
  }

  var result: DirtyTrickResult = {
    success: success,
    effect: effect,
    efccRisk: efccRiskMap[trick],
    icpcRisk: icpcRiskMap[trick],
    publicReaction: approvalChange < 0 ? 'disapprove' : approvalChange > 0 ? 'approve' : 'indifferent',
    approvalChange: approvalChange
  }

  if (_mediaSystem) {
    _mediaSystem.addGazetteStory({
      id: 'gazette-' + Date.now(),
      title: 'DIRTY TRICK: ' + trick.replace('-', ' ').toUpperCase(),
      impact: 'both',
      magnitude: trick === 'deepfake-rival' || trick === 'plant-story' ? 3 : 2,
      description: effect,
      affectedSectors: ['public_opinion', 'market']
    })
  }

  if (_shockSystem && result.efccRisk) {
    _shockSystem.triggerShock('currency-crash', 2, {
      affectedZones: ['all'],
      economicImpact: 3,
      durationWeeks: 4,
      playerAccountable: true // player is being investigated
    })
  }

  if (result.approvalChange !== 0 && _npcProfiles) {
    context.state.publicApproval = Math.max(0, Math.min(100, context.state.publicApproval + result.approvalChange))
  }

  return result
}