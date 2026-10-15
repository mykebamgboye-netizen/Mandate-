/* Shared simulation types consumed by src/sim-core.ts.

   src/sim-core.ts does:
     import type { SectorControl, NPCProfile, Shock, ShockType, PollResult, Reporter, Influencer, GazetteStory, PrimaryContest, INECResult, DefectionCase, CoalitionOffer, DirtyTrick, DirtyTrickResult, MinistryBudgetFight, CareerLevel, CareerProfile, SimState } from './types'

   This file is the module that import resolves to. It must be tracked:
   without it the whole simulation core fails to type-check.
*/

export interface SectorControl {
  president: {
    controls: ('army' | 'naira' | 'foreign')[]
    blamedFor: string[]
    faacShare: number
  }
  governor: {
    faacShare: number
    isFaacDependent: boolean
    cannotDirectCp: boolean
    lgaAllocationShare: number
  }
  lga: {
    directAllocation: number
    councils: number
    fiscalAutonomy: boolean
  }
  federalStructure: {
    totalFaac: number
    statesCount: number
    faacDependentStates: number
    lgaCount: number
  }
}

export type MemoryWeight = number

export interface NPCMemory {
  event: string
  strength: MemoryWeight
  timestamp: number
}

export interface NPCAmbition {
  type: 'power' | 'wealth' | 'legacy' | 'safety' | 'ideology'
  level: 1 | 2 | 3
  target: string
}

export interface NPCProfile {
  id: string
  name: string
  role: 'godfather' | 'governor' | 'senator' | 'minister' | 'lgachairman' | 'reporter' | 'influencer' | 'traditional ruler' | 'military' | 'judge'
  zone: 'north' | 'south' | 'east' | 'west' | 'central'
  state?: string
  lga?: string
  ambition: NPCAmbition
  memories: NPCMemory[]
  price: {
    patronage: number
    threat: number
    appointment: number
    media: number
  }
  stance: 'ally' | 'neutral' | 'rival'
  riskProfile: 'low' | 'medium' | 'high'
}

export type ShockType = 'oil-crash' | 'flood' | 'asuu-strike' | 'terror-attack' | 'currency-crash' | 'banditry'

export interface Shock {
  id: string
  type: ShockType
  severity: 1 | 2 | 3
  description: string
  affectedZones: string[]
  deathToll?: number
  economicImpact: number
  durationWeeks: number
  startWeek: number
  playerAccountable: boolean
}

export interface PollResult {
  zone: 'north' | 'south' | 'east' | 'west' | 'central'
  approval: number
  sampleSize: number
  marginOfError: number
  trend: 'up' | 'down' | 'steady'
  lastUpdated: number
}

export interface Reporter {
  id: string
  name: string
  outlet: string
  zone: 'north' | 'south' | 'east' | 'west' | 'central'
  price: {
    smear: number
    positive: number
    deepfake: number
  }
  risk: {
    efccProbe: boolean
    publicBacklash: boolean
  }
}

export interface Influencer {
  id: string
  name: string
  platform: 'twitter' | 'instagram' | 'facebook' | 'youtube' | 'traditional'
  reach: number
  price: {
    smear: number
    endorsement: number
    deepfake: number
  }
  risk: {
    efccProbe: boolean
    platformBan: boolean
  }
}

export interface GazetteStory {
  id: string
  title: string
  impact: 'market' | 'approval' | 'both'
  magnitude: 1 | 2 | 3
  description: string
  affectedSectors: string[]
}

export interface PrimaryContest {
  id: string
  office: 'president' | 'governor' | 'senator' | 'lgachairman'
  zones: string[]
  delegates: number
  delegateThreshold: number
  zoningRule: 'zoned' | 'open' | 'rotational'
  candidates: string[]
  frontRunner: string
  godfatherInfluence: string
  incumbent: boolean
  defectionRisk: number
}

export interface INECResult {
  declaredWinner: string
  results: Record<string, number>
  disputes: string[]
  validity: 'valid' | 'questionable' | 'nullified'
}

export interface DefectionCase {
  id: string
  senator: string
  fromParty: string
  toParty: string
  grounds: string
  status: 'pending' | 'upheld' | 'rejected'
  tribunalDate?: string | null
}

export interface CoalitionOffer {
  id: string
  toNPC: string
  type: 'patronage' | 'appointment' | 'threat' | 'mediaSupport'
  offering: {
    patronagePoints: number
    appointmentSlot: string
    mediaCoverage: boolean
    threatLevel: 'mild' | 'moderate' | 'severe'
  }
  acceptanceProbability: number
  backfireRisk: number
}

export type DirtyTrick =
  | 'bribe-official'
  | 'blackmail-target'
  | 'sponsor-protest'
  | 'plant-story'
  | 'deepfake-rival'
  | 'suppress-vote'

export interface DirtyTrickResult {
  success: boolean
  effect: string
  efccRisk: boolean
  icpcRisk: boolean
  publicReaction: 'approve' | 'disapprove' | 'indifferent'
  approvalChange: number
}

export interface MinistryBudgetFight {
  ministry: 'power' | 'finance' | 'petroleum' | 'works' | 'health' | 'education'
  requested: number
  allocated: number
  permanentSecretary: {
    name: string
    loyalty: number
    swing: number
  }
  traditionalRulerInfluence: {
    rulers: string[]
    swingPercentage: number
    costToSecure: number
  }
}

export type CareerLevel = 'lgachairman' | 'stategovernor' | 'president' | 'senator' | 'minister' | 'godfather' | 'exile'

export interface CareerProfile {
  level: CareerLevel
  office: string
  tenure: number
  achieved: string[]
  fallen: boolean
  postlossRole: 'godfather' | 'exile' | 'retired' | 'minister'
  godfatherOf: string[]
  exileLocation?: string
}

export interface SimState {
  sector: SectorControl
  turn: number
  week: number
  publicApproval: number
  shocks: Shock[]
  polls: PollResult[]
  npcProfiles: Record<string, NPCProfile>
  media: {
    reporters: Reporter[]
    influencers: Influencer[]
    gazetteStories: GazetteStory[]
  }
  electoral: {
    upcomingPrimaries: PrimaryContest[]
    ongoingDefection: DefectionCase | null
    incumbents: Record<string, string>
  }
  coalition: {
    offers: CoalitionOffer[]
    allies: string[]
  }
  dirtyTricks: {
    history: DirtyTrickResult[]
    lastUsed: DirtyTrick | null
  }
  career: CareerProfile
  money: {
    faacCurrent: number
    inflation: number
    nairaValue: number
  }
}
