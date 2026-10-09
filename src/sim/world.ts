/* World container + golden-replay hash (§3.1, §3.4). */
import { Ledger, nairaToKobo, type AccountId } from './ledger'
import { makeStreams, type Streams } from './rng'
import { stateHash } from './hash'
import { beliefKey, type PerceptionEvent, updatePerception, type BP } from './perception'
import { dispatch } from './bus'
import type { World, Command, GameEvent } from './bus'

export interface SimWorld extends World {
  streams: Streams
}

export const OPENING_ACCOUNTS: Record<AccountId, bigint> = {
  mint: 0n,
  treasury: nairaToKobo('62,140,918,000'),
}

export function createWorld(seed: number): SimWorld {
  const ledger = new Ledger()
  // fund the treasury from the mint so opening money is conserved, not invented
  const opening = OPENING_ACCOUNTS.treasury
  if (opening > 0n) ledger.transfer(0, '::mint', 'treasury', opening, 'opening balance', 'sealed')
  const beliefs = new Map<string, BP>()
  for (const observer of ['political-class', 'institutions', 'the-people']) {
    for (const dim of ['reliability', 'competence', 'closeness']) {
      beliefs.set(beliefKey(observer, dim), 5000n)
    }
  }
  return { seed, week: 1, ledger, commandLog: [], eventLog: [], beliefs, eventSeq: 0, streams: makeStreams(seed) }
}

/** Advance one week: apply queued perception events, bump the clock. */
export function stepWeek(world: SimWorld, perceptionEvents: readonly PerceptionEvent[]): void {
  world.beliefs = updatePerception(world.beliefs, perceptionEvents)
  world.week += 1
}

/** Canonical hash of everything that matters — golden replays compare this. */
export function hashWorld(world: World): string {
  return stateHash({
    seed: world.seed,
    week: world.week,
    ledger: world.ledger.all(),
    commands: world.commandLog,
    events: world.eventLog,
    beliefs: [...world.beliefs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  })
}

/** Replay a command log from scratch — the anti-cheat/replay guarantee (§3.4). */
export function replay(seed: number, commands: readonly Command[]): SimWorld {
  const w = createWorld(seed)
  for (const c of commands) {
    const r = dispatch(w, c)
    if (!r.ok) throw new Error(`replay rejected ${c.id}: ${r.why}`)
  }
  return w
}

export type { Command, GameEvent }
