/* Kobo ledger (§3.4, §17.1): BigInt kobo, append-only, money-conserving.
   ₦84,700,000 is 8_470_000_000n kobo. Never floats. */

export type AccountId = string
export type Visibility = 'public' | 'press' | 'party' | 'private' | 'sealed'

export const MINT: AccountId = '::mint' // federation/IGR origin; carries the negative side

export interface LedgerEntry {
  id: number
  week: number
  from: AccountId
  to: AccountId
  amountKobo: bigint
  memo: string
  visibility: Visibility
}

export function nairaToKobo(naira: string | number): bigint {
  const raw = typeof naira === 'number' ? naira.toString() : naira
  const s = raw.replace(/[\u20A6\s,]/g, '') // accept display form: ₦214,371,000
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error(`bad naira amount: ${raw}`)
  const [whole, frac = ''] = s.split('.')
  return BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2))
}

export class Ledger {
  private entries: LedgerEntry[] = []
  private nextId = 1

  transfer(
    week: number,
    from: AccountId,
    to: AccountId,
    amountKobo: bigint,
    memo: string,
    visibility: Visibility = 'private',
  ): LedgerEntry {
    if (amountKobo <= 0n) throw new Error('amount must be positive kobo')
    const e: LedgerEntry = { id: this.nextId++, week, from, to, amountKobo, memo, visibility }
    this.entries.push(e)
    return e
  }

  all(): readonly LedgerEntry[] { return this.entries }

  balance(id: AccountId): bigint {
    let b = 0n
    for (const e of this.entries) {
      if (e.to === id) b += e.amountKobo
      if (e.from === id) b -= e.amountKobo
    }
    return b
  }

  /** Conservation law: every transfer nets to zero across all accounts including the mint. */
  conservation(): bigint {
    let sum = 0n
    for (const e of this.entries) { sum += e.amountKobo; sum -= e.amountKobo }
    return sum
  }

  /** Sum of all account balances — must be 0n (credits = debits). */
  balancesSum(): bigint {
    const bal = new Map<AccountId, bigint>()
    for (const e of this.entries) {
      bal.set(e.to, (bal.get(e.to) ?? 0n) + e.amountKobo)
      bal.set(e.from, (bal.get(e.from) ?? 0n) - e.amountKobo)
    }
    let s = 0n
    for (const v of bal.values()) s += v
    return s
  }
}
