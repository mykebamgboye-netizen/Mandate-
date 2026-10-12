// Regression guard for the scenario lookup.
//
// The lookup used PostgREST `.single()`, which raises PGRST116 both when there are no
// rows and when there is more than one. The client treated every PGRST116 as "not
// found", so a duplicated scenario row — which the old bare `ON CONFLICT DO NOTHING`
// seed could produce, because it cannot conflict against a surrogate `id` primary key
// — silently dropped the boot onto the local fallback instead of surfacing anything.
// The read is now an explicit ordered limit(1) so duplicates stay visible and the
// result stays deterministic. Migration 001 deduplicates and adds the unique index
// that makes one row per scenario_id a real invariant.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = { rows: [] as any[], calls: [] as string[] }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const chain: any = {
      from(table: string) {
        state.calls.push(`from:${table}`)
        return chain
      },
      select() {
        state.calls.push('select')
        return chain
      },
      eq(col: string) {
        state.calls.push(`eq:${col}`)
        return chain
      },
      order(col: string) {
        state.calls.push(`order:${col}`)
        return chain
      },
      limit(n: number) {
        state.calls.push(`limit:${n}`)
        return Promise.resolve({ data: state.rows, error: null })
      },
      single() {
        state.calls.push('single')
        return Promise.resolve({
          data: state.rows.length === 1 ? state.rows[0] : null,
          error:
            state.rows.length > 1
              ? { code: 'PGRST116', message: 'The result contains 2 rows' }
              : null,
        })
      },
    }
    return chain
  },
}))

function row(id: string, startedAt: string) {
  return {
    id,
    scenario_id: 'delta/2026/w41',
    title: 'Situation Desk — Delta, 8 Oct 2026',
    office_id: 'state/governor',
    state_code: 'DT',
    seed: 12648430,
    started_at: startedAt,
  }
}

async function freshModule() {
  vi.resetModules()
  return await import('./client')
}

beforeEach(() => {
  state.rows = []
  state.calls = []
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('findScenarioByScenarioId', () => {
  it('returns the earliest row when the table holds duplicates, and never uses .single()', async () => {
    // The fake echoes rows in the order the query asked for them (ascending
    // started_at, then id), which is what the real ordered query returns.
    const earliest = row('00000000-0000-0000-0000-00000000000a', '2026-10-08T03:52:31Z')
    state.rows = [earliest, row('00000000-0000-0000-0000-00000000000b', '2026-10-08T03:52:31Z')]

    const mod = await freshModule()
    const found = await mod.findScenarioByScenarioId('delta/2026/w41')

    expect(found?.id).toBe(earliest.id)
    expect(found?.seed).toBe(12648430)
    expect(state.calls).toEqual([
      'from:scenario_start_state',
      'select',
      'eq:scenario_id',
      'order:started_at',
      'order:id',
      'limit:1',
    ])
    expect(state.calls).not.toContain('single')
  })

  it('returns null when the scenario is absent, without throwing', async () => {
    state.rows = []
    const mod = await freshModule()
    await expect(mod.findScenarioByScenarioId('delta/2026/w41')).resolves.toBeNull()
  })

  it('falls back to the local Delta tutorial scenario when Supabase is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await freshModule()
    expect(mod.supabaseConfigured()).toBe(false)
    const found = await mod.findScenarioByScenarioId('delta/2026/w41')
    expect(found?.scenarioId).toBe('delta/2026/w41')
    await expect(mod.findScenarioByScenarioId('nope/2026/w01')).resolves.toBeNull()
  })
})
