import { afterEach, describe, expect, it, vi } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { DUNIT_MAX_LINE_STATES_PER_GAIN, calculateDUnitCostBenefitRoute } from './dUnitCostBenefit'
import { bonusKey } from './dUnit'
import * as work from './dUnitWorkClassification'
import type { RecommendationMetric } from './recommendationClassification'
import { dUnitAlternativeId, selectDUnitAlternatives, type DUnitSelectorCandidate } from './dUnitAlternativeSelector'

const set = dUnitSets.find(set => set.id === 'dunit-34')!
const originalClassify = work.classifyDUnitConditionWork
const key = bonusKey(set.conditions[0])
const options = { key, contextKey: 'snapshot', progress: {}, inventory: {} }
const candidate = (id: string, gain = 20): DUnitSelectorCandidate => ({
  totalGain: gain, setCount: 1, unverifiedSetIds: [set.id], recommendations: [{
    setId: set.id, condition: { ...set.conditions[0], id }, estimatedCost: 999,
    costBenefit: 'veryDifficult', reasons: [],
  }],
})
const knownMetric = (criterion: 'remainingEffort' | 'progressReuse', value: number): RecommendationMetric => ({
  criterion, system: 'dunit', unit: 'absolute', semanticKey: criterion === 'remainingEffort' ? 'same-audited-population:remaining' : 'same-audited-population:registered',
  contextKey: 'snapshot', availability: 'known', value, confirmation: 'confirmed',
  sources: [{ kind: 'audit', reference: 'confirmed-test-fixture', confirmation: 'confirmed' }],
  explanation: 'Fixture dimension, no economic score.', limitations: [],
})
/** Controlled confirmed vectors exercise selection separately from the
 * real-data tests below. No operational audit or identity is changed. */
function mockConfirmed(values: Record<string, { remaining: number; progress: number }>) {
  vi.spyOn(work, 'classifyDUnitConditionWork').mockImplementation((setId, condition, progress, inventory, contextKey) => {
    const result = originalClassify(setId, condition, progress, inventory, contextKey)
    const metrics = Object.fromEntries(Object.entries(result.metrics).map(([name, metric]) =>
      [name, { ...metric, availability: 'notApplicable', value: null }])) as typeof result.metrics
    const value = values[condition.id] ?? { remaining: 1, progress: 1 }
    metrics.remainingOwnership = knownMetric('remainingEffort', value.remaining)
    metrics.registeredOwned = knownMetric('progressReuse', value.progress)
    return { ...result, metrics }
  })
}
afterEach(() => vi.restoreAllMocks())

describe('isolated D-Unit alternative selector', () => {
  it('keeps nondominated tradeoffs, ties and dominated candidates accessible', () => {
    mockConfirmed({ a: { remaining: 1, progress: 1 }, b: { remaining: 3, progress: 5 }, c: { remaining: 4, progress: 1 }, tie: { remaining: 1, progress: 1 } })
    const result = selectDUnitAlternatives([candidate('a'), candidate('b'), candidate('c'), candidate('tie')], options)
    expect(result.candidates).toHaveLength(4)
    expect(result.nonDominated.map(item => item.id)).toEqual(['a', 'b', 'tie'])
    expect(result.candidates.find(item => item.id === 'c')!.dominatedBy).toContain('a')
    expect(result.pairs.find(pair => pair.leftId === 'a' && pair.rightId === 'b')!.outcome).toBe('tradeoff')
    expect(result.pairs.find(pair => pair.leftId === 'a' && pair.rightId === 'tie')!.outcome).toBe('equal')
    expect(result.economicCost).toBe('costUnvalidated')
  })

  it('never uses fewer conditions as proof of dominance', () => {
    mockConfirmed({})
    const short = candidate('short'), long = candidate('long')
    long.recommendations.push({ ...candidate('extra').recommendations[0] })
    const result = selectDUnitAlternatives([short, long], options)
    expect(result.pairs[0].outcome).toBe('equal')
    expect(result.nonDominated).toHaveLength(2)
  })

  it('keeps real unknown identities and missing inventory inconclusive, not worse', () => {
    const ghost = dUnitSets.find(set => set.id === 'dunit-148')!
    const unknown = { ...candidate('unused'), recommendations: [{ ...candidate('unused').recommendations[0], setId: ghost.id, condition: ghost.conditions[0] }] }
    const real = { ...candidate('unused'), recommendations: [{ ...candidate('unused').recommendations[0], condition: set.conditions[0] }] }
    const result = selectDUnitAlternatives([unknown, real], options)
    expect(result.candidates).toHaveLength(2)
    expect(result.inconclusive).toHaveLength(2)
    expect(result.pairs[0].outcome).toBe('inconclusive')
    result.candidates.forEach(item => expect(item.dominatedBy).toEqual([]))
    expect(result.candidates[1].conditions[0].confirmedLineIds).toEqual(['tentomon-line'])
  })

  it('rejects exact qualifier and unit mismatches rather than comparing their numbers', () => {
    mockConfirmed({})
    const a = candidate('a'), b = candidate('b')
    const first = a.recommendations[0].condition
    first.bonus = { ...first.bonus, attribute: 'Dano habilidade', qualifier: 'Fogo', unit: 'percent' }
    b.recommendations[0].condition.bonus = { ...first.bonus, qualifier: 'Gelo' }
    let result = selectDUnitAlternatives([a, b], { ...options, key: bonusKey(first) })
    expect(result.pairs[0].outcome).toBe('inconclusive')
    b.recommendations[0].condition.bonus = { ...first.bonus, unit: 'absolute' }
    result = selectDUnitAlternatives([a, b], { ...options, key: bonusKey(first) })
    expect(result.pairs[0].outcome).toBe('inconclusive')
    expect(result.candidates[1].gain.value).toBeNull()
  })

  it('keeps identity and ordering independent of translated labels and recommendation order', () => {
    mockConfirmed({})
    const a = candidate('z'), b = candidate('a')
    expect(selectDUnitAlternatives([a, b], options).candidates.map(item => item.id)).toEqual(['z', 'a'])
    const combined = { ...a, recommendations: [...a.recommendations, ...b.recommendations] }
    expect(dUnitAlternativeId(combined)).toBe('a|z')
    expect(dUnitAlternativeId({ ...combined, recommendations: [...combined.recommendations].reverse() })).toBe('a|z')
    expect(selectDUnitAlternatives([a, { ...a }], options).candidates).toHaveLength(1)
  })

  it('supports explicit views without treating them as full dominance or economic ranking', () => {
    mockConfirmed({ a: { remaining: 3, progress: 1 }, b: { remaining: 1, progress: 4 } })
    const routes = [candidate('a', 50), candidate('b', 20)]
    expect(selectDUnitAlternatives(routes, { ...options, view: 'incrementalGain' }).candidates.map(item => item.id)).toEqual(['a', 'b'])
    expect(selectDUnitAlternatives(routes, { ...options, view: 'knownRemainingWork' }).candidates.map(item => item.id)).toEqual(['b', 'a'])
    expect(selectDUnitAlternatives(routes, { ...options, view: 'confirmedProgress' }).candidates.map(item => item.id)).toEqual(['b', 'a'])
    expect(selectDUnitAlternatives(routes, options).pairs[0].outcome).toBe('tradeoff')
  })

  it('retains every outside-window candidate and permits a later comparison window', () => {
    mockConfirmed({})
    const routes = Array.from({ length: 30 }, (_, index) => candidate(`route-${index}`))
    const result = selectDUnitAlternatives(routes, options)
    expect(result.candidates).toHaveLength(30)
    expect(result.comparedIds).toHaveLength(24)
    expect(result.pairs).toHaveLength(276)
    expect(result.outsideComparison).toHaveLength(6)
    expect(result.outsideComparison.every(item => !item.dominatedBy.length)).toBe(true)
    const next = selectDUnitAlternatives(routes, { ...options, comparisonIds: ['route-29', 'route-28', 'missing'] })
    expect(next.comparedIds).toEqual(['route-29', 'route-28'])
    expect(next.ignoredComparisonIds).toEqual(['missing'])
    expect(next.outsideComparison).toHaveLength(28)
  })

  it('does not reintroduce completed bonuses or hide stale candidates', () => {
    const route = { ...candidate('unused'), recommendations: [{ ...candidate('unused').recommendations[0], condition: set.conditions[0] }] }
    const result = selectDUnitAlternatives([route], { ...options, progress: { [set.id]: { [set.conditions[0].id]: true } } })
    expect(result.candidates[0].gain.value).toBeNull()
    expect(result.candidates[0].issues).toContain('gainUnavailableOrStale')
    expect(result.inconclusive).toHaveLength(1)
  })

  it('does not claim compatibility between different audited requirement populations', () => {
    mockConfirmed({})
    const spy = vi.mocked(work.classifyDUnitConditionWork), base = spy.getMockImplementation()!
    spy.mockImplementation((...args) => {
      const result = base(...args)
      if (args[1].id === 'b') result.metrics.remainingOwnership = { ...result.metrics.remainingOwnership, semanticKey: 'different-population' }
      return result
    })
    const result = selectDUnitAlternatives([candidate('a'), candidate('b')], options)
    expect(result.pairs[0].outcome).toBe('inconclusive')
    expect(result.inconclusive).toHaveLength(2)
  })

  it('retains unknown positions during view ordering', () => {
    mockConfirmed({})
    const unknown = candidate('unknown')
    unknown.recommendations[0].condition.bonus = { ...unknown.recommendations[0].condition.bonus, confirmed: false }
    const result = selectDUnitAlternatives([candidate('a', 10), unknown, candidate('b', 30)], { ...options, view: 'incrementalGain' })
    expect(result.candidates.map(item => item.id)).toEqual(['b', 'unknown', 'a'])
  })

  it('consumes only supplied engine results, preserving source limits and inputs', () => {
    const engine = calculateDUnitCostBenefitRoute({ sets: [set], progress: {}, keyFor: bonusKey, completed: () => false, key, target: 20 })
    const supplied = [engine, ...engine.alternatives, ...engine.candidateAlternatives]
    const before = JSON.stringify([supplied, options])
    const result = selectDUnitAlternatives(supplied, options)
    expect(result.candidates.map(item => item.id)).toEqual([...new Set(supplied.map(dUnitAlternativeId))])
    expect(result.limits).toMatchObject({ sourceMaxLineStatesPerGain: DUNIT_MAX_LINE_STATES_PER_GAIN, exhaustive: false, sourceSearchUnchanged: true })
    expect(JSON.stringify([supplied, options])).toBe(before)
  })
})
