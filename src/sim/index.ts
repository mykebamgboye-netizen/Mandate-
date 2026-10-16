/* @mandate/sim — pure simulation core. No DOM, no floats in rules,
   no Math.random, deterministic given seed + command log (§17.1, §3.4).

   The first block is the original desk engine (ledger, perception, command bus).
   The second is the living federation: geography, parties, the office catalogue, the
   press, the 250-actor cast and the weekly tick that runs them for a century. */
export * from './rng'
export * from './ledger'
export * from './hash'
export * from './perception'
export * from './bus'
export * from './world'

export * from './geo'
export * from './names'
export * from './parties'
export * from './positions'
export * from './media'
export * from './npcs'
export * from './events'
export * from './calendar'
export * from './game-state'
export * from './living'
