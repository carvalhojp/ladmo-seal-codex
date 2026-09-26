import { dUnitSets, type DUnitCondition } from '../data/dUnitAudit'
import { calculateDUnitCostBenefitRoute, type DUnitAccessibilityCeiling, type DUnitCandidateRoute, type DUnitCostBenefitClass, type DUnitCostBreakdown, type DUnitCostConfidence, type DUnitHighTierExposure, type DUnitPlayerState, type DUnitRecommendationReason, type DUnitRouteSelectionBasis } from './dUnitCostBenefit'
import { confirmedDUnitPortraitIdentities } from '../data/dUnitPortraitIdentityAudit'
import { progressionAuditForDigimon } from '../data/dUnitPortraitProgressionAudit'

export const dUnitProgressKey = 'ladmo-dunit-progress-v1'
export const dUnitInventoryKey = 'ladmo-dunit-inventory-v1'
export type DUnitProgress = Record<string, Record<string, boolean>>
export type DUnitInventoryEntry = { owned?: boolean; evolutionUnlocked?: boolean; level?: number; transcended?: boolean }
export type DUnitInventory = Record<string, DUnitInventoryEntry>
export type DUnitBonusKey = `${string}|${string}|${string}`
export const hasDUnitInventoryRecord = (entry: DUnitInventoryEntry | undefined) => Boolean(entry?.owned || entry?.evolutionUnlocked || entry?.transcended || (entry?.level ?? 0) > 0)

const validConditionIds = new Set(dUnitSets.flatMap(set => set.conditions.map(condition => condition.id)))
const validInventoryIds = new Set(confirmedDUnitPortraitIdentities().flatMap(entry => entry.digimonId ? [entry.digimonId] : []))
/** Kept solely to preserve records stored before the ordered source correction. */
const legacyInventoryIdAliases: Record<string, string> = { 'omegamon-x-supremacy': 'omegamon-resistance-supremacy' }

export const readDUnitProgress = (storage: Pick<Storage, 'getItem'>): DUnitProgress => {
  try {
    const raw: unknown = JSON.parse(storage.getItem(dUnitProgressKey) || '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).flatMap(([setId, conditions]) => {
      if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions) || !dUnitSets.some(set => set.id === setId)) return []
      const valid = Object.fromEntries(Object.entries(conditions as Record<string, unknown>).filter(([conditionId, checked]) => checked === true && validConditionIds.has(conditionId))) as Record<string, boolean>
      return Object.keys(valid).length ? [[setId, valid]] : []
    }))
  } catch { return {} }
}
export const readDUnitInventory = (storage: Pick<Storage, 'getItem'>): DUnitInventory => {
  try {
    const raw: unknown=JSON.parse(storage.getItem(dUnitInventoryKey)||'{}')
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {}
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).flatMap(([rawId,value])=>{
      const id=legacyInventoryIdAliases[rawId]??rawId
      if(!validInventoryIds.has(id)||!value||typeof value!=='object'||Array.isArray(value))return []
      const entry=value as Record<string, unknown>, level=typeof entry.level==='number'&&Number.isFinite(entry.level)?Math.max(0,Math.floor(entry.level)):undefined
      const clean:DUnitInventoryEntry={owned:entry.owned===true,evolutionUnlocked:entry.evolutionUnlocked===true,transcended:entry.transcended===true,...(level===undefined?{}:{level})}
      return hasDUnitInventoryRecord(clean)?[[id,clean]]:[]
    }))
  } catch{return {}}
}
export const updateDUnitInventory = (inventory:DUnitInventory,digimonId:string,patch:DUnitInventoryEntry):DUnitInventory => {
  if(!validInventoryIds.has(digimonId))return inventory
  const entry={...(inventory[digimonId]??{}),...patch}
  return {...inventory,[digimonId]:entry}
}
export const dUnitPlayerStateFromInventory = (inventory:DUnitInventory):DUnitPlayerState => {
  const identities=confirmedDUnitPortraitIdentities()
  const progressionFor=(id:string)=>progressionAuditForDigimon(id).find(entry=>entry.evolutionStatus==='confirmed'&&entry.evolutionLineId)
  const lineFor=(id:string)=>progressionFor(id)?.evolutionLineId??identities.find(entry=>entry.digimonId===id)?.evolutionLineId
  const isManualBase=(id:string)=>progressionFor(id)?.relationship==='base'
  const ids=Object.keys(inventory)
  return {
    ownedDigimonIds:ids.filter(id=>inventory[id]?.owned),
    // For manually reviewed lines, ownership of the confirmed base opens the
    // reusable acquisition line. Individual evolution checks stay separate.
    unlockedEvolutionLineIds:[...new Set(ids.filter(id=>isManualBase(id)?inventory[id]?.owned:inventory[id]?.evolutionUnlocked).map(lineFor).filter((line):line is string=>Boolean(line)))],
    unlockedDigimonIds:ids.filter(id=>inventory[id]?.evolutionUnlocked),
    levelByEvolutionLine:Object.fromEntries(ids.flatMap(id=>{const line=lineFor(id),level=inventory[id]?.level;return line&&level?[ [line,level] as const ]:[]})),
    levelByDigimonId:Object.fromEntries(ids.flatMap(id=>{const level=inventory[id]?.level;return level?[ [id,level] as const ]:[]})),
    transcendedDigimonIds:ids.filter(id=>inventory[id]?.transcended),
  }
}

export const isDUnitConditionCompleted = (progress: DUnitProgress, condition: DUnitCondition) => progress[condition.id.replace(/-condition-\d+$/, '')]?.[condition.id] === true
export const toggleDUnitCondition = (progress: DUnitProgress, setId: string, conditionId: string, checked: boolean): DUnitProgress => {
  if (!validConditionIds.has(conditionId)) return progress
  const next = { ...progress, [setId]: { ...(progress[setId] ?? {}) } }
  if (checked) next[setId][conditionId] = true
  else delete next[setId][conditionId]
  if (!Object.keys(next[setId]).length) delete next[setId]
  return next
}
export const completedConditionCount = (progress: DUnitProgress) => dUnitSets.flatMap(set => set.conditions).filter(condition => isDUnitConditionCompleted(progress, condition)).length
export const setProgress = (progress: DUnitProgress, setId: string) => dUnitSets.find(set => set.id === setId)?.conditions.filter(condition => isDUnitConditionCompleted(progress, condition)).length ?? 0
export const bonusKey = (condition: DUnitCondition): DUnitBonusKey => `${condition.bonus.attribute ?? ''}|${condition.bonus.qualifier ?? ''}|${condition.bonus.unit ?? ''}`
export const aggregateDUnitBonuses = (progress: DUnitProgress) => dUnitSets.flatMap(set => set.conditions).filter(condition => isDUnitConditionCompleted(progress, condition)).reduce<Record<DUnitBonusKey, number>>((totals, condition) => {
  const key = bonusKey(condition); totals[key] = (totals[key] ?? 0) + (condition.bonus.value ?? 0); return totals
}, {})
export const labelForDUnitCondition = (condition: DUnitCondition) => [condition.bonus.attribute, condition.bonus.qualifier, condition.bonus.unit === 'percent' ? '%' : ''].filter(Boolean).join(' ').replace(' %', '')
export interface DUnitGoalRecommendation {
  setId: string
  condition: DUnitCondition
  estimatedCost: number
  costBenefit: DUnitCostBenefitClass
  reasons: DUnitRecommendationReason[]
  highDifficultyTier?: 'sss' | 'sss_plus' | 'u'
}
export interface DUnitGoalRoute {
  current: number
  target: number
  maximum: number
  totalGain: number
  totalCost: number
  costBenefit: DUnitCostBenefitClass
  costConfidence: DUnitCostConfidence
  selectionBasis: DUnitRouteSelectionBasis
  unverifiedSetIds: string[]
  unverifiedAlternativeSetIds: string[]
  alternatives: DUnitCandidateRoute[]
  candidateAlternatives: DUnitCandidateRoute[]
  setCount: number
  accessibilityCeiling: DUnitAccessibilityCeiling
  independentLineCount: number
  unknownLineCount: number
  lineDispersion: number
  highTierExposure: DUnitHighTierExposure
  costBreakdown: DUnitCostBreakdown
  highDifficulty: boolean
  recommendations: DUnitGoalRecommendation[]
}
export const calculateDUnitGoalRoute = (progress: DUnitProgress, key: DUnitBonusKey, target: number, playerState: DUnitPlayerState = {}): DUnitGoalRoute => {
  return calculateDUnitCostBenefitRoute({ sets: dUnitSets, progress, keyFor: bonusKey, completed: condition => isDUnitConditionCompleted(progress, condition), key, target, playerState })
}
