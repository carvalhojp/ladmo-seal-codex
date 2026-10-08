import { describe, expect, it } from 'vitest'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { bonusKey } from './dUnit'
import { buildProgressOptions } from './goalOptimizer'
import { progressionDUnitOptions } from './progressionPlanner'
import { goalRecommendations, resolvePlanningGoal } from './goalRecommendations'
import type { TamerGoal } from './tamerGoals'

describe('goal recommendation presentation', () => {
  it('reuses Seal options and distinguishes additional Seals from Openers', () => {
    const seal = seals.find(item => item.attribute === 'HT')!
    const state = { quantity: 50, hasSeal: true, doNotRecommend: false }
    const goal: TamerGoal = {
      id: 'seal-goal', type: 'attribute',
      metric: { system: 'seals', attribute: 'HT' },
      baseline: 0, desiredGain: 100000,
    }
    const option = goalRecommendations(goal, { [seal.id]: state }, {})
      .seals.find(item => item.seal.id === seal.id)!
    expect(option).toMatchObject(buildProgressOptions(seal, state)[0])
    expect(option.additionalSeals).toBe(150)
    expect(option.openers).toBe(3)
  })

  it('matches the exact elemental percentage key and separates other conditions', () => {
    const metric = progressionDUnitOptions('Dano habilidade')
      .find(item => item.qualifier === 'Elétrico' && item.unit === 'percent')!
    const goal: TamerGoal = {
      id: 'electric-goal', type: 'attribute',
      metric: { system: 'dunit', bonusKey: metric.key },
      baseline: 0, desiredGain: 5,
    }
    const output = goalRecommendations(goal, {}, {})
    expect(output.sets.length).toBeGreaterThan(0)
    for (const item of output.sets) {
      expect(item.matchingConditions.every(entry =>
        bonusKey(entry.condition) === metric.key,
      )).toBe(true)
      expect(item.otherConditions.every(entry =>
        bonusKey(entry.condition) !== metric.key,
      )).toBe(true)
      expect(item.matchingConditions.length + item.otherConditions.length)
        .toBe(item.set.conditions.length)
    }
  })

  it('retains a set goal when all EXP conditions are done but another condition is pending', () => {
    const set = dUnitSets.find(item =>
      item.conditions.some(condition => condition.bonus.attribute === 'EXP') &&
      item.conditions.some(condition => condition.bonus.attribute !== 'EXP'),
    )!
    const remaining = set.conditions.find(condition =>
      condition.bonus.attribute !== 'EXP',
    )!
    const progress = {
      [set.id]: Object.fromEntries(set.conditions.map(condition =>
        [condition.id, condition.id !== remaining.id],
      )),
    }
    const before = JSON.stringify(progress)
    const goal: TamerGoal = {
      id: 'set-goal', type: 'dunit-set', setId: set.id,
    }
    const output = goalRecommendations(goal, {}, progress)
    expect(output.result).toMatchObject({ complete: false, remaining: 1 })
    expect(output.sets).toHaveLength(1)
    expect(output.sets[0].matchingConditions
      .filter(item => !item.completed)
      .map(item => item.condition.id)).toEqual([remaining.id])
    expect(output.sets[0].pendingGain).toBeNull()
    expect(JSON.stringify(progress)).toBe(before)

    const complete = {
      [set.id]: Object.fromEntries(
        set.conditions.map(condition => [condition.id, true]),
      ),
    }
    expect(goalRecommendations(goal, {}, complete).sets).toEqual([])
    expect(goalRecommendations(goal, {}, complete).result?.complete).toBe(true)
  })

  it('counts only pending bonuses for an attribute goal', () => {
    const set = dUnitSets.find(item =>
      item.conditions.filter(condition =>
        condition.bonus.attribute === 'EXP',
      ).length > 1,
    )!
    const condition = set.conditions.find(item =>
      item.bonus.attribute === 'EXP',
    )!
    const progress = { [set.id]: { [condition.id]: true } }
    const goal: TamerGoal = {
      id: 'exp-goal', type: 'attribute',
      metric: { system: 'dunit', bonusKey: bonusKey(condition) },
      baseline: 0, desiredGain: 100000,
    }
    const item = goalRecommendations(goal, {}, progress).sets
      .find(item => item.set.id === set.id)!
    expect(item.started).toBe(true)
    expect(item.matchingConditions.find(entry =>
      entry.condition.id === condition.id,
    )?.completed).toBe(true)
    expect(item.pendingGain).toBe(
      item.matchingConditions.filter(entry => !entry.completed)
        .reduce((sum, entry) => sum + entry.condition.bonus.value!, 0),
    )
  })

  it('keeps unavailable metrics and missing goals unknown', () => {
    const goal: TamerGoal = {
      id: 'unknown-goal', type: 'attribute',
      metric: { system: 'dunit', bonusKey: 'Unavailable||percent' },
      baseline: 0, desiredGain: 5,
    }
    expect(goalRecommendations(goal, {}, {}).result).toBeNull()
    expect(resolvePlanningGoal('missing', { version: 1, goals: [] }))
      .toEqual({ status: 'unavailable' })
    expect(resolvePlanningGoal(undefined, { version: 1, goals: [] }))
      .toEqual({ status: 'none' })
  })
})
