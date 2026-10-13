// @mandate/profile/auth-sheet — the sign-in / sign-up sheet before the first-open onboarding.
// Pattern: a short Suzerain-style sheet (not a form) that asks the player to claim or make
// an account. No OTP, no magic links — Supabase is configured with auto-confirm, so sign-up
// returns a session immediately.
//
// When Supabase is unconfigured the sheet is unreachable (the app always boots onto the local
// Delta tutorial onboarding), so this file is only exercised in a real Supabase project. The
// public surface of src/profile/auth.ts is covered by unit tests; this component is the UI
// contract that binds those calls to the buttons and fields.

import { signIn, signUp, type SignInResult, type SignUpResult } from './auth'

interface AuthSheetProps {
  email: string
  password: string
  confirm: string
  mode: 'sign-in' | 'sign-up'
  submitting: boolean
  error: string | null
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
  onMode: (m: 'sign-in' | 'sign-up') => void
  onSubmit: (email: string, password: string, confirm: string) => Promise<void>
  onBack: () => void
}

export function AuthSheet({
  email,
  password,
  confirm,
  mode,
  submitting,
  error,
  onEmail,
  onPassword,
  onConfirm,
  onMode,
  onSubmit,
  onBack,
}: AuthSheetProps) {
  const sub = mode === 'sign-in'
    ? 'You already have a file on this phone. Sign in and pick it up where you left it.'
    : 'Make an account and the desk travels with you — one save, one life.'

  const requireEmail = email.trim().length === 0
  const requirePassword =
    mode === 'sign-in'
      ? password.length < 8
      : password.length < 8 || password !== confirm

  const submitDisabled =
    submitting || requireEmail || requirePassword

  return (
    <div className="ob-step" role="dialog" aria-label={sub}>
      <div className="ob-sub">{sub}</div>

      <div className="ob-mode">
        <button
          className={`ob-mode-tab${mode === 'sign-in' ? ' selected' : ''}`}
          onClick={() => onMode('sign-in')}
        >
          sign in
        </button>
        <button
          className={`ob-mode-tab${mode === 'sign-up' ? ' selected' : ''}`}
          onClick={() => onMode('sign-up')}
        >
          make an account
        </button>
      </div>

      <div className="ob-field">
        <label className="ob-label">EMAIL</label>
        <input
          className="ob-input"
          type="email"
          value={email}
          onChange={e => onEmail(e.target.value)}
          placeholder="you@domain.example"
          autoComplete="email"
          autoFocus={mode === 'sign-in'}
          disabled={submitting}
        />
      </div>

      <div className="ob-field">
        <label className="ob-label">
          {mode === 'sign-in' ? 'PASSWORD' : 'CHOOSE A PASSWORD'}
        </label>
        <input
          className="ob-input"
          type="password"
          value={password}
          onChange={e => onPassword(e.target.value)}
          placeholder={mode === 'sign-in' ? '••••••••' : 'at least 8 characters'}
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          disabled={submitting}
        />
      </div>

      {mode === 'sign-up' && (
        <div className="ob-field">
          <label className="ob-label">CONFIRM PASSWORD</label>
          <input
            className="ob-input"
            type="password"
            value={confirm}
            onChange={e => onConfirm(e.target.value)}
            placeholder="repeat your password"
            autoComplete="new-password"
            disabled={submitting}
          />
        </div>
      )}

      {error && <div className="ob-error" role="alert">{error}</div>}

      <div className="ob-foot">
        <button
          className="ob-done"
          disabled={submitDisabled}
          onClick={() => { onSubmit(email, password, confirm) }}
        >
          {submitting
            ? mode === 'sign-in'
              ? 'SIGNING IN — WAIT A MOMENT'
              : 'MAKING YOUR ACCOUNT — WAIT A MOMENT'
            : mode === 'sign-in'
              ? 'sign in'
              : 'make your account'}
        </button>
        <button className="ob-back" onClick={onBack} disabled={submitting}>
          back
        </button>
      </div>

      <div className="ob-fine print">
        {mode === 'sign-up' ? (
          <>
            {sub}
            <br />
            Your email is the key that locks your file — the name on the record is yours to
            choose later. No confirmation email, no magic links.
          </>
        ) : (
          <>
            {sub}
            <br />
            Wrong password? Use “make an account” to start a fresh file instead.
          </>
        )}
      </div>
    </div>
  )
}

// The result of handleAuthSubmit: either a successful auth call (with the Supabase
// result attached) or a client/local failure with a human-readable message.
export type AuthOutcome =
  | { ok: true; result: SignInResult | SignUpResult }
  | { ok: false; error: string }

// A tiny helper that runs signIn or signUp and produces the next screen decision.
export async function handleAuthSubmit(
  mode: 'sign-in' | 'sign-up',
  email: string,
  password: string,
  confirm: string,
): Promise<AuthOutcome> {
  if (mode === 'sign-up' && password !== confirm) {
    return { ok: false, error: 'Passwords do not match.' }
  }
  if (password.length < 8) {
    return { ok: false, error: 'Choose a password of at least 8 characters.' }
  }
  try {
    const result =
      mode === 'sign-in'
        ? await signIn(email, password)
        : await signUp(email, password)
    if (result.error) {
      return { ok: false, error: formatAuthError(result.error) }
    }
    if (!result.data || !result.data.user) {
      return {
        ok: false,
        error: mode === 'sign-in'
          ? 'We could not sign you in — check the email and password, or make a new account.'
          : 'We could not make your account — try again in a moment.',
      }
    }
    return { ok: true, result }
  } catch (err) {
    return { ok: false, error: formatAuthError(err) }
  }
}

function formatAuthError(err: unknown): string {
  const message = err && typeof err === 'object' && 'message' in err
    ? String((err as { message: unknown }).message)
    : err instanceof Error
      ? err.message
      : String(err ?? 'Unknown error')
  // Translate a few Supabase auth codes into plain language.
  if (typeof message !== 'string') return 'Something went wrong signing you in.'
  if (message.includes('Invalid login credentials')) {
    return 'That email and password do not match.'
  }
  if (message.includes('User already registered')) {
    return 'That email is already in use — sign in, or pick a different email.'
  }
  if (message.includes('weak password') || message.includes('Password should contain')) {
    return 'Choose a stronger password.'
  }
  if (message.includes('Email') || message.includes('email')) {
    return 'Check the email address and try again.'
  }
  return message || 'Something went wrong.'
}
