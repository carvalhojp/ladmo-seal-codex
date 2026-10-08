import { describe, expect, it } from 'vitest'
import { allEquipmentProgressItems, equipmentProgressCatalog, loaderStages, mdgProgressCatalog } from '../data/equipmentProgressCatalog'
import { equipmentDungeons, equipmentPerfectModels } from '../data/equipment'
import { equipmentProgressCopy } from '../data/equipmentProgressCopy'
import { emptyEquipmentProgress, equipmentProgressKey, readEquipmentProgress, sanitizeEquipmentProgress, summarizeEquipmentProgress, updateEquipmentProgress } from './equipmentState'
import { createLocalPlayerDataRepository } from './playerDataRepository'
import { applyLadmoSave, createLadmoSave, parseLadmoSave, serializeLadmoSave } from './saveBackup'

const setup = (values: Record<string, string> = {}) => {
  const storage = { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values[key] = value }, removeItem: (key: string) => { delete values[key] } }
  return { values, storage, repo: createLocalPlayerDataRepository(() => storage) }
}
const progress = () => updateEquipmentProgress(updateEquipmentProgress(updateEquipmentProgress(emptyEquipmentProgress(), 'luxury-kindness-earring', true), 'susanoomon-loader', true, 'loader-lv-4'), 'mdg-tk-boots', true)
const save = () => createLadmoSave({ data: { seals: {}, dUnitProgress: {}, dUnitInventory: {}, equipment: progress() }, preferences: { language: 'pt' } })

describe('equipment progress identity and state', () => {
  it('has 8 independent equipment identities, 18 MDG pieces and explicit catalog associations', () => {
    expect(equipmentProgressCatalog).toHaveLength(8); expect(mdgProgressCatalog).toHaveLength(18)
    expect(new Set(allEquipmentProgressItems.map(item => item.id)).size).toBe(26)
    for (const item of allEquipmentProgressItems) {
      expect(equipmentDungeons.some(dungeon => dungeon.id === item.dungeonId)).toBe(true)
      if (item.modelId) expect(equipmentPerfectModels.find(model => model.id === item.modelId)?.name).toBe(item.names.pt)
    }
    expect(allEquipmentProgressItems.some(item => item.id === 'miraculous-digital-earring')).toBe(false)
    expect(new Set(loaderStages.map(stage => stage.id)).size).toBe(12)
  })
  it('localizes every new label and identity in all four languages', () => {
    for (const lang of ['pt', 'en', 'es', 'ko'] as const) {
      expect(Object.keys(equipmentProgressCopy[lang]).sort()).toEqual(Object.keys(equipmentProgressCopy.pt).sort())
      expect(Object.values(equipmentProgressCopy[lang]).every(Boolean)).toBe(true)
      expect(allEquipmentProgressItems.every(item => Boolean(item.names[lang]))).toBe(true)
    }
  })
  it('registers/removes possession without mutating the old state or creating resources', () => {
    const original = emptyEquipmentProgress(), next = updateEquipmentProgress(original, 'luxury-kindness-earring', true)
    expect(original.items).toEqual({}); expect(next.items).toEqual({ 'luxury-kindness-earring': { owned: true } })
    expect(updateEquipmentProgress(next, 'luxury-kindness-earring', false)).toEqual(original)
    expect(Object.keys(next)).toEqual(['version', 'items'])
  })
  it('distinguishes absence, unknown stage, Lv 0 and complete; keeps only the current stage', () => {
    const unknown = updateEquipmentProgress(emptyEquipmentProgress(), 'susanoomon-loader', true)
    expect(unknown.items['susanoomon-loader']).toEqual({ owned: true })
    for (const stage of loaderStages) {
      const next = updateEquipmentProgress(unknown, 'susanoomon-loader', true, stage.id)
      expect(next.items['susanoomon-loader']).toEqual({ owned: true, stageId: stage.id })
      expect(updateEquipmentProgress(next, 'susanoomon-loader', false).items).toEqual({})
    }
    expect(() => updateEquipmentProgress(unknown, 'susanoomon-loader', true, 'recipe-2')).toThrow()
    expect(() => updateEquipmentProgress(unknown, 'shiny-arena-ring', true, 'loader-lv-0')).toThrow()
  })
  it('retains independent MDG pieces and derives the summary by identity', () => {
    let state = progress()
    state = updateEquipmentProgress(state, 'mdg-davies-boots', true)
    expect(summarizeEquipmentProgress(state)).toEqual({ equipment: 2, mdgPieces: 2, loaderStage: 'loader-lv-4' })
    expect(state.items['mdg-tk-boots']).toEqual({ owned: true })
  })
  it('sanitizes unknown identities, contradictory stages and derived fields', () => {
    const raw = { version: 1, items: { unknown: { owned: true }, 'susanoomon-loader': { owned: false, stageId: 'loader-lv-3' }, 'mdg-tk-boots': { owned: true, weeks: 10 }, 'shiny-arena-ring': { owned: true, stageId: 'loader-lv-0' } }, tera: 500 }
    expect(sanitizeEquipmentProgress(raw)).toEqual({ ignored: 3, state: { version: 1, items: { 'mdg-tk-boots': { owned: true } } } })
    expect(sanitizeEquipmentProgress({ version: 999, items: {} })).toBeNull()
  })
  it.each(['{', '{"version":999,"items":{}}', '{"version":1,"items":{"future-item":{"owned":true}}}'])('blocks invalid local storage without overwriting it: %s', raw => {
    const { repo, values } = setup({ [equipmentProgressKey]: raw })
    expect(repo.loadLocalState().equipment.error).toBeTruthy()
    expect(() => repo.saveEquipmentProgress(progress())).toThrow()
    expect(values[equipmentProgressKey]).toBe(raw)
  })
  it('uses exactly one equipment key and restores records after reloading', () => {
    const { repo, storage, values } = setup()
    expect(readEquipmentProgress(storage)).toEqual({ state: emptyEquipmentProgress() })
    repo.saveEquipmentProgress(progress())
    expect(Object.keys(values)).toEqual([equipmentProgressKey])
    expect(createLocalPlayerDataRepository(() => storage).loadLocalState().equipment).toEqual({ state: progress() })
  })
  it('propagates write failure and reports unavailable reads', () => {
    const { storage } = setup()
    const repo = createLocalPlayerDataRepository(() => ({ ...storage, setItem: () => { throw new Error('full') } }))
    expect(() => repo.saveEquipmentProgress(progress())).toThrow('full')
    expect(readEquipmentProgress({ getItem: () => { throw new Error('unavailable') } }).error).toBe('storage')
  })
})

describe('Save V3 equipment integration', () => {
  it('exports/restores V3 equipment and previews user records', () => {
    const saved = save(), parsed = parseLadmoSave(serializeLadmoSave(saved)), { storage, repo } = setup()
    expect(saved.version).toBe(3); expect(saved.data.equipment).toEqual(progress())
    expect(parsed.ok && parsed.preview).toMatchObject({ equipment: 3, preservesEquipment: false })
    if (parsed.ok) applyLadmoSave(storage, parsed.save)
    expect(repo.loadLocalState().equipment.state).toEqual(progress())
  })
  it.each([1, 2])('previews and imports V%s while preserving equipment exactly', version => {
    const saved = save(), raw = { ...saved, version, data: { seals: {}, dUnitProgress: {}, dUnitInventory: {}, ...(version === 2 ? { goals: saved.data.goals } : {}) } }
    const original = JSON.stringify(progress()), { values, repo } = setup({ [equipmentProgressKey]: original, external: 'keep' })
    const parsed = parseLadmoSave(JSON.stringify(raw))
    expect(parsed.ok && parsed.preview).toMatchObject({ equipment: null, preservesEquipment: true, removesGoals: version === 1 })
    expect(values).toEqual({ [equipmentProgressKey]: original, external: 'keep' })
    if (parsed.ok) repo.replaceSaveData(parsed.save)
    expect(values[equipmentProgressKey]).toBe(original); expect(values.external).toBe('keep')
  })
  it('rejects invalid V3 domain structure and reports ignored equipment records', () => {
    const raw = save()
    expect(parseLadmoSave(JSON.stringify({ ...raw, data: { ...raw.data, equipment: null } })).ok).toBe(false)
    const parsed = parseLadmoSave(JSON.stringify({ ...raw, data: { ...raw.data, equipment: { version: 1, items: { ...progress().items, unknown: { owned: true } } } } }))
    expect(parsed.ok && parsed.preview.ignoredRecords).toBe(1)
    expect(parsed.ok && parsed.save.version === 3 && parsed.save.data.equipment).toEqual(progress())
  })
  it.each([equipmentProgressKey, 'ladmo-tamer-goals-v1'])('rolls back all domains on failure at %s', failedKey => {
    const { values, storage } = setup({ [equipmentProgressKey]: JSON.stringify(progress()), 'ladmo-lang': '"ko"', external: 'keep' })
    const before = { ...values }
    const broken = { ...storage, setItem: (key: string, value: string) => { storage.setItem(key, value); if (key === failedKey) throw new Error('write failed') } }
    expect(() => applyLadmoSave(broken, createLadmoSave({ data: { seals: {}, dUnitProgress: {}, dUnitInventory: {} }, preferences: { language: 'en' } }))).toThrow()
    expect(values).toEqual(before)
  })
})
