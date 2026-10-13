// @mandate/profile/auth — Supabase email+password auth shell for the player profile flow.
//
// Design decisions from the requirement set:
//   - Simple username + password sign-up / sign-in / sign-out. NO OTP and NO magic links.
//   - Sign-up does NOT require an email confirmation: the Supabase project runs with
//     auto-confirm enabled, so signUp returns a session immediately.
//   - The email is the auth identity the DB RLS (auth.uid() = id) enforces; the player's
//     chosen username is a separate display field (profiles.handle), never a login key.
//   - All calls use the public anon client only (never service_role) — browser-safe.
//   - The public client is null when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent,
//     so calling these functions when Supabase is unconfigured is a no-op (data/error = null).

import { supabaseConfigured, publicClient, adminClient } from './client'
import type { ProfileIdentity } from './types'

// Result shape every auth call returns: the typed Supabase session/user data on success,
// null on graceful no-configuration, and an error object (never thrown) on a real failure.
export interface AuthResult<T = unknown> {
  data: T | null
  error: Error | null
}

export interface GetSessionResult {
  data: {
    user: { id: string; email: string } | null
    session: { access_token: string; expires_at: number } | null
  } | null
  error: Error | null
}

export interface SignUpResult extends AuthResult<{ user: { id: string; email: string } | null; session: { access_token: string } | null }> {}

export interface SignInResult extends AuthResult<{ user: { id: string; email: string } | null; session: { access_token: string } | null }> {}

export interface GetUserResult extends AuthResult<{ id: string; email: string }> {}

// ---- Sign-up: create an account with email + password. No OTP, no magic link. ----
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = publicClient()
  if (!client) return { data: null, error: null }
  const { data, error } = await client.auth.signUp({
    email,
    password,
  })
  if (!data) return { data: null, error: error ?? null }
  return {
    data: {
      user: data.user ? { id: data.user.id, email: data.user.email ?? '' } : null,
      session: data.session ? { access_token: data.session.access_token } : null,
    },
    error: error ?? null,
  }
}

// ---- Sign-in: email + password. No OTP, no magic link. ----
export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = publicClient()
  if (!client) return { data: null, error: null }
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (!data) return { data: null, error: error ?? null }
  return {
    data: {
      user: data.user ? { id: data.user.id, email: data.user.email ?? '' } : null,
      session: data.session ? { access_token: data.session.access_token } : null,
    },
    error: error ?? null,
  }
}

// ---- Sign-out: this device only (local scope), so a stolen browser doesn't log out the
//      player across all their devices. ----
export async function signOut(): Promise<AuthResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = publicClient()
  if (!client) return { data: null, error: null }
  const { error } = await client.auth.signOut({ scope: 'local' })
  return { data: null, error: error ?? null }
}

// ---- Current user / session — the "who am I" read for the profile boot. ----
export async function getUser(): Promise<GetUserResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = publicClient()
  if (!client) return { data: null, error: null }
  const { data } = await client.auth.getUser()
  const user = data?.user
  if (!user) return { data: null, error: null }
  return { data: { id: user.id, email: user.email ?? '' }, error: null }
}

export async function getSession(): Promise<GetSessionResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = publicClient()
  if (!client) return { data: null, error: null }
  const { data } = await client.auth.getSession()
  const session = data?.session
  if (!session) return { data: null, error: null }
  return {
    data: {
      user: { id: session.user.id, email: session.user.email ?? '' },
      session: { access_token: session.access_token, expires_at: session.expires_at ?? 0 },
    },
    error: null,
  }
}

// ---- Admin surface (service_role only). Available for migrations / seeding, not shipped
//      to the browser. Callers opt in; they must sit in a trusted path.

export async function adminGetUserById(userId: string): Promise<GetUserResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = adminClient()
  if (!client) return { data: null, error: new Error('admin client is not configured') }
  const { data } = await client.auth.admin.getUserById(userId)
  if (!data?.user) return { data: null, error: null }
  return {
    data: { id: data.user.id, email: data.user.email ?? '' },
    error: null,
  }
}

export async function adminCreateUser(email: string, password: string): Promise<GetUserResult> {
  if (!supabaseConfigured()) return { data: null, error: null }
  const client = adminClient()
  if (!client) return { data: null, error: new Error('admin client is not configured') }
  const { data } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (!data?.user) return { data: null, error: null }
  return {
    data: { id: data.user.id, email: data.user.email ?? '' },
    error: null,
  }
}

// ---- Profile link contract: a profile row's `id` is its Supabase auth `user.id`
//      (see RLS `auth.uid() = id`). This helper mirrors that contract so the app always
//      knows which auth user owns a profile. ----
export function profileIdentityForUser(profileIdentity: ProfileIdentity): ProfileIdentity {
  return profileIdentity
}
