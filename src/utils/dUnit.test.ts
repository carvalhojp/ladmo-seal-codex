import { describe, expect, it } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { aggregateDUnitBonuses, bonusKey, calculateDUnitGoalRoute, completedConditionCount, dUnitPlayerStateFromInventory, hasDUnitInventoryRecord, readDUnitInventory, readDUnitProgress, setProgress, toggleDUnitCondition, updateDUnitInventory } from './dUnit'

const set = dUnitSets.find(item => item.id === 'dunit-1')!
describe('D-Unit individual condition state', () => {
  it('marks, unmarks and counts non-sequential conditions independently', () => {
    let progress = toggleDUnitCondition({}, set.id, set.conditions[0].id, true)
    progress = toggleDUnitCondition(progress, set.id, set.conditions[2].id, true)
    expect(setProgress(progress, set.id)).toBe(2)
    expect(completedConditionCount(progress)).toBe(2)
    progress = toggleDUnitCondition(progress, set.id, set.conditions[0].id, false)
    expect(setProgress(progress, set.id)).toBe(1)
  })
  it('ignores invalid storage ids and invalid JSON', () => {
    expect(readDUnitProgress({ getItem: () => '{' })).toEqual({})
    expect(readDUnitProgress({ getItem: () => JSON.stringify({ bogus: { nope: true }, [set.id]: { nope: true, [set.conditions[1].id]: true } }) })).toEqual({ [set.id]: { [set.conditions[1].id]: true } })
  })
  it('aggregates only marked bonuses without merging distinct qualifier categories', () => {
    let progress = toggleDUnitCondition({}, set.id, set.conditions[0].id, true)
    progress = toggleDUnitCondition(progress, set.id, set.conditions[3].id, true)
    const totals = aggregateDUnitBonuses(progress)
    expect(totals[bonusKey(set.conditions[0])]).toBe(30)
    expect(totals[bonusKey(set.conditions[3])]).toBe(1)
  })
  it('routes only pending conditions while treating the requested amount as an additional gain', () => {
    const key = bonusKey(set.conditions[0])
    const initial = calculateDUnitGoalRoute({}, key, 60)
    expect(initial.recommendations.every(item => item.condition.id !== set.conditions[1].id)).toBe(true)
    const progress = toggleDUnitCondition({}, set.id, set.conditions[0].id, true)
    const additional = calculateDUnitGoalRoute(progress, key, 30)
    expect(additional.current).toBe(30)
    expect(additional.target).toBe(30)
    expect(additional.totalGain).toBeGreaterThanOrEqual(30)
    expect(additional.recommendations.every(item => item.condition.id !== set.conditions[0].id)).toBe(true)
  })
  it('keeps individual inventory separate from condition completion and validates stored identities', () => {
    let inventory=updateDUnitInventory({}, 'quantumon', {owned:true,evolutionUnlocked:true,level:130,transcended:true})
    inventory=updateDUnitInventory(inventory, 'not-a-confirmed-portrait', {owned:true})
    const state=dUnitPlayerStateFromInventory(inventory)
    expect(state.ownedDigimonIds).toEqual(['quantumon'])
    expect(state.unlockedEvolutionLineIds).toEqual(['quantumon-line'])
    expect(state.levelByEvolutionLine).toEqual({'quantumon-line':130})
    expect(state.levelByDigimonId).toEqual({quantumon:130})
    expect(state.transcendedDigimonIds).toEqual(['quantumon'])
    expect(readDUnitInventory({getItem:()=>JSON.stringify({quantumon:{owned:true,level:130},bogus:{owned:true}})})).toEqual({quantumon:{owned:true,evolutionUnlocked:false,transcended:false,level:130}})
    expect(readDUnitInventory({getItem:()=>JSON.stringify({'omegamon-x-supremacy':{owned:true}})})).toEqual({'omegamon-resistance-supremacy':{owned:true,evolutionUnlocked:false,transcended:false}})
    expect(calculateDUnitGoalRoute({}, 'DE||absolute', 30, state).current).toBe(0)
  })
  it('shows only forms with a real inventory record in player status', () => {
    expect(hasDUnitInventoryRecord(undefined)).toBe(false)
    expect(hasDUnitInventoryRecord({ owned:false, evolutionUnlocked:false, level:0, transcended:false })).toBe(false)
    expect(hasDUnitInventoryRecord({ owned:true })).toBe(true)
    expect(hasDUnitInventoryRecord({ evolutionUnlocked:true })).toBe(true)
    expect(hasDUnitInventoryRecord({ level:1 })).toBe(true)
    expect(hasDUnitInventoryRecord({ transcended:true })).toBe(true)
  })
  it('derives a manually confirmed line from its owned base while preserving every form unlock independently', () => {
    const state=dUnitPlayerStateFromInventory({tentomon:{owned:true},kabuterimon:{evolutionUnlocked:true,level:85}})
    expect(state.ownedDigimonIds).toEqual(['tentomon'])
    expect(state.unlockedEvolutionLineIds).toEqual(['tentomon-line'])
    expect(state.unlockedDigimonIds).toEqual(['kabuterimon'])
    expect(state.levelByDigimonId).toEqual({kabuterimon:85})
    expect(state.transcendedDigimonIds).toEqual([])
  })
})
