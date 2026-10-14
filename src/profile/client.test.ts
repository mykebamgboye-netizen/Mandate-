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

describe('offline council register', () => {
  it('serves real councils for every state, so no Chairman post dead-ends', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await freshModule()

    const delta = await mod.listLgas('DT')
    expect(delta.length).toBeGreaterThan(0)
    expect(delta.every(l => l.stateCode === 'DT')).toBe(true)
    expect(delta.map(l => l.name)).toContain('Oshimili South')

    // The FCT's third tier is its area councils — the Chairman path must not dead-end there.
    const fct = await mod.listLgas('FC')
    expect(fct.map(l => l.name)).toContain('Abuja Municipal Area Council')

    // Every state the picker offers comes back with real councils and a capital-area one:
    // a council post is playable in Kano, Lagos, Rivers — not just the tutorial's state.
    const states = await mod.listStates()
    for (const st of states) {
      const rows = await mod.listLgas(st.code)
      expect(rows.length, `${st.name} needs councils`).toBeGreaterThanOrEqual(6)
      expect(rows.every(l => l.stateCode === st.code)).toBe(true)
      expect(rows.some(l => l.fiscalNote.includes('capital')), `${st.name} capital area`).toBe(true)
    }

    // A code that is not a state is empty, not a crash.
    expect(await mod.listLgas('ZZ')).toEqual([])
  })
})
