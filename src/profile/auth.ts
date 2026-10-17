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

/** Sign up with email + password. Creates a Supabase auth user; the app creates the
 *  profiles row separately (with id = auth.uid()) once the user is confirmed. */
export async function signUpWithPassword(email: string, password: string) {
  const client = publicClient()
  if (!client) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await client.auth.signUp({ email, password })
  return { data, error }
}

/** Sign out the current session. */
export async function signOut() {
  const client = publicClient()
  if (!client) return { error: null }
  const { error } = await client.auth.signOut()
  return { error }
}

/** Wait until a session is present (or timeout). Useful after sign-up before creating
 *  the profiles row, so auth.uid() is available. */
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
