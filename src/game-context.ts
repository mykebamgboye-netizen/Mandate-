/* Shared game hooks: settings (Learner Mode, text scale, haptics), the aide,
   the per-sector literacy level used by glosses and the chain of hands, and the scenario
   the desk was derived from — so a document can print its own masthead, seat and dates. */
import { createContext, useContext } from 'react'
import { deriveScenario } from './scenario'
import type { Scenario } from './scenario'

export interface GameSettings {
  learnerMode: boolean
  textScale: 100 | 125 | 150
  haptics: boolean
}

export const DEFAULT_SETTINGS: GameSettings = {
  learnerMode: false,
  textScale: 100,
  haptics: true,
}

/** The context's stand-in before a record exists. Documents cannot be opened before a pack
    exists, so this is never rendered; it exists so the hook has a total type. */
export const FALLBACK_SCENARIO: Scenario = deriveScenario({
  name: null,
  age: null,
  pronouns: null,
  officeId: 'federal/president',
  tier: 'federal',
  post: 'President',
  route: 'elected',
  stateCode: 'FC',
  lgaName: null,
  partyCode: null,
  termStart: null,
})

export interface GameHooks {
  settings: GameSettings
  /** the desk the player's own record produced */
  scenario: Scenario
  /** costs ¼ Desk Hour when Learner Mode is off; always granted in the prototype */
  askAide: () => void
  literacy: number // 0..5 per sector (§43.4)
  setLiteracy: (n: number) => void
}

export const GameContext = createContext<GameHooks>({
  settings: DEFAULT_SETTINGS,
  scenario: FALLBACK_SCENARIO,
  askAide: () => undefined,
  literacy: 2,
  setLiteracy: () => undefined,
})

export const useGame = () => useContext(GameContext)
