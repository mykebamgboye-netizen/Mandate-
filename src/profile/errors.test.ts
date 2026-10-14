// Regression guard for the player-facing error formatter.
//
// A failed cloud save used to reach the onboarding sheet as "Could not save your file:
// [object Object]", because Supabase rejects with a plain object ({ message, details, hint,
// code }) and String() of one is always "[object Object]". Nothing here may regress to that.
import { describe, expect, it } from 'vitest'
import { describeError, explainError, shortError } from './errors'

describe('describeError', () => {
  it('reads a Supabase/PostgREST error object as its message and code', () => {
    const pgError = {
      message: 'column profiles.patronageBank does not exist',
      details: null,
      hint: 'Did you mean "patronage_bank"?',
      code: 'PGRST204',
    }
    expect(describeError(pgError)).toBe(
      'column profiles.patronageBank does not exist [PGRST204] — Did you mean "patronage_bank"?',
    )
    expect(describeError(pgError)).not.toContain('[object Object]')
  })

  it('reads an Error, a string and a null the same honest way', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
    expect(describeError('plain words')).toBe('plain words')
    expect(describeError(null)).toBe('unknown error')
    expect(describeError(undefined)).toBe('unknown error')
    expect(describeError('')).toBe('unknown error')
    expect(describeError(404)).toBe('404')
  })

  it('falls back to JSON rather than to [object Object] for a messageless object', () => {
    expect(describeError({ code: '42501' })).toBe('{"code":"42501"}')
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(describeError(cyclic)).toBe('an unreadable error')
  })
})

describe('explainError', () => {
  it('translates the codes a player can actually hit', () => {
    const rls = explainError({ message: 'new row violates row-level security policy', code: '42501' })
    expect(rls).toContain('no signed-in session')
    expect(rls).toContain('[42501]')

    const duplicate = explainError({ message: 'duplicate key value violates unique constraint', code: '23505' })
    expect(duplicate).toContain('a file already exists')

    expect(explainError({ message: 'relation "profiles" does not exist', code: '42P01' }))
      .toContain('migrations have not been run')
  })

  it('leaves an unknown code alone instead of guessing', () => {
    expect(explainError({ message: 'something odd', code: 'ZZZZZ' })).toBe('something odd [ZZZZZ]')
    expect(explainError(new Error('kaboom'))).toBe('kaboom')
  })
})

describe('shortError', () => {
  it('fits a toast', () => {
    const long = explainError({ message: 'x'.repeat(300), code: 'PGRST204' })
    const short = shortError(long, 60)
    expect(short.length).toBeLessThanOrEqual(60)
    expect(short.endsWith('…')).toBe(true)
  })
})
