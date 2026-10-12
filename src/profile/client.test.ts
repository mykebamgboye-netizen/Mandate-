// Regression guard for the Supabase env wiring.
//
// The env reads in client.ts must go through static `import.meta.env.VITE_*` tokens so the
// bundler inlines them at build time. A dynamic read (e.g. `globalThis.import?.meta?.env`) is
// never replaced, which silently disables the Supabase path in production even when the deploy
// host has the vars set — and never throws, so nothing else catches it.
import { afterEach, describe, expect, it, vi } from 'vitest'

async function freshModule() {
  vi.resetModules()
  return await import('./client')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('Supabase env wiring', () => {
  it('becomes configured when VITE_SUPABASE_* are present at build time', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    const mod = await freshModule()
    expect(mod.supabaseConfigured()).toBe(true)
    expect(mod.publicClient()).not.toBeNull()
  })

  it('falls back to null (no throw) when the env vars are absent', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await freshModule()
    expect(mod.supabaseConfigured()).toBe(false)
    expect(mod.publicClient()).toBeNull()
  })
})
