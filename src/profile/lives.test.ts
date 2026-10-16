import { describe, it, expect, beforeEach } from 'vitest'
import {
  LIVES_KEY, loadLives, saveLives, createNewLife, currentLife, switchToLife,
  retireActiveLife, startProtegeLife, lifeList, lifeSummary, type StorageLike,
} from './lives'

function memoryStorage(seed: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } {
  const map = new Map(Object.entries(seed))
  return {
    getItem: k => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v) },
    dump: () => Object.fromEntries(map),
  }
}

const DESK_KEY = 'mandate.desk.v1'

describe('the lives registry', () => {
  let storage: ReturnType<typeof memoryStorage>

  beforeEach(() => {
    // a desk already in progress, exactly as the app leaves it
    storage = memoryStorage({ [DESK_KEY]: '{"weekNumber":41,"decisions":{}}' })
  })

  it('starts empty and creates the first life', () => {
    expect(loadLives(storage)).toBe(null)
    const registry = createNewLife(storage, { playerName: 'Ada Okafor', positionId: 'lga/DT/Sapele/chairman', partyCode: 'PA' })
    expect(registry.lives).toHaveLength(1)
    expect(registry.activeId).toBe('life-1')
    expect(currentLife(storage)!.playerName).toBe('Ada Okafor')
  })

  it('appends a new life without touching the desk or the earlier life', () => {
    createNewLife(storage, { playerName: 'Ada Okafor', positionId: 'lga/DT/Sapele/chairman', partyCode: 'PA' })
    const before = loadLives(storage)!.lives[0]!
    const registry = createNewLife(storage, { playerName: 'Bola Ade', positionId: 'federal/senator/DT/central', partyCode: 'PDM' })

    expect(registry.lives).toHaveLength(2)
    expect(registry.activeId).toBe('life-2')
    expect(registry.lives[0]).toEqual(before)
    expect(storage.dump()[DESK_KEY]).toBe('{"weekNumber":41,"decisions":{}}')
    expect(Object.keys(storage.dump())).toContain(LIVES_KEY)
  })

  it('switches between lives and refuses an unknown id', () => {
    createNewLife(storage, { playerName: 'Ada', positionId: null, partyCode: 'PA' })
    createNewLife(storage, { playerName: 'Bola', positionId: null, partyCode: 'PDM' })
    expect(switchToLife(storage, 'life-1')!.activeId).toBe('life-1')
    expect(currentLife(storage)!.playerName).toBe('Ada')
    expect(switchToLife(storage, 'life-9')!.activeId).toBe('life-1')
  })

  it('ends a life without deleting it', () => {
    createNewLife(storage, { playerName: 'Ada', positionId: null, partyCode: 'PA' })
    const registry = retireActiveLife(storage, 'lost the ward in 2029')!
    expect(registry.lives).toHaveLength(1)
    expect(registry.lives[0]!.retiredAt).toBe('2026-01-01')
    expect(registry.lives[0]!.history.at(-1)!.summary).toBe('lost the ward in 2029')
    expect(lifeSummary(registry.lives[0]!)).toContain('lost the ward in 2029')
  })

  it('starts a protégé with both lives kept', () => {
    createNewLife(storage, { playerName: 'Ada Okafor', positionId: 'state/DT/governor', partyCode: 'PA' })
    const registry = startProtegeLife(storage, { playerName: 'The Aide', positionId: null, partyCode: 'PA' })
    expect(registry.lives).toHaveLength(2)
    expect(registry.lives[1]!.history[0]!.summary).toContain('Protégé of Ada Okafor')
    expect(lifeList(storage)).toHaveLength(2)
    expect(lifeList(storage)[0]!.playerName).toBe('The Aide')
  })

  it('survives a corrupt store instead of throwing', () => {
    storage.setItem(LIVES_KEY, 'not json at all')
    expect(loadLives(storage)).toBe(null)
    expect(lifeList(storage)).toEqual([])
    expect(currentLife(storage)).toBe(null)
    expect(retireActiveLife(storage, 'nothing to retire')).toBe(null)
  })

  it('round-trips a whole registry through storage', () => {
    createNewLife(storage, { playerName: 'Ada', positionId: null, partyCode: 'PA', bank: 5_000_000 })
    const first = loadLives(storage)!
    saveLives(storage, first)
    expect(loadLives(storage)).toEqual(first)
  })
})
