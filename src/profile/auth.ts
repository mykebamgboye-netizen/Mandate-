// @mandate/profile/auth — Supabase Auth for per-player sign-in/sign-up/sign-out.
//
// Production: uses the same public client the rest of the profile layer uses, so auth
// sessions share the same persistence (cookies in the browser, set by the Supabase JS SDK).
// When Supabase is not configured (no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), every
// function returns a null/empty result so the app boots to the local fallback without error.
//
// The profile row is keyed on auth.uid(): on first sign-in with no profile, the onboarding
// boot creates a profiles row whose id = auth.uid(). RLS (migration 001) then scopes every
// read/write to that user.

import { publicClient, supabaseConfigured } from './client'

/** The currently-signed-in Supabase user, or null when signed out / not configured. */
export async function getCurrentUser() {
  const client = publicClient()
  if (!client) return null
  try {
    const { data } = await client.auth.getUser()
    return data.user ?? null
  } catch {
    return null
  }
}

/** The auth.uid() the RLS policies key on — null when not signed in or not configured. */
export async function getUserSub(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

/** Sign in with email + password. Returns the user on success. */
export async function signInWithPassword(email: string, password: string) {
  const client = publicClient()
  if (!client) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  return { data, error }
}

/**
 * Sign up with email + password. Straight sign-up/sign-in — no email confirmation step:
 * the Supabase project has confirmations disabled, so signUp returns a session and
 * auth.uid() immediately. On the rare path where the provider still wants a confirm, we
 * sign the just-created account in with its password so the session is available now.
 */
export async function signUpWithPassword(email: string, password: string) {
  const client = publicClient()
  if (!client) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) return { data: null, error }
  // Confirmations are disabled at the Supabase project, so signUp returns a session +
  // user immediately and the player is signed in as part of the same call.
  if (data.user && data.session) {
    return { data: { user: data.user, session: data.session }, error: null }
  }
  // Rare path where the provider still wants a separate confirm: sign in with the
  // just-created credentials so we have a session now instead of polling on email.
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({ email, password })
  return { data: loginData, error: loginError ?? error }
}

/** Sign out the current session. */
export async function signOut() {
  const client = publicClient()
  if (!client) return { error: null }
  const { error } = await client.auth.signOut()
  return { error }
}

/**
 * Wait until a session is present (or timeout). Left for other callers — the sign-up
 * path no longer needs it, since signUpWithPassword now resolves the session itself.
 */
export async function waitForAuth(timeoutMs = 10_000): Promise<{ user: Awaited<ReturnType<typeof getCurrentUser>>; elapsed: number }> {
  const client = publicClient()
  if (!client) return { user: null, elapsed: 0 }
  const start = Date.now()
  let elapsed = 0
  while (elapsed < timeoutMs) {
    const user = await getCurrentUser()
    if (user) return { user, elapsed }
    await new Promise(r => setTimeout(r, 200))
    elapsed = Date.now() - start
  }
  return { user: await getCurrentUser(), elapsed }
}

/** True when Supabase is configured AND a user is signed in. */
export async function isSignedIn(): Promise<boolean> {
  if (!supabaseConfigured()) return false
  const user = await getCurrentUser()
  return user != null
}
