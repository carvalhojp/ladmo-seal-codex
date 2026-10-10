import { describe, expect, it } from 'vitest'
import {
  compareRecommendationMetrics, type RecommendationMetric,
} from './recommendationClassification'

const known = (value: number): RecommendationMetric => ({
  criterion: 'knownResources', system: 'seals', unit: 'tickets',
  semanticKey: 'exchangeTickets', contextKey: 'same-player-snapshot',
  availability: 'known', value, confirmation: 'confirmed',
  sources: [{ kind: 'calculation', reference: 'ticketsForSeals', confirmation: 'confirmed' }],
  explanation: 'Additional exchange Tickets required.',
  limitations: ['Not a live balance or a Tera price.'],
})

describe('recommendation classification contract', () => {
  it('keeps known zero distinct and prefers fewer known resources', () => {
    expect(compareRecommendationMetrics(known(0), known(10))).toEqual({ outcome: 'better' })
    expect(compareRecommendationMetrics(known(10), known(0))).toEqual({ outcome: 'worse' })
    expect(compareRecommendationMetrics(known(0), known(0))).toEqual({ outcome: 'equal' })
    expect(compareRecommendationMetrics(known(10), known(10))).toEqual({ outcome: 'equal' })
  })

  it.each(['unknown', 'notRecorded', 'costUnvalidated', 'notApplicable'] as const)(
    'retains %s separately without using zero, on either side', availability => {
      const unavailable: RecommendationMetric = { ...known(0), availability, value: null }
      expect(unavailable.availability).toBe(availability)
      expect(unavailable.value).toBeNull()
      expect(compareRecommendationMetrics(unavailable, known(0))).toEqual({ outcome: 'inconclusive', reason: 'unavailable' })
      expect(compareRecommendationMetrics(known(0), unavailable)).toEqual({ outcome: 'inconclusive', reason: 'unavailable' })
    },
  )

  it.each([
    { unit: 'openers' }, { unit: 'seals' }, { unit: 'conditions' },
    { unit: 'levels' }, { unit: 'transcendences' },
    { system: 'dunit' }, { criterion: 'remainingEffort' },
    { semanticKey: 'otherRequirement' }, { contextKey: 'different-progress' },
    { semanticKey: '' }, { contextKey: '' },
  ] as const)('rejects incompatible dimensions: %o', patch => {
    expect(compareRecommendationMetrics({ ...known(1), ...patch }, known(1)))
      .toEqual({ outcome: 'inconclusive', reason: 'incompatible' })
  })

  it('never mixes attribute qualifiers or points and percentages', () => {
    const metric: RecommendationMetric = { ...known(10), system: 'dunit', criterion: 'incrementalGain', unit: 'percent', semanticKey: 'Dano habilidade|Fogo|percent' }
    expect(compareRecommendationMetrics(metric, { ...metric, semanticKey: 'Dano habilidade|Gelo|percent' }).outcome).toBe('inconclusive')
    expect(compareRecommendationMetrics(metric, { ...metric, unit: 'absolute' }).outcome).toBe('inconclusive')
  })

  it.each(['remainingEffort', 'knownResources', 'incrementalGain', 'progressReuse'] as const)(
    'uses only the explicit direction for %s', criterion => {
      const left = { ...known(5), criterion }, right = { ...known(10), criterion }
      const minimize = criterion === 'remainingEffort' || criterion === 'knownResources'
      expect(compareRecommendationMetrics(left, right).outcome).toBe(minimize ? 'better' : 'worse')
      expect(compareRecommendationMetrics(right, left).outcome).toBe(minimize ? 'worse' : 'better')
    },
  )

  it.each(['probable', 'unknown'] as const)('does not rank %s evidence', confirmation => {
    expect(compareRecommendationMetrics({ ...known(1), confirmation }, known(2)))
      .toEqual({ outcome: 'inconclusive', reason: 'unconfirmed' })
    expect(compareRecommendationMetrics(known(1), { ...known(2), sources: [{ kind: 'audit', reference: 'pending', confirmation }] }).outcome).toBe('inconclusive')
  })

  it('requires evidence even for equal values and preserves metadata without mutation', () => {
    const left = known(2), right = known(2), snapshot = JSON.stringify([left, right])
    compareRecommendationMetrics(left, right)
    expect(JSON.stringify([left, right])).toBe(snapshot)
    expect(compareRecommendationMetrics({ ...left, sources: [] }, right).outcome).toBe('inconclusive')
    expect(compareRecommendationMetrics({ ...left, sources: [{ kind: 'audit', reference: ' ', confirmation: 'confirmed' }] }, right).outcome).toBe('inconclusive')
  })

  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid numeric values: %s', value => {
    expect(compareRecommendationMetrics(known(value), known(0)))
      .toEqual({ outcome: 'inconclusive', reason: 'invalidValue' })
  })
})
