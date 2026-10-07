import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { confirmedDUnitPortraitIdentities } from '../data/dUnitPortraitIdentityAudit'
import { dUnitInventoryKey, dUnitProgressKey, hasDUnitInventoryRecord, type DUnitInventory, type DUnitInventoryEntry, type DUnitProgress } from './dUnit'
import { legacyInventoryIdAliases } from './dUnit'
import { legacySealIdAliases, migrateDuplicateDorugamon, sealStateKey, toOwnedSeals, type SealStateMap, type SealUserState } from './sealState'

export const saveFormat = 'ladmo-codex-save' as const
export const saveVersion = 2 as const
export type SaveLanguage = 'pt' | 'en' | 'es' | 'ko'
import { emptyTamerGoals, tamerGoalsKey, validateTamerGoals, type TamerGoalsState } from './tamerGoals'

export interface LadmoSaveV1 {
  format: typeof saveFormat
  version: 1
  exportedAt: string
  data: { seals: SealStateMap; dUnitProgress: DUnitProgress; dUnitInventory: DUnitInventory }
  preferences: { language: SaveLanguage }
}
export interface LadmoSaveV2 extends Omit<LadmoSaveV1, 'version' | 'data'> { version: 2; data: LadmoSaveV1['data'] & { goals: TamerGoalsState } }
export type LadmoSave = LadmoSaveV1 | LadmoSaveV2
export const goalsFromSave = (save: LadmoSave) => save.version === 2 ? save.data.goals : emptyTamerGoals()
export interface SavePreview { exportedAt: string; seals: number; completedConditions: number; inventory: number; language: SaveLanguage; ignoredRecords: number; goals: number; removesGoals: boolean }
export type SaveParseResult = { ok: true; save: LadmoSave; preview: SavePreview } | { ok: false; error: 'invalidJson' | 'invalidFormat' | 'unsupportedVersion' | 'invalidStructure' }
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const languages = new Set<SaveLanguage>(['pt', 'en', 'es', 'ko'])
const sealIds = new Set(seals.map(seal => seal.id))
const setIds = new Set(dUnitSets.map(set => set.id))
const conditionIds = new Set(dUnitSets.flatMap(set => set.conditions.map(condition => condition.id)))
const digimonIds = new Set(confirmedDUnitPortraitIdentities().flatMap(entry => entry.digimonId ? [entry.digimonId] : []))
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function sanitizeSeals(value: unknown) {
  if (!isObject(value)) return null
  let ignored = 0
  const next: SealStateMap = {}
  for (const [rawId, rawState] of Object.entries(value)) {
    const isLegacy = Boolean(legacySealIdAliases[rawId])
    if ((!sealIds.has(rawId) && !isLegacy) || !isObject(rawState)) { ignored++; continue }
    const quantity = typeof rawState.quantity === 'number' && Number.isFinite(rawState.quantity) ? Math.max(0, rawState.quantity) : 0
    next[rawId] = { quantity, hasSeal: rawState.hasSeal === true, doNotRecommend: rawState.doNotRecommend === true }
  }
  return { value: migrateDuplicateDorugamon(next), ignored }
}

function sanitizeProgress(value: unknown) {
  if (!isObject(value)) return null
  let ignored = 0
  const next: DUnitProgress = {}
  for (const [setId, rawConditions] of Object.entries(value)) {
    if (!setIds.has(setId) || !isObject(rawConditions)) { ignored++; continue }
    const accepted: Record<string, boolean> = {}
    for (const [conditionId, checked] of Object.entries(rawConditions)) {
      if (!conditionIds.has(conditionId)) { ignored++; continue }
      if (checked === true) accepted[conditionId] = true
    }
    if (Object.keys(accepted).length) next[setId] = accepted
  }
  return { value: next, ignored }
}

function sanitizeInventory(value: unknown) {
  if (!isObject(value)) return null
  let ignored = 0
  const next: DUnitInventory = {}
  for (const [rawId, rawEntry] of Object.entries(value)) {
    const id = legacyInventoryIdAliases[rawId] ?? rawId
    if (!digimonIds.has(id) || !isObject(rawEntry)) { ignored++; continue }
    const level = typeof rawEntry.level === 'number' && Number.isFinite(rawEntry.level) ? Math.max(0, Math.floor(rawEntry.level)) : undefined
    const entry: DUnitInventoryEntry = { owned: rawEntry.owned === true, evolutionUnlocked: rawEntry.evolutionUnlocked === true, transcended: rawEntry.transcended === true, ...(level === undefined ? {} : { level }) }
    if (hasDUnitInventoryRecord(entry)) next[id] = entry
  }
  return { value: next, ignored }
}

const buildSave = (raw: unknown): SaveParseResult => {
  if (!isObject(raw)) return { ok: false, error: 'invalidStructure' }
  if (raw.format !== saveFormat) return { ok: false, error: 'invalidFormat' }
  if (raw.version !== 1 && raw.version !== 2) return { ok: false, error: 'unsupportedVersion' }
  if (typeof raw.exportedAt !== 'string' || Number.isNaN(Date.parse(raw.exportedAt)) || !isObject(raw.data) || !isObject(raw.preferences) || !languages.has(raw.preferences.language as SaveLanguage)) return { ok: false, error: 'invalidStructure' }
  const sealsResult = sanitizeSeals(raw.data.seals), progressResult = sanitizeProgress(raw.data.dUnitProgress), inventoryResult = sanitizeInventory(raw.data.dUnitInventory)
  if (!sealsResult || !progressResult || !inventoryResult) return { ok: false, error: 'invalidStructure' }
  const goals = raw.version === 2 ? validateTamerGoals(raw.data.goals) : emptyTamerGoals()
  if (!goals) return { ok: false, error: 'invalidStructure' }
  const base = { format: saveFormat, exportedAt: raw.exportedAt, data: { seals: sealsResult.value, dUnitProgress: progressResult.value, dUnitInventory: inventoryResult.value }, preferences: { language: raw.preferences.language as SaveLanguage } }
  const save: LadmoSave = raw.version === 1 ? { ...base, version: 1 } : { ...base, version: 2, data: { ...base.data, goals } }
  return { ok: true, save, preview: { exportedAt: save.exportedAt, seals: toOwnedSeals(save.data.seals).length, completedConditions: Object.values(save.data.dUnitProgress).reduce((total, conditions) => total + Object.keys(conditions).length, 0), inventory: Object.keys(save.data.dUnitInventory).length, language: save.preferences.language, goals: goals.goals.length, removesGoals: raw.version === 1, ignoredRecords: sealsResult.ignored + progressResult.ignored + inventoryResult.ignored } }
}

export function createLadmoSave(input: Omit<LadmoSaveV2, 'format' | 'version' | 'exportedAt' | 'data'> & { data: LadmoSaveV1['data'] & { goals?: TamerGoalsState }; exportedAt?: string }): LadmoSaveV2 {
  const result = buildSave({ format: saveFormat, version: saveVersion, exportedAt: input.exportedAt ?? new Date().toISOString(), data: { ...input.data, goals: input.data.goals ?? emptyTamerGoals() }, preferences: input.preferences })
  if (!result.ok) throw new Error('Cannot export an invalid LADMO save state')
  return result.save as LadmoSaveV2
}

export const serializeLadmoSave = (save: LadmoSave) => JSON.stringify(save, null, 2)

export function parseLadmoSave(text: string): SaveParseResult {
  try { return buildSave(JSON.parse(text) as unknown) } catch { return { ok: false, error: 'invalidJson' } }
}

/** Writes all Save V1 keys together and restores the previous values if a browser write fails. */
export function applyLadmoSave(storage: StorageLike, save: LadmoSave) {
  const values: [string, string][] = [
    ['ladmo-lang', JSON.stringify(save.preferences.language)],
    [sealStateKey, JSON.stringify(save.data.seals)],
    [dUnitProgressKey, JSON.stringify(save.data.dUnitProgress)],
    [dUnitInventoryKey, JSON.stringify(save.data.dUnitInventory)],
    [tamerGoalsKey, JSON.stringify(goalsFromSave(save))],
  ]
  const previous = values.map(([key]) => [key, storage.getItem(key)] as const)
  try { values.forEach(([key, value]) => storage.setItem(key, value)) }
  catch (error) {
    // Attempt every restoration even if an individual key continues failing.
    const failures: unknown[] = []
    previous.forEach(([key, value]) => { try { if (storage.getItem(key) !== value) { if (value === null) storage.removeItem(key); else storage.setItem(key, value) } } catch (failure) { failures.push(failure) } })
    if (failures.length) throw new Error('Backup rollback failed; storage is unavailable')
    throw error
  }
}
