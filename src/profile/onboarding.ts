// @mandate/profile/onboarding — first-open flow: pick a federation post, run a short prologue,
// then show the generated profile as an "INFORMATION + vetting" one-pager before entering the sim.
// This is the new cold-boot path; the existing localStorage desk becomes one scenario among many.
// Public re-exports live in src/profile/prologue.ts (ORIGINS/BRINGERS/FIRST_SCARS/types).

export { ORIGINS, BRINGERS, FIRST_SCARS } from './prologue'
export type { Origin, OriginChoice, Bringer, BringerChoice, FirstScar, ScarChoice } from './prologue'
export type { ProfileSheet } from './profile-sheet'
export { sheetFromAxes, prologueAxes, startingPatronageBankForOffice } from './profile-sheet'
export type { OnboardingState, OnboardingPhase } from './profile-state'
export {
  defaultState,
  nextPrologueState,
  nextSheetState,
  acceptSheet,
} from './profile-state'
