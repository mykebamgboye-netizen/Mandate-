/* @mandate/scenario — the public API of the scenario layer.
   profile → scenario → pack. The desk, the documents and the budget all read from here, so
   nothing about who the player is or where they sit is written into the content module. */

export * from './types'
export { deriveScenario, defaultTermStart, nameParts, recordId, WORLD_NOW } from './derive'
export { scenarioInputFromFirstOpen, type FirstOpenChoices } from './first-open'
export { bootTarget, type BootFacts, type BootTarget } from './boot'
export { buildWeek } from './week'
export { PLACES, FCT_AREA_COUNCILS, placesFor } from './places'
export { moneyFor, scaleFor, payrollStaff, LGA_TOTAL } from './money'
export { wordsFor } from './lexicon'
