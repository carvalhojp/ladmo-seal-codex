import { describe, expect, it } from 'vitest'
import type { Seal } from '../types'
import { buildProgressOptions } from './goalOptimizer'
import { compareRecommendationMetrics } from './recommendationClassification'
import { classifySealProgressOptions, compareClassifiedSealOptions, nonDominatedSealOptions } from './sealRecommendationClassification'
import type { SealStateMap } from './sealState'

const seal: Seal = { id: 'test-seal', name: 'Example', attribute: 'HT', masterValue: 100, ticketCost: 10, sealsReceived: 10, maxSeals: 3000 }
const state = (quantity: number, hasSeal = true) => ({ quantity, hasSeal, doNotRecommend: false })
const classify = (catalog: Seal[] = [seal], states: SealStateMap = { [seal.id]: state(50) }, attribute = seal.attribute) =>
  classifySealProgressOptions(catalog, states, attribute, 'snapshot')

describe('Seal classification engine', () => {
  it('reuses all future stages and incremental calculations for partial progress', () => {
    const original = buildProgressOptions(seal, state(50)), output = classify()
    expect(output).toHaveLength(4)
    expect(output.map(item => item.level)).toEqual(original.map(item => item.level))
    output.forEach((item, index) => {
      const option = original[index]
      expect(item.metrics.tickets.value).toBe(option.tickets)
      expect(item.metrics.openers.value).toBe(option.openers)
      expect(item.metrics.additionalSeals.value).toBe(option.additionalSeals)
      expect(item.metrics.incrementalGain.value).toBe(option.bonusGain)
      expect(item.metrics.progressReuse.value).toBe(50)
    })
    expect(output[0].metrics.additionalSeals.value).toBe(150)
    expect(output[0].metrics.openers.value).toBe(3)
  })

  it.each([
    ['Lucemon', 'CT'], ['Reppamon', 'EV'], ['Labramon', 'DE'],
  ] as const)('preserves the %s exception and percentage units', (name, attribute) => {
    const exception = { ...seal, name, attribute }
    const output = classify([exception], { [seal.id]: state(30) }, attribute)
    expect(output.map(item => item.finalQuantity)).toEqual([150, 300, 500, 700])
    expect(output[0].metrics.additionalSeals.value).toBe(120)
    expect(output[0].metrics.incrementalGain.unit).toBe(attribute === 'DE' ? 'absolute' : 'percent')
    expect(output[0].metrics.incrementalGain.value).toBe(attribute === 'DE' ? 20 : 0.2)
  })

  it('preserves explicit progression overrides and omits completed or excluded Seals', () => {
    const custom = { ...seal, progression: { normal: 1, bronze: 2, silver: 3, gold: 4, platinum: 5, master: 6 } }
    expect(classify([custom], { [seal.id]: state(5) })[0].finalQuantity).toBe(6)
    expect(classify([seal], { [seal.id]: state(3000) })).toEqual([])
    expect(classify([seal], { [seal.id]: { ...state(50), doNotRecommend: true } })).toEqual([])
  })

  it('distinguishes ownership at zero from missing progress without inventing a bonus', () => {
    const registered = classify([seal], { [seal.id]: state(0) })[0]
    expect(registered.owned).toBe(true)
    expect(registered.currentQuantity).toBe(0)
    expect(registered.metrics.progressReuse).toMatchObject({ availability: 'known', value: 0 })
    const absent = classify([seal], {})[0]
    expect(absent.owned).toBeNull()
    expect(absent.currentQuantity).toBeNull()
    Object.values(absent.metrics).forEach(metric => expect(metric).toMatchObject({ availability: 'notRecorded', value: null }))
    expect(compareClassifiedSealOptions(registered, absent)).toBe('inconclusive')
    expect(nonDominatedSealOptions([registered, absent])).toHaveLength(2)
    expect(classify([seal], { [seal.id]: state(0, false) })[0].owned).toBe(false)
  })

  it('keeps invalid exchange cost unknown while retaining other calculable requirements', () => {
    const output = classify([{ ...seal, sealsReceived: 0 }])[0]
    expect(output.metrics.tickets).toMatchObject({ availability: 'costUnvalidated', value: null })
    expect(output.metrics.openers).toMatchObject({ availability: 'known', value: 3 })
    expect(compareClassifiedSealOptions(output, classify()[0])).toBe('inconclusive')
    expect(classify([{ ...seal, ticketCost: 0 }])[0].metrics.tickets).toMatchObject({ availability: 'known', value: 0 })
    expect(classify([seal], { [seal.id]: state(NaN) })[0].metrics.progressReuse).toMatchObject({ availability: 'unknown', value: null })
  })

  it('preserves ties and resource-versus-gain tradeoffs without a universal score', () => {
    const stages = classify()
    expect(compareClassifiedSealOptions(stages[0], stages[1])).toBe('tradeoff')
    expect(nonDominatedSealOptions(stages)).toHaveLength(stages.length)
    expect(compareClassifiedSealOptions(stages[0], stages[0])).toBe('equal')
    expect(nonDominatedSealOptions([stages[0], { ...stages[0], sealId: 'tie' }])).toHaveLength(2)
  })

  it('removes only genuinely dominated options among those supplied', () => {
    const expensive = { ...seal, id: 'expensive', ticketCost: 20 }
    const options = classify([seal, expensive], { [seal.id]: state(50), expensive: state(50) })
    const first = options.filter(option => option.level === 'silver')
    expect(compareClassifiedSealOptions(first[0], first[1])).toBe('dominates')
    expect(compareClassifiedSealOptions(first[1], first[0])).toBe('dominated')
    expect(nonDominatedSealOptions(first)).toEqual([first[0]])
  })

  it('rejects incompatible resources, attributes and snapshots', () => {
    const option = classify()[0]
    expect(compareRecommendationMetrics(option.metrics.tickets, option.metrics.openers).outcome).toBe('inconclusive')
    const hp = { ...seal, attribute: 'HP' as const }
    expect(compareClassifiedSealOptions(option, classify([hp], { [seal.id]: state(50) }, 'HP')[0])).toBe('inconclusive')
    const other = classifySealProgressOptions([seal], { [seal.id]: state(50) }, 'HT', 'other-snapshot')[0]
    expect(compareClassifiedSealOptions(option, other)).toBe('inconclusive')
  })

  it('does not consume resources or mutate inputs; no balance is assumed', () => {
    const catalog = [seal], states = { [seal.id]: state(50) }, snapshot = JSON.stringify([catalog, states])
    const output = classify(catalog, states)
    nonDominatedSealOptions(output)
    expect(JSON.stringify([catalog, states])).toBe(snapshot)
    expect(output[0].metrics.tickets.explanation).toContain('no available balance')
    expect(output[0].metrics.openers.explanation).toContain('not available')
  })
})
