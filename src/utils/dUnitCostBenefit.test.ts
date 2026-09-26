import { describe, expect, it } from 'vitest'
import { dUnitSets, type DUnitCondition, type DUnitSet } from '../data/dUnitAudit'
import { dUnitCostMetadata, type DUnitCostMetadata } from '../data/dUnitCostMetadata'
import { dUnitSetEvolutionLineProfiles, type DUnitSetEvolutionLineProfile } from '../data/dUnitEvolutionLineAudit'
import { bonusKey } from './dUnit'
import { calculateDUnitCostBenefitRoute, classifyDUnitRequirement, requirementCost, type DUnitPlayerState, type DUnitProgressLike } from './dUnitCostBenefit'

const condition = (setId: string, position: 1 | 2 | 3 | 4, requirement: string, attribute: string, value: number, unit: 'absolute' | 'percent' = 'absolute'): DUnitCondition => ({
  id: `${setId}-condition-${position}`,
  position,
  requirement,
  digimonNames: [],
  bonus: { rawLabel: `${attribute} +${value}${unit === 'percent' ? '%' : ''}`, attribute, value, unit, confirmed: true },
  confirmed: true,
  evidence: '',
})
const set = (id: string, conditions: DUnitCondition[]): DUnitSet => ({ id, name: id, nameConfirmed: true, sourceFiles: [], conditions: conditions as DUnitSet['conditions'] })
const route = (sets: DUnitSet[], key: string, target: number, metadata: readonly DUnitCostMetadata[] = [], progress: DUnitProgressLike = {}, lineProfiles: readonly DUnitSetEvolutionLineProfile[] = dUnitSetEvolutionLineProfiles, playerState: DUnitPlayerState = {}) => calculateDUnitCostBenefitRoute({
  sets, progress, key, target, metadata, keyFor: bonusKey, completed: condition => progress[condition.id.replace(/-condition-\d+$/, '')]?.[condition.id] === true,
  lineProfiles, playerState,
})
const metadata = (setId: string, tier: DUnitCostMetadata['tier']): DUnitCostMetadata => ({ setId, digimonId: `${setId}-fixture`, tier, confirmed: true, source: 'test fixture' })
const lines = (setId: string, evolutionLineIds: string[], unknownLineCount: number | null = 0, confidence: DUnitSetEvolutionLineProfile['confidence'] = 'confirmed'): DUnitSetEvolutionLineProfile => ({ setId, evolutionLineIds, unknownLineCount, confidence, note: 'test fixture' })

describe('D-Unit cost-benefit engine', () => {
  it('classifies structured requirements with monotonic level and transcendence costs', () => {
    expect(classifyDUnitRequirement('Obtido 1 Digimons')).toBe('obtained')
    expect(classifyDUnitRequirement('Obtido 1 Digimons Transcendidos')).toBe('transcendence')
    expect(requirementCost(condition('a', 1, 'Nível Total dos Digimons 260', 'AT', 20))).toBeLessThan(requirementCost(condition('a', 1, 'Nível Total dos Digimons 1260', 'AT', 20)))
    expect(requirementCost(condition('a', 1, 'Obtido 1 Digimons', 'AT', 20))).toBeLessThan(requirementCost(condition('a', 1, 'Obtido 1 Digimons Transcendidos', 'AT', 20)))
    expect(requirementCost(condition('a', 1, 'Obtido 1 Digimons Transcendidos', 'AT', 20))).toBeLessThan(requirementCost(condition('a', 1, 'Obtido 9 Digimons Transcendidos', 'AT', 20)))
  })

  it('chooses a synergistic, accessible EXP 150 route over mathematically shorter confirmed U content', () => {
    const accessible = set('tentomon-like', [
      condition('tentomon-like', 1, 'Obtido 5 Digimons', 'EXP', 50, 'percent'),
      condition('tentomon-like', 2, 'Nível Total dos Digimons 550', 'EXP', 50, 'percent'),
      condition('tentomon-like', 3, 'Obtido 5 Digimons Transcendidos', 'EXP', 50, 'percent'),
      condition('tentomon-like', 4, 'Nível Total dos Digimons 700', 'AT', 1),
    ])
    const expensive = set('rank-u', [
      condition('rank-u', 1, 'Obtido 2 Digimons', 'EXP', 100, 'percent'),
      condition('rank-u', 2, 'Nível Total dos Digimons 260', 'EXP', 100, 'percent'),
      condition('rank-u', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 1),
      condition('rank-u', 4, 'Nível Total dos Digimons 300', 'AT', 1),
    ])
    const result = route([accessible, expensive], 'EXP||percent', 150, [metadata('tentomon-like', 'basic'), metadata('rank-u', 'u')])
    expect(result.recommendations.map(item => item.setId)).toEqual(['tentomon-like', 'tentomon-like', 'tentomon-like'])
    expect(result.recommendations.some(item => item.reasons.includes('sameSetProgression'))).toBe(true)
  })

  it('recognizes the three useful Tentomon EXP conditions as one shared progression', () => {
    const tentomon = dUnitSets.find(item => item.id === 'dunit-34')!
    const result = route([tentomon], 'EXP||percent', 70)
    expect(result.recommendations.map(item => item.condition.bonus.value)).toEqual([20, 20, 30])
    expect(result.recommendations.every(item => item.reasons.includes('sameSetProgression'))).toBe(true)
  })

  it('treats the requested gain as additional even when current progress is greater than the input', () => {
    const previous = set('previous', [condition('previous', 1, 'Obtido 2 Digimons', 'DE', 500), condition('previous', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('previous', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('previous', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const pending = set('pending', [condition('pending', 1, 'Obtido 2 Digimons', 'DE', 100), condition('pending', 2, 'Nível Total dos Digimons 220', 'DE', 50), condition('pending', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('pending', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const progress = { previous: { 'previous-condition-1': true } }
    const result = route([previous, pending], 'DE||absolute', 150, [], progress)
    expect(result.current).toBe(500)
    expect(result.target).toBe(150)
    expect(result.totalGain).toBe(150)
    expect(result.recommendations.map(item => item.setId)).toEqual(['pending', 'pending'])
    expect(result.current + result.totalGain).toBe(650)
  })

  it('keeps an EXP request additional to the 40% already obtained', () => {
    const completed = set('completed-exp', [condition('completed-exp', 1, 'Obtido 1 Digimons', 'EXP', 40, 'percent'), condition('completed-exp', 2, 'Nível Total dos Digimons 110', 'AT', 1), condition('completed-exp', 3, 'Obtido 1 Digimons Transcendidos', 'AT', 1), condition('completed-exp', 4, 'Nível Total dos Digimons 140', 'AT', 1)])
    const pending = set('pending-exp', [condition('pending-exp', 1, 'Obtido 1 Digimons', 'EXP', 100, 'percent'), condition('pending-exp', 2, 'Nível Total dos Digimons 110', 'AT', 1), condition('pending-exp', 3, 'Obtido 1 Digimons Transcendidos', 'AT', 1), condition('pending-exp', 4, 'Nível Total dos Digimons 140', 'AT', 1)])
    const progress = { 'completed-exp': { 'completed-exp-condition-1': true } }
    const result = route([completed, pending], 'EXP||percent', 100, [metadata('completed-exp', 'basic'), metadata('pending-exp', 'basic')], progress)

    expect(result.current).toBe(40)
    expect(result.totalGain).toBe(100)
    expect(result.current + result.totalGain).toBe(140)
    expect(result.recommendations.map(item => item.condition.id)).toEqual(['pending-exp-condition-1'])
  })

  it('keeps the report EXP +310 route and the prior EXP +300 route as unverified candidates, not proven cost rankings', () => {
    const byId = (id: string) => dUnitSets.find(item => item.id === id)!
    const manual = ['dunit-34', 'dunit-41', 'dunit-96', 'dunit-159'].map(byId)
    const prior = ['dunit-148', 'dunit-164', 'dunit-175'].map(byId)
    const firstThreeGain = (sets: DUnitSet[]) => sets.reduce((sum, item) => sum + item.conditions.slice(0, 3).reduce((subtotal, item) => subtotal + (item.bonus.value ?? 0), 0), 0)

    expect(firstThreeGain(manual)).toBe(310)
    expect(firstThreeGain(prior)).toBe(300)
    expect(route(manual, 'EXP||percent', 300).costConfidence).toBe('low')
    expect(route(prior, 'EXP||percent', 300).costConfidence).toBe('low')
  })

  it('uses only the remaining EXP from a partially completed report-route set', () => {
    const tentomon = dUnitSets.find(item => item.id === 'dunit-34')!
    const progress = { [tentomon.id]: { [tentomon.conditions[0].id]: true } }
    const result = route([tentomon], 'EXP||percent', 300, [], progress)

    expect(result.current).toBe(20)
    expect(result.maximum).toBe(50)
    expect(result.recommendations.map(item => item.condition.id)).not.toContain(tentomon.conditions[0].id)
  })

  it('still seeks a further 300% when 200% EXP is already active elsewhere', () => {
    const completedSets = ['dunit-148', 'dunit-164'].map(id => dUnitSets.find(item => item.id === id)!)
    const progress = Object.fromEntries(completedSets.map(item => [item.id, Object.fromEntries(item.conditions.slice(0, 3).map(condition => [condition.id, true]))]))
    const result = route(dUnitSets, 'EXP||percent', 300, [], progress)

    expect(result.current).toBe(200)
    expect(result.target).toBe(300)
    expect(result.totalGain).toBeGreaterThanOrEqual(300)
    expect(result.recommendations.every(item => !progress[item.setId]?.[item.condition.id])).toBe(true)
  })

  it('keeps route diagnostics scoped to the selected subset of a partially used set', () => {
    const partial = set('partial-package', [condition('partial-package', 1, 'Obtido 1 Digimons', 'AT', 100), condition('partial-package', 2, 'Obtido 9 Digimons Transcendidos', 'AT', 100), condition('partial-package', 3, 'Nível Total dos Digimons 110', 'HP', 1), condition('partial-package', 4, 'Nível Total dos Digimons 140', 'HP', 1)])
    const result = route([partial], 'AT||absolute', 100, [metadata('partial-package', 'basic')])

    expect(result.recommendations.map(item => item.condition.id)).toEqual(['partial-package-condition-1'])
    expect(result.costBreakdown.transcendence).toBe(0)
  })

  it('does not use an unselected condition count or portrait total as access cost', () => {
    const levelOnly = set('unknown-composition', [condition('unknown-composition', 1, 'Nível Total dos Digimons 110', 'HP', 100), condition('unknown-composition', 2, 'Obtido 21 Digimons Transcendidos', 'AT', 1), condition('unknown-composition', 3, 'Nível Total dos Digimons 140', 'AT', 1), condition('unknown-composition', 4, 'Obtido 21 Digimons', 'AT', 1)])
    const result = route([levelOnly], 'HP||absolute', 100)

    expect(result.recommendations.map(item => item.condition.id)).toEqual(['unknown-composition-condition-1'])
    expect(result.costBreakdown.access).toBe(3)
    expect(result.costConfidence).toBe('low')
  })

  it('compares whole routes: several smaller conditions win when their marginal total is lower', () => {
    const large = set('large', [condition('large', 1, 'Nível Total dos Digimons 2960', 'EXP', 100, 'percent'), condition('large', 2, 'Obtido 2 Digimons', 'AT', 1), condition('large', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 1), condition('large', 4, 'Nível Total dos Digimons 280', 'AT', 1)])
    const shared = set('shared', [condition('shared', 1, 'Obtido 1 Digimons', 'EXP', 20, 'percent'), condition('shared', 2, 'Nível Total dos Digimons 110', 'EXP', 20, 'percent'), condition('shared', 3, 'Obtido 1 Digimons Transcendidos', 'EXP', 30, 'percent'), condition('shared', 4, 'Nível Total dos Digimons 140', 'AT', 1)])
    const extra = set('extra', [condition('extra', 1, 'Obtido 1 Digimons', 'EXP', 30, 'percent'), condition('extra', 2, 'Nível Total dos Digimons 110', 'AT', 1), condition('extra', 3, 'Obtido 1 Digimons Transcendidos', 'AT', 1), condition('extra', 4, 'Nível Total dos Digimons 140', 'AT', 1)])
    const result = route([large, shared, extra], 'EXP||percent', 100, [metadata('large', 'advanced'), metadata('shared', 'basic'), metadata('extra', 'basic')])
    expect(result.recommendations.map(item => item.setId)).toEqual(['extra', 'shared', 'shared', 'shared'])
    expect(result.recommendations).toHaveLength(4)
  })

  it('still lets one genuinely cheap large condition beat a more expensive combination', () => {
    const cheapLarge = set('cheap-large', [condition('cheap-large', 1, 'Obtido 1 Digimons', 'EXP', 100, 'percent'), condition('cheap-large', 2, 'Nível Total dos Digimons 110', 'AT', 1), condition('cheap-large', 3, 'Obtido 1 Digimons Transcendidos', 'AT', 1), condition('cheap-large', 4, 'Nível Total dos Digimons 140', 'AT', 1)])
    const costlySmall = set('costly-small', [condition('costly-small', 1, 'Obtido 8 Digimons Transcendidos', 'EXP', 20, 'percent'), condition('costly-small', 2, 'Nível Total dos Digimons 1260', 'EXP', 20, 'percent'), condition('costly-small', 3, 'Obtido 8 Digimons Transcendidos', 'EXP', 30, 'percent'), condition('costly-small', 4, 'Nível Total dos Digimons 1400', 'AT', 1)])
    const extra = set('costly-extra', [condition('costly-extra', 1, 'Obtido 8 Digimons Transcendidos', 'EXP', 30, 'percent'), condition('costly-extra', 2, 'Nível Total dos Digimons 110', 'AT', 1), condition('costly-extra', 3, 'Obtido 1 Digimons Transcendidos', 'AT', 1), condition('costly-extra', 4, 'Nível Total dos Digimons 140', 'AT', 1)])
    const result = route([cheapLarge, costlySmall, extra], 'EXP||percent', 100, [metadata('cheap-large', 'basic'), metadata('costly-small', 'advanced'), metadata('costly-extra', 'advanced')])
    expect(result.recommendations.map(item => item.setId)).toEqual(['cheap-large'])
  })

  it('reports insufficiency from pending bonuses only, never from already active progress', () => {
    const active = set('active', [condition('active', 1, 'Obtido 2 Digimons', 'DE', 500), condition('active', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('active', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('active', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const pending = set('short', [condition('short', 1, 'Obtido 2 Digimons', 'DE', 200), condition('short', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('short', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('short', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const result = route([active, pending], 'DE||absolute', 300, [], { active: { 'active-condition-1': true } })
    expect(result.current).toBe(500)
    expect(result.maximum).toBe(200)
    expect(result.maximum).toBeLessThan(result.target)
  })

  it('penalizes U, while still using U when it is the only viable option', () => {
    const basic = set('basic', [condition('basic', 1, 'Obtido 2 Digimons', 'AT', 100), condition('basic', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('basic', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('basic', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const rankU = set('u', [condition('u', 1, 'Obtido 2 Digimons', 'AT', 100), condition('u', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('u', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('u', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    expect(route([basic, rankU], 'AT||absolute', 100, [metadata('basic', 'basic'), metadata('u', 'u')]).recommendations.map(item => item.setId)).toEqual(['basic'])
    const onlyU = route([rankU], 'AT||absolute', 100, [metadata('u', 'u')])
    expect(onlyU.recommendations.map(item => item.setId)).toEqual(['u'])
    expect(onlyU.highDifficulty).toBe(true)
  })

  it('orders equal benefit tiers SSS before SSS+ before U', () => {
    const sss = set('sss', [condition('sss', 1, 'Obtido 2 Digimons', 'HP', 100), condition('sss', 2, 'Nível Total dos Digimons 220', 'AT', 1), condition('sss', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 1), condition('sss', 4, 'Nível Total dos Digimons 280', 'AT', 1)])
    const sssPlus = set('sss-plus', [condition('sss-plus', 1, 'Obtido 2 Digimons', 'HP', 100), condition('sss-plus', 2, 'Nível Total dos Digimons 220', 'AT', 1), condition('sss-plus', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 1), condition('sss-plus', 4, 'Nível Total dos Digimons 280', 'AT', 1)])
    const rankU = set('u', [condition('u', 1, 'Obtido 2 Digimons', 'HP', 100), condition('u', 2, 'Nível Total dos Digimons 220', 'AT', 1), condition('u', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 1), condition('u', 4, 'Nível Total dos Digimons 280', 'AT', 1)])
    const data = [metadata('sss', 'sss'), metadata('sss-plus', 'sss_plus'), metadata('u', 'u')]
    expect(route([sss, sssPlus, rankU], 'HP||absolute', 100, data).recommendations[0]?.setId).toBe('sss')
  })

  it('uses existing progress without allowing it to beat an absurdly expensive U step', () => {
    const started = set('started-u', [condition('started-u', 1, 'Obtido 2 Digimons', 'HP', 1), condition('started-u', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('started-u', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('started-u', 4, 'Nível Total dos Digimons 280', 'AT', 100)])
    const fresh = set('fresh-basic', [condition('fresh-basic', 1, 'Obtido 2 Digimons', 'AT', 100), condition('fresh-basic', 2, 'Nível Total dos Digimons 220', 'HP', 1), condition('fresh-basic', 3, 'Obtido 2 Digimons Transcendidos', 'HP', 1), condition('fresh-basic', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const progress = { 'started-u': { 'started-u-condition-1': true, 'started-u-condition-2': true } }
    const result = route([started, fresh], 'AT||absolute', 100, [metadata('started-u', 'u'), metadata('fresh-basic', 'basic')], progress)
    expect(result.recommendations.map(item => item.setId)).toEqual(['fresh-basic'])
    const startedBasic = route([started], 'AT||absolute', 100, [metadata('started-u', 'basic')], progress)
    expect(startedBasic.recommendations[0]?.reasons).toContain('existingProgress')
  })

  it('uses the same engine for absolute and other percentage attributes, and is deterministic', () => {
    const first = set('first', [condition('first', 1, 'Obtido 2 Digimons', 'CT', 20, 'percent'), condition('first', 2, 'Nível Total dos Digimons 220', 'AT', 40), condition('first', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 40), condition('first', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const second = set('second', [condition('second', 1, 'Obtido 2 Digimons', 'CT', 20, 'percent'), condition('second', 2, 'Nível Total dos Digimons 220', 'AT', 40), condition('second', 3, 'Obtido 2 Digimons Transcendidos', 'AT', 40), condition('second', 4, 'Nível Total dos Digimons 280', 'HP', 1)])
    const sets = [first, second]
    expect(route(sets, 'AT||absolute', 40).recommendations).toHaveLength(1)
    expect(route(sets, 'CT||percent', 20).recommendations).toHaveLength(1)
    const one = route(sets, 'AT||absolute', 80)
    const two = route(sets, 'AT||absolute', 80)
    expect(one.recommendations.map(item => item.condition.id)).toEqual(two.recommendations.map(item => item.condition.id))
    expect(one.totalCost).toBe(two.totalCost)
  })

  it('uses overkill only when its relative cost-benefit is better', () => {
    const exact = set('exact', [condition('exact', 1, 'Obtido 12 Digimons Transcendidos', 'EXP', 20, 'percent'), condition('exact', 2, 'Nível Total dos Digimons 220', 'AT', 1), condition('exact', 3, 'Obtido 2 Digimons', 'AT', 1), condition('exact', 4, 'Nível Total dos Digimons 280', 'AT', 1)])
    const overkill = set('overkill', [condition('overkill', 1, 'Obtido 1 Digimons', 'EXP', 100, 'percent'), condition('overkill', 2, 'Nível Total dos Digimons 220', 'AT', 1), condition('overkill', 3, 'Obtido 2 Digimons', 'AT', 1), condition('overkill', 4, 'Nível Total dos Digimons 280', 'AT', 1)])
    expect(route([exact, overkill], 'EXP||percent', 20, [metadata('exact', 'advanced'), metadata('overkill', 'basic')]).recommendations[0]?.setId).toBe('overkill')
  })

  it('charges shared access once and makes level and transcendence marginal stages', () => {
    const shared = set('shared-path', [condition('shared-path', 1, 'Obtido 5 Digimons', 'EXP', 20, 'percent'), condition('shared-path', 2, 'Nível Total dos Digimons 500', 'EXP', 20, 'percent'), condition('shared-path', 3, 'Obtido 5 Digimons Transcendidos', 'EXP', 30, 'percent')])
    const separate = [
      set('separate-obtain', [condition('separate-obtain', 1, 'Obtido 5 Digimons', 'EXP', 20, 'percent')]),
      set('separate-level', [condition('separate-level', 1, 'Nível Total dos Digimons 500', 'EXP', 20, 'percent'), condition('separate-level', 2, 'Obtido 5 Digimons', 'HP', 1)]),
      set('separate-transcend', [condition('separate-transcend', 1, 'Obtido 5 Digimons Transcendidos', 'EXP', 30, 'percent')]),
    ]
    const sharedRoute = route([shared], 'EXP||percent', 70, [metadata('shared-path', 'basic')])
    const separateRoute = route(separate, 'EXP||percent', 70, separate.map(item => metadata(item.id, 'basic')))
    expect(sharedRoute.totalGain).toBe(70)
    expect(sharedRoute.totalCost).toBeLessThan(separateRoute.totalCost)
    expect(route([shared], 'EXP||percent', 20, [metadata('shared-path', 'basic')], { 'shared-path': { 'shared-path-condition-1': true } }).totalCost).toBeLessThan(route([shared], 'EXP||percent', 20, [metadata('shared-path', 'basic')]).totalCost)
    const levelOnly = set('level-only', [condition('level-only', 1, 'Nível Total dos Digimons 500', 'EXP', 20, 'percent'), condition('level-only', 2, 'Obtido 5 Digimons', 'HP', 1)])
    const transOnly = set('trans-only', [condition('trans-only', 1, 'Obtido 5 Digimons Transcendidos', 'EXP', 30, 'percent')])
    expect(route([transOnly], 'EXP||percent', 30, [metadata('trans-only', 'basic')]).totalCost).toBeGreaterThan(route([levelOnly], 'EXP||percent', 20, [metadata('level-only', 'basic')]).totalCost)
  })

  it('keeps unknown access conservative without making a direct unknown bonus automatically win', () => {
    const unknownLarge = set('unknown-large', [condition('unknown-large', 1, 'Nível Total dos Digimons 260', 'EXP', 100, 'percent')])
    const progressive = set('progressive-basic', [condition('progressive-basic', 1, 'Obtido 1 Digimons', 'EXP', 20, 'percent'), condition('progressive-basic', 2, 'Nível Total dos Digimons 100', 'EXP', 20, 'percent'), condition('progressive-basic', 3, 'Obtido 1 Digimons Transcendidos', 'EXP', 30, 'percent')])
    const complement = set('basic-complement', [condition('basic-complement', 1, 'Obtido 1 Digimons', 'EXP', 30, 'percent')])
    const unknownOnly = route([unknownLarge], 'EXP||percent', 100)
    const result = route([unknownLarge, progressive, complement], 'EXP||percent', 100, [metadata('progressive-basic', 'basic'), metadata('basic-complement', 'basic')])
    expect(unknownOnly.costConfidence).toBe('low')
    expect(unknownOnly.costBenefit).not.toBe('veryAccessible')
    expect(result.recommendations.map(item => item.setId)).toEqual(['basic-complement', 'progressive-basic', 'progressive-basic', 'progressive-basic'])
  })

  it('keeps a confirmed U rank visible without claiming its obtainment cost is validated', () => {
    const reunion = dUnitSets.find(item => item.id === 'dunit-273')!
    const tentomon = dUnitSets.find(item => item.id === 'dunit-34')!
    const reunionRoute = route([reunion], 'EXP||percent', 100, dUnitCostMetadata)
    const tentomonRoute = route([tentomon], 'EXP||percent', 20, dUnitCostMetadata)
    expect(reunionRoute.highDifficulty).toBe(true)
    expect(reunionRoute.costConfidence).toBe('low')
    expect(reunionRoute.selectionBasis).toBe('confirmedRequirementsOnly')
    expect(tentomonRoute.highDifficulty).toBe(false)
    expect(tentomonRoute.costConfidence).toBe('low')
  })

  it('preserves unknown tier treatment for the other direct validation routes', () => {
    const ghostGame = dUnitSets.find(item => item.id === 'dunit-148')!
    const angels = dUnitSets.find(item => item.id === 'dunit-220')!
    const eosmon = dUnitSets.find(item => item.id === 'dunit-247')!
    expect(route([ghostGame], 'EXP||percent', 50, dUnitCostMetadata).costConfidence).toBe('low')
    expect(route([angels], 'DE||absolute', 150, dUnitCostMetadata).costConfidence).toBe('low')
    expect(route([eosmon], 'AT||absolute', 100, dUnitCostMetadata).costConfidence).toBe('low')
  })

  it('prefers one confirmed basic evolution line over three independent basic lines', () => {
    const oneLine = set('one-line', [condition('one-line', 1, 'Obtido 1 Digimons', 'DE', 100)])
    const threeLines = [
      set('three-a', [condition('three-a', 1, 'Obtido 1 Digimons', 'DE', 40)]),
      set('three-b', [condition('three-b', 1, 'Obtido 1 Digimons', 'DE', 30)]),
      set('three-c', [condition('three-c', 1, 'Obtido 1 Digimons', 'DE', 30)]),
    ]
    const profiles = [lines('one-line', ['basic-line']), ...threeLines.map((item, index) => lines(item.id, [`basic-${index}`]))]
    const result = route([oneLine, ...threeLines], 'DE||absolute', 100, [metadata('one-line', 'basic'), ...threeLines.map(item => metadata(item.id, 'basic'))], {}, profiles)
    expect(result.recommendations.map(item => item.setId)).toEqual(['one-line'])
    expect(result.independentLineCount).toBe(1)
  })

  it('can prefer three basic lines over a single confirmed U line', () => {
    const uLine = set('u-line', [condition('u-line', 1, 'Obtido 1 Digimons', 'AT', 100)])
    const basics = [
      set('basic-a', [condition('basic-a', 1, 'Obtido 1 Digimons', 'AT', 40)]),
      set('basic-b', [condition('basic-b', 1, 'Obtido 1 Digimons', 'AT', 30)]),
      set('basic-c', [condition('basic-c', 1, 'Obtido 1 Digimons', 'AT', 30)]),
    ]
    const profiles = [lines('u-line', ['u-line']), ...basics.map((item, index) => lines(item.id, [`basic-${index}`]))]
    const result = route([uLine, ...basics], 'AT||absolute', 100, [metadata('u-line', 'u'), ...basics.map(item => metadata(item.id, 'basic'))], {}, profiles)
    expect(result.recommendations.map(item => item.setId)).toEqual(['basic-a', 'basic-b', 'basic-c'])
    expect(result.independentLineCount).toBe(3)
  })

  it('charges a shared confirmed line once across sets and reports unresolved lines conservatively', () => {
    const first = set('shared-first', [condition('shared-first', 1, 'Obtido 1 Digimons', 'EXP', 50, 'percent')])
    const second = set('shared-second', [condition('shared-second', 1, 'Obtido 1 Digimons', 'EXP', 50, 'percent')])
    const ranks = [metadata('shared-first', 'basic'), metadata('shared-second', 'basic')]
    const shared = route([first, second], 'EXP||percent', 100, ranks, {}, [lines('shared-first', ['same-line']), lines('shared-second', ['same-line'])])
    const separate = route([first, second], 'EXP||percent', 100, ranks, {}, [lines('shared-first', ['first-line']), lines('shared-second', ['second-line'])])
    const unresolved = route([first], 'EXP||percent', 50, ranks, {}, [lines('shared-first', [], null, 'probable')])
    expect(shared.totalCost).toBeLessThan(separate.totalCost)
    expect(shared.independentLineCount).toBe(1)
    expect(shared.costBreakdown.lineAccess).toBeLessThan(separate.costBreakdown.lineAccess)
    expect(unresolved.costConfidence).toBe('low')
    expect(unresolved.unknownLineCount).toBe(1)
  })

  it('keeps line-aware planning generic for DE, percentage attributes and semantic families', () => {
    const de = set('de', [condition('de', 1, 'Obtido 1 Digimons', 'DE', 150)])
    const crit = set('crit', [condition('crit', 1, 'Obtido 1 Digimons', 'Dano habilidade', 10, 'percent')])
    crit.conditions[0]!.bonus.qualifier = 'Escuridão'
    const profiles = [lines('de', ['de-line']), lines('crit', ['crit-line'])]
    expect(route([de], 'DE||absolute', 150, [metadata('de', 'basic')], {}, profiles).recommendations).toHaveLength(1)
    expect(route([crit], 'Dano habilidade|Escuridão|percent', 10, [metadata('crit', 'basic')], {}, profiles).recommendations).toHaveLength(1)
  })

  it.each([
    ['AT||absolute', 'AT', undefined, 'absolute' as const],
    ['HP||absolute', 'HP', undefined, 'absolute' as const],
    ['EXP||percent', 'EXP', undefined, 'percent' as const],
    ['Dano habilidade|Escuridão|percent', 'Dano habilidade', 'Escuridão', 'percent' as const],
    ['Ataque habilidade|Vaccine|percent', 'Ataque habilidade', 'Vaccine', 'percent' as const],
  ])('applies the same accessible-over-U policy to %s', (key, attribute, qualifier, unit) => {
    const basics=['a','b','c','d'].map((id,index)=>{const item=set(`basic-${attribute}-${id}`,[condition(`basic-${attribute}-${id}`,1,'Obtido 1 Digimons',attribute,25,unit)]);item.conditions[0]!.bonus.qualifier=qualifier;return item})
    const u=set(`u-${attribute}`,[condition(`u-${attribute}`,1,'Obtido 1 Digimons',attribute,100,unit)]);u.conditions[0]!.bonus.qualifier=qualifier
    const all=[...basics,u], profiles=all.map((item,index)=>lines(item.id,[`line-${attribute}-${index}`]))
    const result=route(all,key,100,[...basics.map(item=>metadata(item.id,'basic')),metadata(u.id,'u')],{},profiles)
    expect(result.recommendations.map(item=>item.setId)).not.toContain(u.id)
    expect(result.highTierExposure.u).toBe(0)
  })

  it('orders equal high-tier routes as SSS, then SSS+, then U', () => {
    const tiers=['sss','sss_plus','u'] as const
    const sets=tiers.map(tier=>set(tier,[condition(tier,1,'Obtido 1 Digimons','DE',100)]))
    const result=route(sets,'DE||absolute',100,tiers.map(tier=>metadata(tier,tier)),{},sets.map(item=>lines(item.id,[`${item.id}-line`])))
    expect(result.recommendations[0]?.setId).toBe('sss')
    expect(result.highTierExposure.worstTier).toBe('sss')
  })

  it('uses U only when accessible content is insufficient, never as an early shortcut', () => {
    const basics=['a','b','c','d'].map((id,index)=>set(`needed-${id}`,[condition(`needed-${id}`,1,'Obtido 1 Digimons','AT',100)]))
    const u=set('needed-u',[condition('needed-u',1,'Obtido 1 Digimons','AT',100)])
    const all=[...basics,u], ranks=[...basics.map(item=>metadata(item.id,'basic')),metadata(u.id,'u')], profiles=all.map((item,index)=>lines(item.id,[`needed-line-${index}`]))
    const necessary=route(all,'AT||absolute',500,ranks,{},profiles)
    expect(necessary.recommendations.map(item=>item.setId)).toContain('needed-u')
    expect(necessary.recommendations).toHaveLength(5)
    const extremeBasics=['a','b','c','d'].map(id=>set(`extreme-${id}`,[condition(`extreme-${id}`,1,'Obtido 80 Digimons Transcendidos','CT',25)]))
    const extremeU=set('extreme-u',[condition('extreme-u',1,'Obtido 1 Digimons','CT',100)])
    const extreme=[...extremeBasics,extremeU]
    const result=route(extreme,'CT||absolute',100,[...extremeBasics.map(item=>metadata(item.id,'basic')),metadata('extreme-u','u')],{},extreme.map((item,index)=>lines(item.id,[`extreme-${index}`])))
    expect(result.recommendations.map(item=>item.setId)).toEqual(extremeBasics.map(item=>item.id))
  })

  it('keeps a single genuinely accessible large bonus ahead of a more expensive small-bonus route', () => {
    const large=set('accessible-large',[condition('accessible-large',1,'Obtido 1 Digimons','SCD',100,'percent')])
    const small=['a','b','c','d'].map(id=>set(`costly-small-${id}`,[condition(`costly-small-${id}`,1,'Obtido 20 Digimons Transcendidos','SCD',25,'percent')]))
    const all=[large,...small], result=route(all,'SCD||percent',100,all.map(item=>metadata(item.id,'basic')),{},all.map((item,index)=>lines(item.id,[`scd-${index}`])))
    expect(result.recommendations.map(item=>item.setId)).toEqual(['accessible-large'])
  })

  it('selects the smallest accessibility ceiling before optimizing inside it', () => {
    const accessible=['a','b','c'].map((id,index)=>set(`ceiling-${id}`,[condition(`ceiling-${id}`,1,'Obtido 1 Digimons','AT',[30,30,40][index]!)]))
    const advanced=set('ceiling-advanced',[condition('ceiling-advanced',1,'Obtido 20 Digimons Transcendidos','AT',100)])
    const all=[...accessible,advanced], ranks=[...accessible.map(item=>metadata(item.id,'basic')),metadata(advanced.id,'advanced')]
    const result=route(all,'AT||absolute',100,ranks,{},all.map((item,index)=>lines(item.id,[`ceiling-line-${index}`])))
    expect(result.accessibilityCeiling).toBe('normal')
    expect(result.recommendations.map(item=>item.setId)).toEqual(accessible.map(item=>item.id))
  })

  it('keeps unknown out of the accessible ceiling but allows it when necessary', () => {
    const accessible=set('known-basic',[condition('known-basic',1,'Obtido 1 Digimons','HP',100)])
    const unknown=set('unknown-route',[condition('unknown-route',1,'Obtido 1 Digimons','HP',100)])
    const profiles=[lines(accessible.id,['known-line']),lines(unknown.id,[],null,'unknown')]
    const knownResult=route([accessible,unknown],'HP||absolute',100,[metadata(accessible.id,'basic')],{},profiles)
    expect(knownResult.recommendations.map(item=>item.setId)).toEqual(['known-basic'])
    expect(knownResult.unverifiedAlternativeSetIds).toEqual(['unknown-route'])
    expect(knownResult.accessibilityCeiling).toBe('normal')
    const unknownOnly=route([unknown],'HP||absolute',100,[],{},profiles)
    expect(unknownOnly.accessibilityCeiling).toBe('normal')
    expect(unknownOnly.costConfidence).toBe('low')
  })

  it('uses the same additional-goal and pending-only rules for AT, DE, HP and EXP', () => {
    const targets: Array<[string, number]> = [['AT||absolute', 100], ['DE||absolute', 100], ['HP||absolute', 100], ['EXP||percent', 20]]
    for (const [key, target] of targets) {
      const matching = dUnitSets.flatMap(item => item.conditions.map(condition => ({ set: item, condition }))).filter(item => bonusKey(item.condition) === key)
      const first = matching[0]!
      const progress = { [first.set.id]: { [first.condition.id]: true } }
      const result = route(dUnitSets, key, target, [], progress)
      expect(result.current).toBe(first.condition.bonus.value)
      expect(result.target).toBe(target)
      expect(result.recommendations.every(item => !progress[item.setId]?.[item.condition.id])).toBe(true)
      expect(result.totalGain).toBeGreaterThanOrEqual(target)
    }
  })

  it('reduces verified incremental work from owned forms, unlocked lines, levels and transcendence', () => {
    const owned = set('account-aware', [
      condition('account-aware', 1, 'Obtido 1 Digimons', 'AT', 20),
      condition('account-aware', 2, 'Nível Total dos Digimons 300', 'AT', 30),
      condition('account-aware', 3, 'Obtido 1 Digimons Transcendidos', 'AT', 50),
    ])
    const data = [metadata('account-aware', 'basic')]
    const profile = [lines('account-aware', ['account-line'])]
    const fresh = route([owned], 'AT||absolute', 100, data, {}, profile)
    const playerState: DUnitPlayerState = {
      ownedDigimonIds: ['account-aware-fixture'], unlockedEvolutionLineIds: ['account-line'],
      levelByEvolutionLine: { 'account-line': 300 }, transcendedDigimonIds: ['account-aware-fixture'],
    }
    const progressed = route([owned], 'AT||absolute', 100, data, {}, profile, playerState)
    expect(progressed.totalGain).toBe(100)
    expect(progressed.totalCost).toBeLessThan(fresh.totalCost)
    expect(progressed.selectionBasis).toBe('validatedIncrementalCost')
  })

  it('does not rank the report EXP routes by invented obtainment cost', () => {
    const byId = (id: string) => dUnitSets.find(item => item.id === id)!
    const prior = route(['dunit-148', 'dunit-164', 'dunit-175'].map(byId), 'EXP||percent', 300)
    const alternative = route(['dunit-34', 'dunit-41', 'dunit-96', 'dunit-159'].map(byId), 'EXP||percent', 300)
    expect(prior.totalGain).toBe(300)
    expect(alternative.totalGain).toBe(310)
    expect(prior.selectionBasis).toBe('confirmedRequirementsOnly')
    expect(alternative.selectionBasis).toBe('confirmedRequirementsOnly')
    expect(prior.unverifiedSetIds).toHaveLength(3)
    expect(alternative.unverifiedSetIds).toHaveLength(4)
  })

  it('preserves lower-ceiling gains when SSS is the first layer that completes the target', () => {
    const basics=['a','b','c','d'].map(id=>set(`layer-${id}`,[condition(`layer-${id}`,1,'Obtido 1 Digimons','DE',100)]))
    const sss=set('layer-sss',[condition('layer-sss',1,'Obtido 1 Digimons','DE',100)])
    const sssPlus=set('layer-plus',[condition('layer-plus',1,'Obtido 1 Digimons','DE',500)])
    const all=[...basics,sss,sssPlus], ranks=[...basics.map(item=>metadata(item.id,'basic')),metadata(sss.id,'sss'),metadata(sssPlus.id,'sss_plus')]
    const result=route(all,'DE||absolute',500,ranks,{},all.map((item,index)=>lines(item.id,[`layer-line-${index}`])))
    expect(result.accessibilityCeiling).toBe('sss')
    expect(result.recommendations.map(item=>item.setId)).toEqual([...basics.map(item=>item.id),'layer-sss'])
  })

})
