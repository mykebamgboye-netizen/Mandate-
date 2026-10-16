/* @mandate/sim/events — the decision desk, generated.
 *
 * There is no fixed set of "15 documents". A decision is produced by a template for the
 * seat you hold, with the actors drawn from the living world: the senior Rep who wants your
 * chair, the godfather who owns the House, the Permanent Secretary who will not move.
 *
 * One formula decides everything, and it is the brief's:
 *
 *     value = base + your_axis/2 + relationship_bonus − opponent_axis/2 + jitter(−10..10)
 *
 * so the same choice has a different outcome against a different opponent, and a friend
 * opposing you is cheaper to survive than an enemy. Templates are data; rolls are pure.
 */

import { sfc32, hash32, subSeed, randInt } from './rng'
import type { NpcAxes } from './npcs'

export type EventTier =
  | 'federal-executive' | 'federal-legislative' | 'state-executive'
  | 'state-legislative' | 'lga' | 'ward' | 'unemployed'

export type TemplateId =
  | 'committee_chairmanship' | 'constituency_hijack'
  | 'ministerial_screening' | 'zoning_betrayal'
  | 'godfather_impeachment' | 'faac_deduction'
  | 'impeachment_signature' | 'speaker_removal'
  | 'ward_revolt' | 'state_joint_account'
  | 'perm_sec_blockade' | 'budget_padding'
  | 'ward_allocation' | 'ward_register'
  | 'lobby_appointment' | 'media_comeback'

export interface EventEffects {
  /** axis deltas, in axis points (−100..100 scale) */
  axes?: Partial<Record<keyof NpcAxes, number>>
  /** change to the relationship with the counterparty, −100..100 */
  trust?: number
  /** money in/out, ₦ (negative = you pay) */
  bankNaira?: number
  detail: string
}

export interface EventOption {
  id: string
  label: string
  detail: string
  /** what it costs up front, ₦ */
  costNaira: number
  /** the option is only offered when the desk can see a way to do it */
  gate?: { axis?: keyof NpcAxes; min?: number; bankMin?: number; blackmail?: boolean; alliesMin?: number }
  /** absent = the option always works (buying, deferring, spending) */
  roll?: {
    yourAxis: keyof NpcAxes
    opponentAxis: keyof NpcAxes
    base: number
    threshold: number
    /** added when the counterparty's trust in you is 50 or better */
    relationshipBonus: number
  }
  success: EventEffects
  failure: EventEffects
}

export interface DecisionEvent {
  id: string
  templateId: TemplateId
  tier: EventTier
  /** ISO date the card lands on the desk */
  date: string
  title: string
  brief: string
  actorId: string
  actorName: string
  opponentName: string
  amountNaira: number
  options: EventOption[]
}

export interface TemplateContext {
  seed: number
  id: string
  date: string
  week: number
  actorId: string
  actorName: string
  actorAxes: NpcAxes
  opponentName: string
  opponentAxes: NpcAxes
  /** the counterparty's trust in the player, −100..100 */
  relationshipTrust: number
  bank: number
  hasBlackmail: boolean
  allies: number
  /** the money on the table for this scenario, ₦ */
  amountNaira: number
  /** how many terms the player has served — templates get harder with time */
  termsServed: number
}

export interface DecisionTemplate {
  id: TemplateId
  tier: EventTier
  build: (ctx: TemplateContext) => DecisionEvent
}

/** Compact naira for card copy: 2_500_000_000 → "₦2.5bn", 40_000_000 → "₦40m".
    Hand-formatted on purpose: no locale data, so the copy is identical on every host. */
export function compactNaira(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}₦${oneDecimal(abs / 1_000_000_000)}bn`
  if (abs >= 1_000_000) return `${sign}₦${oneDecimal(abs / 1_000_000)}m`
  if (abs >= 1_000) return `${sign}₦${oneDecimal(abs / 1_000)}k`
  return `${sign}₦${abs}`
}

function oneDecimal(x: number): string {
  const rounded = Math.round(x * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

const naira = compactNaira

const add = (a: number, b: number, floor = -100, ceil = 100) => Math.max(floor, Math.min(ceil, a + b))

export function applyEffects(axes: NpcAxes, effects: EventEffects): NpcAxes {
  const next = { ...axes }
  if (effects.axes) {
    for (const [key, delta] of Object.entries(effects.axes)) {
      const k = key as keyof NpcAxes
      if (delta === undefined) continue
      next[k] = k === 'pressTone' ? add(next[k], delta) : add(next[k], delta, 0, 100)
    }
  }
  return next
}

// ---------------------------------------------------------------------------
// the roll
// ---------------------------------------------------------------------------

export interface RollOutcome {
  success: boolean
  value: number
  threshold: number
  jitter: number
}

export function rollOption(next: () => number, option: EventOption, ctx: TemplateContext): RollOutcome {
  if (!option.roll) return { success: true, value: 0, threshold: 0, jitter: 0 }
  const jitter = randInt(next, -10, 10)
  const bonus = ctx.relationshipTrust >= 50 ? option.roll.relationshipBonus : 0
  const value =
    option.roll.base +
    Math.round(ctx.actorAxes[option.roll.yourAxis] / 2) +
    bonus -
    Math.round(ctx.opponentAxes[option.roll.opponentAxis] / 2) +
    jitter
  return { success: value >= option.roll.threshold, value, threshold: option.roll.threshold, jitter }
}

/** A stream for resolving one event's options, stable across replays. */
export function eventStream(seed: number, eventId: string, week: number): () => number {
  const h = subSeed(seed, `${eventId}:${week}`)
  return sfc32(h, hash32(eventId), (h ^ 0x3b9aca07) >>> 0, (h + week) >>> 0)
}

// ---------------------------------------------------------------------------
// templates
// ---------------------------------------------------------------------------

export const TEMPLATES: readonly DecisionTemplate[] = [
  {
    id: 'committee_chairmanship', tier: 'federal-legislative',
    build: ctx => ({
      id: ctx.id, templateId: 'committee_chairmanship', tier: 'federal-legislative', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Committee chairmanship fight',
      brief: `${ctx.opponentName} wants the chairmanship and has told ${ctx.actorName}'s caucus it is his turn. The Speaker will call it either way.`,
      options: [
        {
          id: 'bribe-speaker', label: `Buy the Speaker (${naira(100_000_000)})`, costNaira: 100_000_000,
          detail: 'Cash and a promise of the committee\'s first oversight trip.',
          gate: { bankMin: 100_000_000 },
          success: { axes: { eliteTrust: 6, constituency: 4 }, trust: 10, detail: 'The Speaker holds the gavel back.' },
          failure: { axes: { integrity: -12, pressTone: -10 }, trust: 6, detail: 'He takes the money and remembers you tried to buy him.' },
        },
        {
          id: 'leak-certificate', label: 'Leak his certificate scandal', costNaira: 0,
          detail: 'You have the file. He does not know how much of it you have.',
          gate: { blackmail: true },
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'popularity', base: 28, threshold: 42, relationshipBonus: 6 },
          success: { axes: { integrity: -10, pressTone: -8, eliteTrust: 6 }, trust: -25, detail: 'The certificate story runs for a week; he withdraws.' },
          failure: { axes: { integrity: -10, pressTone: -20 }, trust: -35, detail: 'The story dies, and everyone knows who leaked it.' },
        },
        {
          id: 'defer', label: 'Defer and lose the chair', costNaira: 0,
          detail: 'Keep your seat, keep your relationship, lose the gavel.',
          success: { axes: { popularity: -6, eliteTrust: -10 }, trust: 20, detail: `${ctx.opponentName} takes the chair and owes you one.` },
          failure: { axes: { popularity: -6, eliteTrust: -10 }, trust: 20, detail: `${ctx.opponentName} takes the chair and owes you one.` },
        },
      ],
    }),
  },
  {
    id: 'constituency_hijack', tier: 'federal-legislative',
    build: ctx => ({
      id: ctx.id, templateId: 'constituency_hijack', tier: 'federal-legislative', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Constituency project diverted',
      brief: `The Governor has diverted your ${naira(ctx.amountNaira)} zonal intervention into his own contractor's hands. Your ward chairmen are already calling.`,
      options: [
        {
          id: 'fight-publicly', label: 'Fight him publicly', costNaira: 0,
          detail: 'Press conference, the appropriation line, a project that will be delivered.',
          roll: { yourAxis: 'popularity', opponentAxis: 'eliteTrust', base: 30, threshold: 45, relationshipBonus: 8 },
          success: { axes: { popularity: 15, pressTone: 8 }, trust: -30, detail: 'The money comes back to the constituency; the Governor is furious.' },
          failure: { axes: { popularity: 6, pressTone: -12 }, trust: -30, detail: 'You get the headline, not the money — and a probe file opens.' },
        },
        {
          id: 'cut-deal', label: 'Cut the deal privately', costNaira: 0,
          detail: 'You keep 40% of the intervention and say nothing.',
          success: { axes: { integrity: -20, popularity: -5, patronage: 12 }, trust: 20, bankNaira: Math.round(ctx.amountNaira * 0.4), detail: `You keep ${naira(Math.round(ctx.amountNaira * 0.4))} and lose the argument.` },
          failure: { axes: { integrity: -20, popularity: -5, patronage: 12 }, trust: 20, bankNaira: Math.round(ctx.amountNaira * 0.4), detail: `You keep ${naira(Math.round(ctx.amountNaira * 0.4))} and lose the argument.` },
        },
      ],
    }),
  },
  {
    id: 'ministerial_screening', tier: 'federal-legislative',
    build: ctx => ({
      id: ctx.id, templateId: 'ministerial_screening', tier: 'federal-legislative', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Ministerial screening',
      brief: `The nominee in front of your committee is ${ctx.opponentName} — your patron's son, and he cannot answer a question on the portfolio.`,
      options: [
        {
          id: 'approve', label: 'Approve him', costNaira: 0,
          detail: 'The patron will hear about it inside the hour.',
          success: { axes: { partyLoyalty: 12, integrity: -10, pressTone: -18, patronage: 15 }, trust: 40, detail: 'The patron is pleased. The press is not.' },
          failure: { axes: { partyLoyalty: 12, integrity: -10, pressTone: -18, patronage: 15 }, trust: 40, detail: 'The patron is pleased. The press is not.' },
        },
        {
          id: 'reject', label: 'Reject him on the record', costNaira: 0,
          detail: 'The recall petition is drafted before you leave the room.',
          roll: { yourAxis: 'integrity', opponentAxis: 'patronage', base: 32, threshold: 48, relationshipBonus: 5 },
          success: { axes: { integrity: 14, popularity: 8, pressTone: 10 }, trust: -45, detail: 'The nomination is withdrawn; the recall petition dies at the ward.' },
          failure: { axes: { integrity: 8, pressTone: -10 }, trust: -45, detail: 'The patron activates the recall; you survive it by four wards.' },
        },
      ],
    }),
  },
  {
    id: 'zoning_betrayal', tier: 'federal-legislative',
    build: ctx => ({
      id: ctx.id, templateId: 'zoning_betrayal', tier: 'federal-legislative', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Zoning betrayal',
      brief: `The party zoned the presidency to your region and the chairman is backing ${ctx.opponentName} anyway.`,
      options: [
        {
          id: 'lead-revolt', label: `Lead the revolt (needs 7 senators)`, costNaira: 60_000_000,
          detail: `${ctx.allies} of the region's senators are with you so far.`,
          gate: { alliesMin: 3 },
          roll: { yourAxis: 'partyLoyalty', opponentAxis: 'eliteTrust', base: 26, threshold: 46, relationshipBonus: 10 },
          success: { axes: { popularity: 10, partyLoyalty: -12, eliteTrust: 8 }, trust: -20, detail: 'The zoning holds and the chairman is humiliated at the convention.' },
          failure: { axes: { popularity: -4, partyLoyalty: -12 }, trust: -25, detail: 'The revolt collapses; you are marked as the man who broke the zone.' },
        },
        {
          id: 'defect', label: 'Defect to another party', costNaira: 0,
          detail: 'Cross the floor and take your structure with you.',
          success: { axes: { partyLoyalty: -30, eliteTrust: 6, patronage: 10 }, trust: -40, detail: 'You cross over with your ward chairmen.' },
          failure: { axes: { partyLoyalty: -30, eliteTrust: -8 }, trust: -40, detail: 'You cross over; four of your ward chairmen stay behind.' },
        },
      ],
    }),
  },
  {
    id: 'godfather_impeachment', tier: 'state-executive',
    build: ctx => ({
      id: ctx.id, templateId: 'godfather_impeachment', tier: 'state-executive', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Impeachment notice from the House',
      brief: `${ctx.opponentName} has the House of Assembly and the godfather to go with it. You have three weeks: sixteen members, a court, or your Chief of Staff.`,
      options: [
        {
          id: 'buy-members', label: `Buy sixteen members (${naira(800_000_000)})`, costNaira: 800_000_000,
          detail: '₦50m each, held in escrow until the vote is called.',
          gate: { bankMin: 800_000_000 },
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'patronage', base: 30, threshold: 50, relationshipBonus: 12 },
          success: { axes: { eliteTrust: -6, integrity: -14, legitimacy: -8 }, trust: -30, detail: 'The notice is withdrawn on a procedural vote.' },
          failure: { axes: { integrity: -14, legitimacy: -14, pressTone: -14 }, trust: -35, detail: 'The money is seen changing hands; the notice survives it.' },
        },
        {
          id: 'injunction', label: 'Get a court injunction', costNaira: 40_000_000,
          detail: 'The Chief Judge has to be willing. Judges are not cheap and not always willing.',
          roll: { yourAxis: 'legitimacy', opponentAxis: 'eliteTrust', base: 28, threshold: 50, relationshipBonus: 14 },
          success: { axes: { legitimacy: 6 }, trust: -22, detail: 'The court stops the Assembly; the impeachment dies in litigation.' },
          failure: { axes: { legitimacy: -10, pressTone: -8 }, trust: -25, detail: 'The application is dismissed with costs; the House smells blood.' },
        },
        {
          id: 'sacrifice-cos', label: 'Sacrifice the Chief of Staff', costNaira: 0,
          detail: 'The godfather wants a scalp; give him one that is not yours.',
          success: { axes: { integrity: -8, popularity: -4, eliteTrust: 4 }, trust: 15, detail: 'Your CoS resigns for family reasons; the House stands down.' },
          failure: { axes: { integrity: -8, popularity: -4, eliteTrust: 4 }, trust: 15, detail: 'Your CoS resigns for family reasons; the House stands down.' },
        },
      ],
    }),
  },
  {
    id: 'faac_deduction', tier: 'state-executive',
    build: ctx => ({
      id: ctx.id, templateId: 'faac_deduction', tier: 'state-executive', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'FAAC deduction war',
      brief: `The federation has withheld ${naira(ctx.amountNaira)} of derivation. ${ctx.opponentName} says the state should absorb it quietly.`,
      options: [
        {
          id: 'sue', label: 'Sue at the Supreme Court', costNaira: 300_000_000,
          detail: 'Eighteen months, and the Federation Account has better lawyers.',
          roll: { yourAxis: 'legitimacy', opponentAxis: 'eliteTrust', base: 24, threshold: 52, relationshipBonus: 6 },
          success: { axes: { legitimacy: 12, popularity: 10 }, bankNaira: ctx.amountNaira, trust: -20, detail: 'The Court orders the deduction refunded.' },
          failure: { axes: { legitimacy: -6 }, trust: -20, detail: 'The suit is dismissed after eighteen months and the money is gone.' },
        },
        {
          id: 'governors-forum', label: 'Mobilise the Governors\' Forum', costNaira: 50_000_000,
          detail: 'You need nineteen governors to sign a joint statement.',
          gate: { alliesMin: 5 },
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'partyLoyalty', base: 32, threshold: 48, relationshipBonus: 16 },
          success: { axes: { eliteTrust: 12, popularity: 6 }, bankNaira: Math.round(ctx.amountNaira * 0.6), trust: -15, detail: 'Nineteen signatures; the deduction is quietly unwound.' },
          failure: { axes: { eliteTrust: -8 }, trust: -15, detail: 'Only nine governors sign and three deny it. The deduction stands.' },
        },
        {
          id: 'absorb', label: 'Accept it and cut salaries', costNaira: 0,
          detail: 'The unions will not take it quietly.',
          success: { axes: { popularity: -14, pressTone: -12, eliteTrust: 8 }, trust: 12, detail: 'A strike begins in the second week; school terms are lost.' },
          failure: { axes: { popularity: -14, pressTone: -12, eliteTrust: 8 }, trust: 12, detail: 'A strike begins in the second week; school terms are lost.' },
        },
      ],
    }),
  },
  {
    id: 'ward_revolt', tier: 'lga',
    build: ctx => ({
      id: ctx.id, templateId: 'ward_revolt', tier: 'lga', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Councillors demand their cut',
      brief: `Five of your ten councillors want a monthly kickback from the allocation. ${ctx.opponentName} is counting the signatures.`,
      options: [
        {
          id: 'pay', label: 'Pay them (₦5m a month)', costNaira: 5_000_000,
          detail: 'Cheaper than a suspension fight, and it never stops.',
          gate: { bankMin: 15_000_000 },
          success: { axes: { integrity: -14, popularity: 4 }, trust: 18, detail: 'The council meets once a month and passes everything.' },
          failure: { axes: { integrity: -14, popularity: 4 }, trust: 18, detail: 'The council meets once a month and passes everything.' },
        },
        {
          id: 'suspend', label: 'Suspend them', costNaira: 20_000_000,
          detail: 'The state assembly will have a view, and they are not on your side.',
          roll: { yourAxis: 'partyLoyalty', opponentAxis: 'popularity', base: 30, threshold: 46, relationshipBonus: 10 },
          success: { axes: { eliteTrust: -6, popularity: 6 }, trust: -20, detail: 'The suspension holds; the state assembly declines to intervene.' },
          failure: { axes: { popularity: -12, pressTone: -12 }, trust: -25, detail: 'The assembly reverses the suspension and calls you a tyrant.' },
        },
        {
          id: 'traditional-ruler', label: 'Call in the traditional ruler', costNaira: 8_000_000,
          detail: 'If the palace speaks, the revolt ends tonight.',
          gate: { axis: 'eliteTrust', min: 45 },
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'constituency', base: 34, threshold: 44, relationshipBonus: 18 },
          success: { axes: { popularity: 8, eliteTrust: 6 }, trust: -12, detail: 'The palace calls the councillors in and the demand evaporates.' },
          failure: { axes: { eliteTrust: -6 }, trust: -12, detail: 'The palace stays out of it, and the demand hardens.' },
        },
      ],
    }),
  },
  {
    id: 'state_joint_account', tier: 'lga',
    build: ctx => ({
      id: ctx.id, templateId: 'state_joint_account', tier: 'lga', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'The state has seized your allocation',
      brief: `${ctx.opponentName} has held ${naira(ctx.amountNaira)} in the joint account for two quarters. Your salary bill is due Friday.`,
      options: [
        {
          id: 'nfiu', label: 'Petition the financial intelligence unit', costNaira: 5_000_000,
          detail: 'Slow, and it makes an enemy you cannot avoid.',
          roll: { yourAxis: 'legitimacy', opponentAxis: 'eliteTrust', base: 22, threshold: 54, relationshipBonus: 4 },
          success: { axes: { legitimacy: 12, integrity: 8 }, bankNaira: Math.round(ctx.amountNaira * 0.7), trust: -35, detail: 'The unit writes to the state; the money is released.' },
          failure: { axes: { legitimacy: -8 }, trust: -40, detail: 'Your petition is leaked, and the Governor becomes a permanent enemy.' },
        },
        {
          id: 'press', label: 'Take it to a friendly paper', costNaira: 12_000_000,
          detail: 'You need a masthead that will actually run it.',
          roll: { yourAxis: 'pressTone', opponentAxis: 'popularity', base: 30, threshold: 44, relationshipBonus: 12 },
          success: { axes: { popularity: 10, pressTone: 8 }, bankNaira: Math.round(ctx.amountNaira * 0.4), trust: -25, detail: 'The story runs for three weeks; part of the money appears.' },
          failure: { axes: { pressTone: -10 }, trust: -25, detail: 'The paper spikes it after one call from the state house.' },
        },
        {
          id: 'endure', label: 'Endure and pay what you can', costNaira: 0,
          detail: 'The staff will be owed, and they will say so.',
          success: { axes: { popularity: -12, constituency: -8, eliteTrust: 6 }, trust: 8, detail: 'Two months of arrears; the council workers picket the secretariat.' },
          failure: { axes: { popularity: -12, constituency: -8, eliteTrust: 6 }, trust: 8, detail: 'Two months of arrears; the council workers picket the secretariat.' },
        },
      ],
    }),
  },
  {
    id: 'impeachment_signature', tier: 'state-legislative',
    build: ctx => ({
      id: ctx.id, templateId: 'impeachment_signature', tier: 'state-legislative', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'The impeachment notice needs your signature',
      brief: `The godfather's men have a notice on the Governor and they want your name on it. ${ctx.opponentName} is counting the members who have signed.`,
      options: [
        {
          id: 'sign', label: 'Sign the notice', costNaira: 0,
          detail: 'You are five signatures short of the two-thirds and he knows it.',
          roll: { yourAxis: 'partyLoyalty', opponentAxis: 'eliteTrust', base: 30, threshold: 46, relationshipBonus: 8 },
          success: { axes: { eliteTrust: 10, popularity: 6, integrity: -8, legitimacy: -6 }, trust: 25, detail: 'The notice is served; the Governor starts buying members back.' },
          failure: { axes: { popularity: -8, legitimacy: -10, pressTone: -8 }, trust: 10, detail: 'The notice fails by two votes and you are named in every account of it.' },
        },
        {
          id: 'refuse', label: 'Refuse and warn the Governor', costNaira: 0,
          detail: 'A phone call now, and an enemy in the House for a decade.',
          success: { axes: { legitimacy: 8, eliteTrust: 8, popularity: -4 }, trust: -20, detail: 'The Governor remembers who called; the House remembers who did not sign.' },
          failure: { axes: { legitimacy: 8, eliteTrust: 8, popularity: -4 }, trust: -20, detail: 'The Governor remembers who called; the House remembers who did not sign.' },
        },
        {
          id: 'abstain', label: 'Travel out of the state', costNaira: 3_000_000,
          detail: 'Absence is a position, and everyone reads it.',
          success: { axes: { legitimacy: -4, eliteTrust: 2 }, trust: -6, detail: 'You are in Abuja for two weeks. Both sides call it a betrayal.' },
          failure: { axes: { legitimacy: -4, eliteTrust: 2 }, trust: -6, detail: 'You are in Abuja for two weeks. Both sides call it a betrayal.' },
        },
      ],
    }),
  },
  {
    id: 'speaker_removal', tier: 'state-legislative',
    build: ctx => ({
      id: ctx.id, templateId: 'speaker_removal', tier: 'state-legislative', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'A motion to remove the Speaker',
      brief: `${ctx.opponentName} has the signatures to remove the Speaker of the House. Your committee has the votes that decide it.`,
      options: [
        {
          id: 'support-motion', label: 'Support the motion', costNaira: 0,
          detail: 'The new Speaker will owe the members who moved first.',
          roll: { yourAxis: 'partyLoyalty', opponentAxis: 'eliteTrust', base: 32, threshold: 44, relationshipBonus: 10 },
          success: { axes: { eliteTrust: 8, patronage: 10, integrity: -6 }, trust: 20, detail: `The Speaker falls; ${ctx.opponentName} takes the gavel and your committee keeps its budget.` },
          failure: { axes: { eliteTrust: -10, pressTone: -8 }, trust: -25, detail: 'The motion fails and the Speaker strips your committee in the reshuffle.' },
        },
        {
          id: 'defend-speaker', label: 'Defend the Speaker', costNaira: 0,
          detail: 'Loyalty is expensive when the numbers are against you.',
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'partyLoyalty', base: 28, threshold: 48, relationshipBonus: 14 },
          success: { axes: { eliteTrust: 6, integrity: 10, popularity: 4 }, trust: 25, detail: 'The motion dies on a voice vote; the Speaker survives by four.' },
          failure: { axes: { integrity: 6, eliteTrust: -8 }, trust: 20, detail: 'You lose the vote and the Speakership with it, but you kept your name.' },
        },
      ],
    }),
  },
  {
    id: 'ward_allocation', tier: 'ward',
    build: ctx => ({
      id: ctx.id, templateId: 'ward_allocation', tier: 'ward', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Nothing has reached your ward',
      brief: `The council has released the ward allocation on paper. Nothing has arrived. The chairman's cousin is the contractor.`,
      options: [
        {
          id: 'petition-council', label: 'Move a motion in the council', costNaira: 0,
          detail: 'The chairman controls the table and the clerk counts the votes.',
          roll: { yourAxis: 'constituency', opponentAxis: 'patronage', base: 32, threshold: 44, relationshipBonus: 12 },
          success: { axes: { constituency: 12, popularity: 8 }, trust: -18, detail: 'The motion passes and the ward gets a drainage project by December.' },
          failure: { axes: { popularity: -6, constituency: -6 }, trust: -22, detail: 'The motion is referred to a committee that never sits.' },
        },
        {
          id: 'mobilise-ward', label: 'Mobilise the ward yourself', costNaira: 4_000_000,
          detail: 'Roads, water, a generator for the market: the visible things.',
          gate: { bankMin: 4_000_000 },
          success: { axes: { constituency: 14, popularity: 10, integrity: -4 }, trust: -10, detail: 'The ward sees the work and credits you, not the council.' },
          failure: { axes: { constituency: 14, popularity: 10, integrity: -4 }, trust: -10, detail: 'The ward sees the work and credits you, not the council.' },
        },
        {
          id: 'take-the-cut', label: 'Take the chairman\'s arrangement', costNaira: 0,
          detail: 'A third of the allocation, and the contractor stays.',
          success: { axes: { integrity: -14, patronage: 12 }, trust: 22, bankNaira: 3_000_000, detail: 'The money arrives as a private settlement and the ward still waits.' },
          failure: { axes: { integrity: -14, patronage: 12 }, trust: 22, bankNaira: 3_000_000, detail: 'The money arrives as a private settlement and the ward still waits.' },
        },
      ],
    }),
  },
  {
    id: 'ward_register', tier: 'ward',
    build: ctx => ({
      id: ctx.id, templateId: 'ward_register', tier: 'ward', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'The party wants the ward register',
      brief: `${ctx.opponentName} wants the ward register and the polling-unit lists before the primaries. Whoever holds the register picks the candidate.`,
      options: [
        {
          id: 'hand-over', label: 'Hand over the register', costNaira: 0,
          detail: 'You keep the ward in the party, and lose the pick.',
          success: { axes: { partyLoyalty: 12, eliteTrust: 6, popularity: -6 }, trust: 22, detail: 'You sign the register across and the party ticket is decided in Abuja.' },
          failure: { axes: { partyLoyalty: 12, eliteTrust: 6, popularity: -6 }, trust: 22, detail: 'You sign the register across and the party ticket is decided in Abuja.' },
        },
        {
          id: 'sit-on-it', label: 'Sit on the register', costNaira: 0,
          detail: 'The ward decides its own candidate, and the party decides what to do about you.',
          roll: { yourAxis: 'constituency', opponentAxis: 'partyLoyalty', base: 30, threshold: 42, relationshipBonus: 16 },
          success: { axes: { popularity: 12, partyLoyalty: -14, constituency: 8 }, trust: -25, detail: 'The ward nominates your candidate and the party has to accept it.' },
          failure: { axes: { partyLoyalty: -18, popularity: -8 }, trust: -30, detail: 'The party declares your ward closed and runs its own man against you.' },
        },
      ],
    }),
  },
  {
    id: 'perm_sec_blockade', tier: 'federal-executive',
    build: ctx => ({
      id: ctx.id, templateId: 'perm_sec_blockade', tier: 'federal-executive', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'The Permanent Secretary will not move',
      brief: `${ctx.opponentName} has sat on your policy for eleven weeks and the directors are following his lead.`,
      options: [
        {
          id: 'transfer', label: 'Transfer him', costNaira: 0,
          detail: 'It needs the Head of Service, and the Head of Service owes nobody anything.',
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'patronage', base: 30, threshold: 48, relationshipBonus: 14 },
          success: { axes: { competence: 8, eliteTrust: 4 }, trust: -30, detail: 'He is posted to a committee; the policy moves inside a month.' },
          failure: { axes: { eliteTrust: -6, competence: -6 }, trust: -35, detail: 'The transfer is refused, and now the whole ministry knows you tried.' },
        },
        {
          id: 'bribe-directors', label: 'Buy the directors around him', costNaira: 150_000_000,
          detail: 'Directors are cheaper than Permanent Secretaries and less protected.',
          gate: { bankMin: 150_000_000 },
          success: { axes: { competence: 6, integrity: -12, patronage: 10 }, trust: -15, detail: 'The directors implement the policy over his signature.' },
          failure: { axes: { competence: 6, integrity: -12, patronage: 10 }, trust: -15, detail: 'The directors implement the policy over his signature.' },
        },
        {
          id: 'leak', label: 'Leak his file to the press', costNaira: 0,
          detail: 'You know what is in it. He knows you know.',
          gate: { blackmail: true },
          roll: { yourAxis: 'pressTone', opponentAxis: 'integrity', base: 26, threshold: 46, relationshipBonus: 6 },
          success: { axes: { pressTone: 6, integrity: -10 }, trust: -45, detail: 'He is on administrative leave within a fortnight.' },
          failure: { axes: { integrity: -10, pressTone: -14 }, trust: -50, detail: 'The leak is traced back to your office.' },
        },
      ],
    }),
  },
  {
    id: 'budget_padding', tier: 'federal-executive',
    build: ctx => ({
      id: ctx.id, templateId: 'budget_padding', tier: 'federal-executive', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'The National Assembly has padded your budget',
      brief: `₦10bn has appeared in your ministry's line for projects you did not propose, and ${ctx.opponentName} signed the report.`,
      options: [
        {
          id: 'accept', label: 'Accept the padding', costNaira: 0,
          detail: 'You will be signing for money you cannot explain.',
          success: { axes: { integrity: -16, patronage: 12, eliteTrust: 6 }, trust: 25, detail: 'Your programmes are protected at the next appropriation.' },
          failure: { axes: { integrity: -16, patronage: 12, eliteTrust: 6 }, trust: 25, detail: 'Your programmes are protected at the next appropriation.' },
        },
        {
          id: 'reject', label: 'Reject the line item', costNaira: 0,
          detail: 'You will make an enemy of every member on the committee.',
          roll: { yourAxis: 'integrity', opponentAxis: 'eliteTrust', base: 30, threshold: 44, relationshipBonus: 4 },
          success: { axes: { integrity: 14, pressTone: 8, popularity: 6 }, trust: -30, detail: 'The Auditor-General backs you; the line item is struck out.' },
          failure: { axes: { integrity: 8, eliteTrust: -12 }, trust: -35, detail: 'The item survives and your ministry loses two other votes.' },
        },
        {
          id: 'negotiate', label: 'Negotiate a split', costNaira: 0,
          detail: 'Adopt the projects, keep half the oversight.',
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'partyLoyalty', base: 36, threshold: 40, relationshipBonus: 20 },
          success: { axes: { competence: 6, integrity: -6, eliteTrust: 8 }, trust: 15, detail: 'The committee drops four of the ten projects and gives you the audit.' },
          failure: { axes: { integrity: -8 }, trust: -15, detail: 'The committee briefs against you; the split is called a cover-up.' },
        },
      ],
    }),
  },
  {
    id: 'lobby_appointment', tier: 'unemployed',
    build: ctx => ({
      id: ctx.id, templateId: 'lobby_appointment', tier: 'unemployed', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Lobby for an appointment',
      brief: `${ctx.opponentName} is the Governor now. You carried his ward in the last cycle and he has not called.`,
      options: [
        {
          id: 'call-debt', label: 'Call in the debt', costNaira: 0,
          detail: 'He owes you. Say the number out loud.',
          gate: { axis: 'eliteTrust', min: 35 },
          roll: { yourAxis: 'eliteTrust', opponentAxis: 'patronage', base: 30, threshold: 44, relationshipBonus: 20 },
          success: { axes: { patronage: 14, eliteTrust: 4 }, trust: -8, bankNaira: 0, detail: 'A board chairmanship appears within the month.' },
          failure: { axes: { popularity: -6, eliteTrust: -10 }, trust: -25, detail: 'He sends an aide to explain that the board is for a governor\'s nominee.' },
        },
        {
          id: 'fund-rival', label: `Fund his rival's opponent`, costNaira: 50_000_000,
          detail: 'If you cannot be appointed, be inconvenient.',
          gate: { bankMin: 50_000_000 },
          success: { axes: { eliteTrust: -8, patronage: 10, popularity: 6 }, trust: -40, detail: 'The rival\'s man wins a state assembly seat; the Governor notices you again.' },
          failure: { axes: { eliteTrust: -10, popularity: -6 }, trust: -45, detail: 'The rival loses and the Governor knows who paid for him.' },
        },
      ],
    }),
  },
  {
    id: 'media_comeback', tier: 'unemployed',
    build: ctx => ({
      id: ctx.id, templateId: 'media_comeback', tier: 'unemployed', date: ctx.date,
      actorId: ctx.actorId, actorName: ctx.actorName, opponentName: ctx.opponentName, amountNaira: ctx.amountNaira,
      title: 'Media comeback',
      brief: `Every cycle you spend out of office, ${ctx.opponentName} gets harder to challenge. Buy space and stay visible.`,
      options: [
        {
          id: 'interview-series', label: 'Lawyer an interview series (₦2m a week, 4 weeks)', costNaira: 2_000_000,
          detail: 'Four weeks of visibility, and a rival who can counter-narrate.',
          gate: { bankMin: 20_000_000 },
          roll: { yourAxis: 'pressTone', opponentAxis: 'popularity', base: 34, threshold: 40, relationshipBonus: 14 },
          success: { axes: { popularity: 12, pressTone: 10 }, trust: 0, detail: 'The series lands; two ward chapters invite you back.' },
          failure: { axes: { popularity: 4, pressTone: -6 }, trust: 0, detail: 'The counter-narrative beats you to the second week.' },
        },
        {
          id: 'write-memoir', label: 'Write the memoir', costNaira: 15_000_000,
          detail: 'Slower, permanent, and it cannot be spiked.',
          gate: { bankMin: 15_000_000 },
          success: { axes: { popularity: 6, memory: 14, legitimacy: 8 }, trust: -10, detail: 'The book sells badly and is quoted for years.' },
          failure: { axes: { popularity: 6, memory: 14, legitimacy: 8 }, trust: -10, detail: 'The book sells badly and is quoted for years.' },
        },
      ],
    }),
  },
]

export const TEMPLATE_BY_ID: ReadonlyMap<TemplateId, DecisionTemplate> = new Map(TEMPLATES.map(t => [t.id, t]))

/** Every template the tier's desk can produce. */
export function templatesForTier(tier: EventTier): DecisionTemplate[] {
  return TEMPLATES.filter(t => t.tier === tier)
}

export interface GenerateOptions {
  /** how many cards to land this week */
  count?: number
  /** the tier of the seat — unemployed overrides the office when out of work */
  tier: EventTier
}

/** The week's decision cards for a seat: distinct templates, drawn deterministically. */
export function generateEvents(ctx: Omit<TemplateContext, 'id'>, opts: GenerateOptions): DecisionEvent[] {
  const pool = templatesForTier(opts.tier)
  if (pool.length === 0) return []
  const next = sfc32(subSeed(ctx.seed, `events/${ctx.date}/${opts.tier}`), hash32(ctx.date), hash32(opts.tier), ctx.week)
  const count = Math.min(opts.count ?? 2, pool.length)
  const chosen = new Set<number>()
  const out: DecisionEvent[] = []
  for (let i = 0; i < count * 4 && out.length < count; i++) {
    const idx = next() % pool.length
    if (chosen.has(idx)) continue
    chosen.add(idx)
    out.push(pool[idx]!.build({ ...ctx, id: `event/${ctx.date}/${pool[idx]!.id}` }))
  }
  return out
}
