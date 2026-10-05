import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { toOwnedSeals, type SealStateMap } from './sealState'
import { calculateAttributeTotals } from './dashboard'
import { levelFor, nextLevel, valueFor } from './calculations'
import { aggregateDUnitBonuses, isDUnitConditionCompleted, type DUnitProgress } from './dUnit'

export function summarizeMyTamer(sealStates: SealStateMap, progress: DUnitProgress) {
  const catalogIds = new Set(seals.map(seal => seal.id))
  const owned = toOwnedSeals(sealStates).filter(item => catalogIds.has(item.sealId))
  const ownedIds = new Set(owned.map(item => item.sealId))
  let master = 0
  const nextSeals = seals.flatMap((seal, catalogIndex) => {
    if (!ownedIds.has(seal.id)) return []
    const state = sealStates[seal.id]
    const current = levelFor(state.quantity, seal)
    if (current?.id === 'master') master++
    const next = nextLevel(state.quantity, seal)
    if (!next || state.doNotRecommend) return []
    return [{ seal, current, next, remaining: next.threshold - state.quantity,
      gain: valueFor(seal, next.id) - (current ? valueFor(seal, current.id) : 0), catalogIndex }]
  }).sort((a, b) => a.remaining - b.remaining || a.catalogIndex - b.catalogIndex).slice(0, 3)

  let completed = 0, completeSets = 0, startedSets = 0, totalConditions = 0
  const nextSets = dUnitSets.flatMap(set => {
    const pending = set.conditions.filter(condition => !isDUnitConditionCompleted(progress, condition))
    const done = set.conditions.length - pending.length
    totalConditions += set.conditions.length
    completed += done
    if (done === set.conditions.length) completeSets++
    else if (done > 0) startedSets++
    return done > 0 && pending.length === 1 ? [{ set, condition: pending[0] }] : []
  }).slice(0, 3)

  return {
    hasProgress: owned.length > 0 || completed > 0,
    seals: { owned: owned.length, total: seals.length, master, bonuses: calculateAttributeTotals(owned, seals), next: nextSeals },
    dUnit: { completed, totalConditions, completeSets, startedSets, totalSets: dUnitSets.length,
      bonuses: aggregateDUnitBonuses(progress), next: nextSets },
  }
}
