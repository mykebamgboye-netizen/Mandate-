// Regression guard for the Supabase env wiring.
//
// The env reads in client.ts must go through static `import.meta.env.VITE_*` tokens so the
// bundler inlines them at build time. A dynamic read (e.g. `globalThis.import?.meta?.env`) is
// never replaced, which silently disables the Supabase path in production even when the deploy
// host has the vars set — and never throws, so nothing else catches it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { explainError, shortError } from './errors'

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

describe('profile writes speak the table’s own column names', () => {
  it('sends patronage_bank (and upserts), never camelCase', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    const mod = await freshModule()

    const restCalls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit | undefined) => {
      restCalls.push({ url: String(input), init: init ?? {} })
      return new Response(
        JSON.stringify({
          id: 'uid-1', handle: 'A. B. Testname',
          created_at: '2026-10-08T07:00:00Z', updated_at: '2026-10-08T07:00:00Z',
          identity: {}, office: {}, party: {}, axes: {}, powers: [],
          patronage_bank: 3_834_790_251, deleted_at: null,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )
    }))

    await mod.createProfile({
      handle: 'A. B. Testname',
      identity: { name: 'A. B. Testname' } as never,
      office: {} as never,
      party: {} as never,
      powers: ['sign.memo'],
      patronageBank: 3_834_790_251,
      authUserId: 'uid-1',
    })

    const call = restCalls.find(c => c.url.includes('/rest/v1/profiles'))
    expect(call, 'no POST reached /rest/v1/profiles').toBeTruthy()
    const body = JSON.parse(String(call!.init.body))
    // The bug that surfaced on the onboarding sheet as "[object Object]": a camelCase key
    // against a snake_case column is PGRST204, and PGRST204 is a plain object.
    expect(body).toHaveProperty('patronage_bank', 3_834_790_251)
    expect(body).not.toHaveProperty('patronageBank')
    expect(body.id).toBe('uid-1')
    expect(body).not.toHaveProperty('updatedAt')
    expect(body).toHaveProperty('updated_at')
    // re-running onboarding must rewrite the row rather than die on 23505.
    // Read the header through Headers (case-insensitive, values combined): the Fetch spec
    // lowercases header names on the wire, so `headers.Prefer` is always undefined even
    // though `prefer` is set.
    const prefer = new Headers(call!.init.headers as HeadersInit).get('Prefer') ?? ''
    expect(prefer).toContain('resolution=merge-duplicates')
  })
})

// The whole reported bug, end to end: PostgREST rejects the write, and the value that reaches
// the toast must read as English. Verified against a real postgrest-js response shape — its
// `error` is a plain object, so String(err) is always "[object Object]".
describe('a rejected cloud save reads as English', () => {
  it('translates a PGRST204 body into the sentence the player sees', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    const mod = await freshModule()

    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        code: 'PGRST204',
        message: "Could not find the 'patronageBank' column of 'profiles' in the schema cache",
        details: null,
        hint: null,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )))

    let caught: unknown = null
    try {
      await mod.createProfile({
        handle: 'A. B. Testname',
        identity: { name: 'A. B. Testname' } as never,
        office: {} as never,
        party: {} as never,
        powers: [],
        patronageBank: 1,
        authUserId: 'uid-1',
      })
    } catch (err) {
      caught = err
    }
    expect(caught, 'the rejected write must reach the catch').toBeTruthy()

    // Exactly what App.tsx interpolates into the toast.
    const toast = shortError(caught)
    expect(toast).not.toContain('[object Object]')
    expect(toast).toContain('migrations are out of date')
    // The full sentence keeps the PostgREST code; the toast trims it to one line.
    expect(explainError(caught)).toContain('PGRST204')
    expect(toast.length).toBeLessThanOrEqual(110)
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
