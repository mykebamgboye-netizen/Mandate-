/* Command → event bus (§3.5): legality, feasibility, exposure, then events.
   State changes only by applying events. Everything logged, everything replayable. */
import type { Ledger, Visibility } from './ledger'

export interface Command {
  id: string
  actorId: string
  type: string
  payload: Record<string, unknown>
  week: number
}

export interface GameEvent {
  id: number
  week: number
  type: string
  subjects: string[]
  payload: Record<string, unknown>
  visibility: Visibility
}

export type RuleResult = { ok: true } | { ok: false; why: string }

const OK: RuleResult = { ok: true }
const no = (why: string): RuleResult => ({ ok: false, why })

/* Rules as data (§3.1): office powers keyed by constitution section. */
export const POWERS: Record<string, { section: string; powers: string[] }[]> = {
  governor: [
    { section: 's.176', powers: ['sign.memo', 'appoint.commissioner', 'deploy.request'] },
    { section: 's.162', powers: ['receive.faac'] },
    { section: 'ss.121-125', powers: ['budget.allocate'] },
  ],
  commissioner: [
    { section: 's.192', powers: ['propose.memo'] },
  ],
}

export const ACTORS: Record<string, { office: string }> = {
  'pc': { office: 'governor' },
  'agoro': { office: 'commissioner' },
  'coa': { office: 'commissioner' },
}

export interface World {
  seed: number
  week: number
  ledger: Ledger
  commandLog: Command[]
  eventLog: GameEvent[]
  beliefs: Map<string, bigint>
  eventSeq: number // per-world, never module-global — replay must reproduce ids exactly
}

function hasPower(actorId: string, power: string): boolean {
  const office = ACTORS[actorId]?.office
  if (!office) return false
  return (POWERS[office] ?? []).some(row => row.powers.includes(power))
}

export type DispatchRule = (cmd: Command, world: World) => RuleResult

/* Per-command legality/feasibility/exposure rules. */
export const RULES: Record<string, { power?: string; check?: DispatchRule; emit: (cmd: Command, world: World) => GameEvent[] }> = {
  SignMemo: {
    power: 'sign.memo',
    check: (cmd, world) => {
      const amount = cmd.payload.amountKobo
      if (typeof amount !== 'bigint' || amount <= 0n) return no('memo must carry a positive kobo amount')
      if (world.ledger.balance('treasury') < amount) return no('insufficient treasury balance')
      return OK
    },
    emit: (cmd) => [{
      id: 0, week: cmd.week, type: 'MemoSigned',
      subjects: [cmd.actorId, String(cmd.payload.payee ?? 'unknown')],
      payload: { amountKobo: cmd.payload.amountKobo, ref: cmd.payload.ref },
      visibility: 'public',
    }],
  },
  Promise: {
    power: undefined,
    check: (cmd) => (cmd.payload.to ? OK : no('promise needs a counterparty')),
    emit: (cmd) => [{
      id: 0, week: cmd.week, type: 'PromiseMade',
      subjects: [cmd.actorId, String(cmd.payload.to)],
      payload: { terms: cmd.payload.terms ?? null, dueWeek: cmd.payload.dueWeek ?? null },
      visibility: 'party',
    }],
  },
  IntelBrief: {
    check: () => OK,
    emit: (cmd) => [{
      id: 0, week: cmd.week, type: 'IntelReceived',
      subjects: [cmd.actorId],
      payload: { subject: cmd.payload.subject ?? null, qualityBp: cmd.payload.qualityBp ?? 5000n },
      visibility: 'sealed',
    }],
  },
}

export interface DispatchOk { ok: true; events: GameEvent[] }
export interface DispatchErr { ok: false; why: string; stage: 'legality' | 'feasibility' | 'exposure' }
export type DispatchResult = DispatchOk | DispatchErr

/** Validate → log → emit → apply. The only way state moves. */
export function dispatch(world: World, cmd: Command): DispatchResult {
  const rule = RULES[cmd.type]
  if (!rule) return { ok: false, why: `unknown command type: ${cmd.type}`, stage: 'legality' }

  if (rule.power && !hasPower(cmd.actorId, rule.power)) {
    return { ok: false, why: `${cmd.actorId} lacks ${rule.power}`, stage: 'legality' }
  }
  if (rule.check) {
    const r = rule.check(cmd, world)
    if (!r.ok) return { ok: false, why: r.why, stage: 'feasibility' }
  }

  // exposure: every command is logged before events exist (write-ahead, §3.7)
  world.commandLog.push(cmd)

  const events = rule.emit(cmd, world).map(e => ({ ...e, id: world.eventSeq++ }))
  for (const ev of events) applyEvent(world, ev)
  return { ok: true, events }
}

export function applyEvent(world: World, ev: GameEvent): void {
  world.eventLog.push(ev)
  if (ev.type === 'MemoSigned') {
    const amount = ev.payload.amountKobo as bigint
    world.ledger.transfer(ev.week, 'treasury', String(ev.subjects[1]), amount, String(ev.payload.ref ?? ev.type), ev.visibility)
  }
}
