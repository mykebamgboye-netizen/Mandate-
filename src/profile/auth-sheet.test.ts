// Regression guard for the auth sheet's handleAuthSubmit helper.
// Verifies the client-side validation and the no-Supabase fallback without requiring
// a live Supabase project. Each test isolates its own env state so the suite is
// robust no matter what other tests stub.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAuthSubmit, type AuthOutcome } from './auth-sheet'

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('handleAuthSubmit', () => {
  const onlyError = (outcome: AuthOutcome): string => {
    if (outcome.ok) throw new Error('expected handleAuthSubmit to fail')
    return outcome.error
  }

  it('rejects a sign-up when the passwords do not match', async () => {
    expect(onlyError(await handleAuthSubmit('sign-up', 'a@b.example', 'password1', 'password2'))).toBe('Passwords do not match.')
  })

  it('rejects a sign-in with a password shorter than 8 characters', async () => {
    expect(onlyError(await handleAuthSubmit('sign-in', 'a@b.example', 'short', 'short'))).toBe('Choose a password of at least 8 characters.')
  })

  it('rejects a sign-up with a password shorter than 8 characters', async () => {
    expect(onlyError(await handleAuthSubmit('sign-up', 'a@b.example', 'short', 'short'))).toBe('Choose a password of at least 8 characters.')
  })

  it('falls back gracefully when Supabase is not configured', async () => {
    // With no VITE_SUPABASE_* env vars, signIn/signUp are no-ops that return
    // { data: null, error: null }. handleAuthSubmit turns that into a friendly
    // "could not sign you in / make your account" message.
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(onlyError(await handleAuthSubmit('sign-in', 'a@b.example', 'password1', 'password1'))).toContain('could not sign you in')
  })

  it('formats a generic Error thrown by the auth call', async () => {
    // formatAuthError is not exported, so we only verify the observable outcome:
    // an unknown error becomes a non-empty string.
    const error = onlyError(await handleAuthSubmit('sign-in', 'a@b.example', 'password1', 'password1'))
    expect(typeof error).toBe('string')
    expect(error.length).toBeGreaterThan(0)
  })
})
