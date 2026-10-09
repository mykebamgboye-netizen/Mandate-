/* Shared game hooks: settings (Learner Mode, text scale, haptics), the aide,
   and the per-sector literacy level used by glosses and the chain of hands. */
import { createContext, useContext } from 'react'

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

export interface GameHooks {
  settings: GameSettings
  /** costs ¼ Desk Hour when Learner Mode is off; always granted in the prototype */
  askAide: () => void
  literacy: number // 0..5 per sector (§43.4)
  setLiteracy: (n: number) => void
}

export const GameContext = createContext<GameHooks>({
  settings: DEFAULT_SETTINGS,
  askAide: () => undefined,
  literacy: 2,
  setLiteracy: () => undefined,
})

export const useGame = () => useContext(GameContext)
