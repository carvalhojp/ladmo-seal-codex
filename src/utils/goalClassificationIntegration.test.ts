import { describe, expect, it } from 'vitest'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { bonusKey } from './dUnit'
import { classifySealProgressOptions } from './sealRecommendationClassification'
import { goalRecommendations } from './goalRecommendations'
import type { TamerGoal } from './tamerGoals'
import type { DUnitSelectorCandidate } from './dUnitAlternativeSelector'
import { integrateGoalClassifications, type GoalClassificationContext } from './goalClassificationIntegration'

const empty: GoalClassificationContext = { contextKey: 'snapshot', sealStates: {}, progress: {}, inventory: {} }
const set = dUnitSets.find(set => set.id === 'dunit-34')!
const expKey = bonusKey(set.conditions[0])
const expGoal: TamerGoal = { id: 'existing-exp-goal', type: 'attribute', metric: { system: 'dunit', bonusKey: expKey }, baseline: 0, desiredGain: 300 }
const route = (position = 0): DUnitSelectorCandidate => ({ totalGain: set.conditions[position].bonus.value!, setCount: 1,
  unverifiedSetIds: [set.id], recommendations: [{ setId: set.id, condition: set.conditions[position],
    estimatedCost: 999, costBenefit: 'veryDifficult', reasons: [] }] })
const source = (candidates = [route()]) => ({ key: expKey, contextKey: 'snapshot', target: 300, candidates })

describe('read-only goal classification integration', () => {
  it('keeps multiple attributes and goal IDs independent without creating a composite goal', () => {
    const goals: TamerGoal[] = [
      { id: 'saved-ht', type: 'attribute', metric: { system: 'seals', attribute: 'HT' }, baseline: 0, desiredGain: 500 },
      { id: 'saved-ct', type: 'attribute', metric: { system: 'seals', attribute: 'CT' }, baseline: 0, desiredGain: 100 }, expGoal,
    ]
    const output = integrateGoalClassifications(goals, empty)
    expect(output.map(item => item.goalId)).toEqual(goals.map(goal => goal.id))
    expect(output[0].requiredGain).toMatchObject({ value: 500, unit: 'absolute', semanticKey: 'HT||absolute' })
    expect(output[1].requiredGain).toMatchObject({ value: 1, unit: 'percent', semanticKey: 'CT||percent' })
    expect(output[2].requiredGain).toMatchObject({ value: 300, unit: 'percent', semanticKey: expKey })
    output[0].sealAlternatives.forEach(item => expect(item.classification.attribute).toBe('HT'))
    output[1].sealAlternatives.forEach(item => expect(item.classification.attribute).toBe('CT'))
    expect(output[2].sealAlternatives).toEqual([])
  })

  it('preserves every original Seal metric, unit, source and confirmation', () => {
    const seal = seals.find(seal => seal.attribute === 'HT')!
    const context = { ...empty, sealStates: { [seal.id]: { quantity: 50, hasSeal: true, doNotRecommend: false } } }
    const goal: TamerGoal = { id: 'stable', type: 'attribute', metric: { system: 'seals', attribute: 'HT' }, baseline: 0, desiredGain: 10000 }
    const expected = classifySealProgressOptions(seals, context.sealStates, 'HT', context.contextKey)
    const output = integrateGoalClassifications([goal], context)[0]
    expect(output.sealAlternatives.map(item => item.classification)).toEqual(expected)
    expect(output.sealAlternatives.find(item => item.classification.sealId === seal.id)!.contribution.coverage).toBe('partialPotentialGain')
    const missing = output.sealAlternatives.find(item => item.classification.progressBasis === 'unregistered')!
    expect(missing.contribution).toMatchObject({ effect: 'potential', evidence: 'indeterminate', coverage: 'indeterminate', completesGoalAutomatically: false })
  })

  it('normalizes percentage goal coverage with the existing display conversion', () => {
    const seal = seals.find(seal => seal.attribute === 'CT')!
    const context = { ...empty, sealStates: { [seal.id]: { quantity: 50, hasSeal: true, doNotRecommend: false } } }
    const goal: TamerGoal = { id: 'percent', type: 'attribute', metric: { system: 'seals', attribute: 'CT' }, baseline: 0, desiredGain: 100000 }
    const result = integrateGoalClassifications([goal], context)[0]
    expect(result.requiredGain?.unit).toBe('percent')
    expect(result.requiredGain?.value).toBe(result.registeredProgress!.remaining / 100)
    expect(result.sealAlternatives.find(item => item.classification.sealId === seal.id)!.contribution.coverage).toBe('partialPotentialGain')
  })

  it('separates confirmed pending bonus from inconclusive work and current progress', () => {
    const context = { ...empty, dUnitSources: { [expGoal.id]: source() } }
    const result = integrateGoalClassifications([expGoal], context)[0]
    expect(result.registeredProgress?.current).toBe(0)
    const option = result.dUnitRoutes.alternatives[0]
    expect(option.contribution).toMatchObject({ effect: 'potential', evidence: 'confirmed', coverage: 'partialPotentialGain', completesGoalAutomatically: false })
    expect(option.classification.assessment).toBe('inconclusive')
    expect(result.dUnitRoutes.selection!.economicCost).toBe('costUnvalidated')
  })

  it('reuses baseline and excludes completed bonus from pending set contributions', () => {
    const context = { ...empty, progress: { [set.id]: { [set.conditions[0].id]: true } },
      dUnitSources: { [expGoal.id]: source([route(1)]) } }
    const goal = { ...expGoal, baseline: set.conditions[0].bonus.value! }
    const result = integrateGoalClassifications([goal], context)[0]
    expect(result.registeredProgress?.remaining).toBe(300)
    expect(result.registeredProgress).toEqual(goalRecommendations(goal, context.sealStates, context.progress).result)
    const option = result.dUnitSets.find(item => item.id === set.id)!
    expect(option.contribution.gain?.value).toBe(50)
    expect(option.recommendation.matchingConditions[0].completed).toBe(true)
    expect(result.dUnitRoutes.status).toBe('ready')
  })

  it('keeps IDs stable when the desired gain changes and never sums set-goal attributes', () => {
    const goals: TamerGoal[] = [{ id: 'existing-set', type: 'dunit-set', setId: set.id }]
    const result = integrateGoalClassifications(goals, empty)[0]
    expect(result.dUnitSets[0].contribution).toMatchObject({ gain: null, coverage: 'notApplicable' })
    expect(result.dUnitSets[0].classification.pendingConditions.value).toBe(4)
    expect(result.dUnitRoutes.status).toBe('notApplicable')
    const before = integrateGoalClassifications([expGoal], empty)[0]
    const after = integrateGoalClassifications([{ ...expGoal, desiredGain: 500 }], empty)[0]
    expect(after.goalId).toBe(before.goalId)
    expect(after.dUnitSets.map(item => item.id)).toEqual(before.dUnitSets.map(item => item.id))
  })

  it.each(['key', 'contextKey', 'target'] as const)('retains source candidates when %s does not match', field => {
    const input = { ...source(), [field]: field === 'target' ? 299 : 'incompatible' }
    const result = integrateGoalClassifications([expGoal], { ...empty, dUnitSources: { [expGoal.id]: input } } as GoalClassificationContext)[0]
    expect(result.dUnitRoutes.status).toBe('sourceMismatch')
    expect(result.dUnitRoutes.source!.candidates).toBe(input.candidates)
    expect(result.dUnitRoutes.selection).toBeNull()
  })

  it('does not mix percentage/point candidate units or count stale completed conditions', () => {
    const incompatible = route()
    incompatible.recommendations = [{ ...incompatible.recommendations[0], condition: { ...set.conditions[0], bonus: { ...set.conditions[0].bonus, unit: 'absolute' } } }]
    let result = integrateGoalClassifications([expGoal], { ...empty, dUnitSources: { [expGoal.id]: source([incompatible]) } })[0]
    expect(result.dUnitRoutes.alternatives[0].contribution.coverage).toBe('indeterminate')
    const context = { ...empty, progress: { [set.id]: { [set.conditions[0].id]: true } }, dUnitSources: { [expGoal.id]: source() } }
    result = integrateGoalClassifications([{ ...expGoal, baseline: 20 }], context)[0]
    expect(result.dUnitRoutes.alternatives[0].contribution.gain?.value).toBeNull()
  })

  it('preserves the comparison cap and every candidate, including outside-window alternatives', () => {
    const candidates = Array.from({ length: 30 }, (_, index) => ({ ...route(), recommendations: [{ ...route().recommendations[0], condition: { ...set.conditions[0], id: `fixture-${index}-condition-1` } }] }))
    const result = integrateGoalClassifications([expGoal], { ...empty, dUnitSources: { [expGoal.id]: source(candidates) } })[0]
    expect(result.dUnitRoutes.alternatives).toHaveLength(30)
    expect(result.dUnitRoutes.selection!.comparedIds).toHaveLength(24)
    expect(result.dUnitRoutes.selection!.outsideComparison).toHaveLength(6)
    expect(result.dUnitRoutes.selection!.limits.exhaustive).toBe(false)
  })

  it('does not search automatically, fabricate unknown progress or mutate goals and state', () => {
    const unknown: TamerGoal = { ...expGoal, metric: { system: 'dunit', bonusKey: 'missing|qualifier|percent' } }
    const goals = [expGoal, unknown], before = JSON.stringify([goals, empty])
    const output = integrateGoalClassifications(goals, empty)
    expect(output[0].dUnitRoutes.status).toBe('notProvided')
    expect(output[1].registeredProgress).toBeNull()
    expect(output[1].requiredGain).toMatchObject({ availability: 'unknown', value: null })
    expect(JSON.stringify([goals, empty])).toBe(before)
  })
})
