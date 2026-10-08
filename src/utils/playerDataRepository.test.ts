import { describe, expect, it, vi } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { createLocalPlayerDataRepository } from './playerDataRepository'
import { createLadmoSave } from './saveBackup'
import { ladmoStorageKeys } from './localData'

const setup = (values: Record<string, string> = {}) => {
  const storage = {
    getItem: (key: string) => values[key] ?? null,
    setItem: vi.fn((key: string, value: string) => { values[key] = value }),
    removeItem: vi.fn((key: string) => { delete values[key] }),
    clear: vi.fn(),
  }
  return { values, storage, repository: createLocalPlayerDataRepository(() => storage) }
}

describe('local player data repository', () => {
  it('loads existing preferences/resources and preserves defaults and JSON fallback', () => {
    const empty = setup().repository.loadLocalState()
    expect(empty).toEqual({ equipment: { state: { version: 1, items: {} } }, goals: { state: { version: 1, goals: [] } }, language: 'pt', ticketBudget: 500, openerBudget: 20, seals: {}, dUnitProgress: {}, dUnitInventory: {} })
    expect(setup({ 'ladmo-lang': '"ko"', 'ladmo-tickets': '123', 'ladmo-openers': '7' }).repository.loadLocalState())
      .toMatchObject({ language: 'ko', ticketBudget: 123, openerBudget: 7 })
    expect(setup({ 'ladmo-lang': '{', 'ladmo-tickets': '{', 'ladmo-openers': '{' }).repository.loadLocalState()).toEqual(empty)
  })

  it('uses v2 before legacy and keeps migration in memory without removing legacy', () => {
    const legacy = JSON.stringify([{ sealId: 'seal-16709', quantity: 50 }])
    const { repository, values, storage } = setup({ 'ladmo-owned': legacy })
    const states = repository.loadLocalState().seals
    expect(states['seal-16709']).toEqual({ quantity: 50, hasSeal: true, doNotRecommend: false })
    expect(values).toEqual({ 'ladmo-owned': legacy })
    repository.saveSealState(states)
    expect(values['ladmo-owned']).toBe(legacy)
    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(setup({ 'ladmo-owned': legacy, 'ladmo-seal-state-v2': '{}' }).repository.loadLocalState().seals).toEqual({})
    expect(setup({ 'ladmo-owned': legacy, 'ladmo-seal-state-v2': '{' }).repository.loadLocalState().seals).toEqual({})
  })

  it('preserves seal alias merging and D-Unit readers/aliases', () => {
    const set = dUnitSets[0], condition = set.conditions[0].id
    const { repository } = setup({
      'ladmo-seal-state-v2': JSON.stringify({
        'seal-22829': { quantity: 100, hasSeal: false, doNotRecommend: true },
        'seal-19435': { quantity: 50, hasSeal: true, doNotRecommend: false },
      }),
      'ladmo-dunit-progress-v1': JSON.stringify({ [set.id]: { [condition]: true, invalid: true } }),
      'ladmo-dunit-inventory-v1': JSON.stringify({ 'omegamon-x-supremacy': { owned: true, level: 120 }, unknown: { owned: true } }),
    })
    const state = repository.loadLocalState()
    expect(state.seals).toEqual({ 'seal-19435': { quantity: 100, hasSeal: true, doNotRecommend: true } })
    expect(state.dUnitProgress).toEqual({ [set.id]: { [condition]: true } })
    expect(state.dUnitInventory).toEqual({ 'omegamon-resistance-supremacy': { owned: true, evolutionUnlocked: false, transcended: false, level: 120 } })
  })

  it('writes all six states using the same keys and JSON serialization', () => {
    const { repository, values, storage } = setup()
    const seals = { example: { quantity: 10, hasSeal: true, doNotRecommend: false } }
    const progress = { example: { condition: true } }, inventory = { tentomon: { owned: true } }
    repository.saveSealState(seals)
    repository.saveDUnitProgress(progress)
    repository.saveDUnitInventory(inventory)
    repository.saveLanguage('es')
    repository.saveTicketBudget(42)
    repository.saveOpenerBudget(3)
    expect(values).toEqual({
      'ladmo-seal-state-v2': JSON.stringify(seals),
      'ladmo-dunit-progress-v1': JSON.stringify(progress),
      'ladmo-dunit-inventory-v1': JSON.stringify(inventory),
      'ladmo-lang': '"es"', 'ladmo-tickets': '42', 'ladmo-openers': '3',
    })
    expect(storage.clear).not.toHaveBeenCalled()
  })

  it('delegates Save v1 replacement without changing auxiliary state', () => {
    const { repository, values, storage } = setup({ 'ladmo-owned': 'legacy', 'ladmo-tickets': '42', 'ladmo-openers': '3', external: 'keep' })
    const save = createLadmoSave({ data: { seals: {}, dUnitProgress: {}, dUnitInventory: { tentomon: { owned: true } } }, preferences: { language: 'en' } })
    repository.replaceSaveData(save)
    expect(values['ladmo-lang']).toBe('"en"')
    expect(values['ladmo-seal-state-v2']).toBe(JSON.stringify(save.data.seals))
    expect(values['ladmo-dunit-progress-v1']).toBe(JSON.stringify(save.data.dUnitProgress))
    expect(values['ladmo-dunit-inventory-v1']).toBe(JSON.stringify(save.data.dUnitInventory))
    expect(values).toMatchObject({ 'ladmo-owned': 'legacy', 'ladmo-tickets': '42', 'ladmo-openers': '3', external: 'keep' })
    expect(storage.clear).not.toHaveBeenCalled()
  })

  it('retains the existing rollback on an import write failure', () => {
    const { repository, storage, values } = setup({ 'ladmo-lang': '"ko"', 'ladmo-seal-state-v2': 'old', external: 'keep' })
    const before = { ...values }
    const write = storage.setItem.getMockImplementation()!
    let failed = false
    storage.setItem.mockImplementation((key, value) => {
      if (key === 'ladmo-dunit-progress-v1' && !failed) { failed = true; throw new Error('write failed') }
      write(key, value)
    })
    const save = createLadmoSave({ data: { seals: {}, dUnitProgress: {}, dUnitInventory: {} }, preferences: { language: 'en' } })
    expect(() => repository.replaceSaveData(save)).toThrow('write failed')
    expect(values).toEqual(before)
    expect(storage.clear).not.toHaveBeenCalled()
  })

  it('clears exactly the seven current keys and preserves external data', () => {
    const { repository, values, storage } = setup({ ...Object.fromEntries(ladmoStorageKeys.map(key => [key, 'saved'])), external: 'keep' })
    repository.clearLocalData()
    expect(storage.removeItem.mock.calls.map(([key]) => key)).toEqual([...ladmoStorageKeys])
    expect(values).toEqual({ external: 'keep' })
    expect(storage.clear).not.toHaveBeenCalled()
  })
})
