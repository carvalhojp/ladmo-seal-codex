import type { Attribute, Level, Seal } from '../types'
import { buildProgressOptions } from './goalOptimizer'
import { isPercent } from './calculations'
import { goalDisplayValue } from './tamerGoals'
import { getSealState, type SealStateMap } from './sealState'
import {
  compareRecommendationMetrics, type RecommendationMetric,
  type RecommendationCriterion, type RecommendationMetricUnit,
} from './recommendationClassification'

export const sealClassificationDimensions = [
  'tickets', 'openers', 'additionalSeals', 'incrementalGain', 'progressReuse',
] as const
export type SealClassificationDimension = typeof sealClassificationDimensions[number]
export interface ClassifiedSealOption {
  sealId: string
  attribute: Attribute
  level: Level
  finalQuantity: number
  currentQuantity: number | null
  owned: boolean | null
  excluded: boolean
  /** Missing records enumerate hypothetical stages, never assert ownership. */
  progressBasis: 'registered' | 'unregistered'
  metrics: Record<SealClassificationDimension, RecommendationMetric>
}
export type SealOptionComparison = 'dominates' | 'dominated' | 'equal' | 'tradeoff' | 'inconclusive'

/** Enumerates all future single-Seal stages, not combinations or a global
 * target solver. No search cap or ranking heuristic is used here.
 * contextKey identifies one immutable player/catalog snapshot and assumptions.
 * Costs are catalog exchange requirements, NOT balances, farm time or Tera. */
export function classifySealProgressOptions(
  catalog: readonly Seal[], states: SealStateMap, attribute: Attribute, contextKey: string,
): ClassifiedSealOption[] {
  return catalog.filter(seal => seal.attribute === attribute).flatMap(seal => {
    const state = getSealState(states, seal.id)
    if (state.doNotRecommend) return []
    const recorded = Object.prototype.hasOwnProperty.call(states, seal.id)
    const validProgress = Number.isSafeInteger(state.quantity) && state.quantity >= 0
    // Do not pass invalid quantities into the existing calculation engine.
    const options = buildProgressOptions(seal, validProgress ? state : { quantity: 0 })
    return options.map(option => {
      const metric = (
        criterion: RecommendationCriterion, unit: RecommendationMetricUnit,
        semanticKey: string, value: number, calculation: string, explanation: string,
        invalidAvailability: 'unknown' | 'costUnvalidated' = 'unknown',
      ): RecommendationMetric => {
        const availability = !recorded ? 'notRecorded' : !validProgress ? 'unknown' :
          Number.isFinite(value) && value >= 0 ? 'known' : invalidAvailability
        const common = {
          criterion, system: 'seals' as const, unit, semanticKey, contextKey,
          confirmation: availability === 'known' ? 'confirmed' as const : 'unknown' as const,
          sources: [
            { kind: 'catalog' as const, reference: seal.id, confirmation: 'confirmed' as const },
            { kind: 'calculation' as const, reference: calculation, confirmation: 'confirmed' as const },
            ...(recorded ? [{ kind: 'playerRecord' as const, reference: seal.id, confirmation: validProgress ? 'confirmed' as const : 'unknown' as const }] : []),
          ],
          explanation,
          limitations: ['Based on recorded progress and catalog rules, not a live game balance.',
            ...(!recorded ? ['Stages assume zero only for enumeration; incremental metrics remain not recorded.'] : [])],
        }
        return availability === 'known' ? { ...common, availability, value } :
          { ...common, availability, value: null }
      }
      const validExchange = Number.isFinite(seal.ticketCost) && seal.ticketCost >= 0 &&
        Number.isSafeInteger(seal.sealsReceived) && seal.sealsReceived > 0
      return {
        sealId: seal.id, attribute, level: option.level, finalQuantity: option.finalQuantity,
        currentQuantity: recorded && validProgress ? state.quantity : null,
        owned: recorded ? state.hasSeal || state.quantity > 0 : null,
        excluded: state.doNotRecommend, progressBasis: recorded ? 'registered' as const : 'unregistered' as const,
        metrics: {
          tickets: metric('knownResources', 'tickets', 'exchangeTickets', validExchange ? option.tickets : NaN,
            'buildProgressOptions/ticketsForSeals', 'Additional exchange Tickets required; no available balance is checked.', 'costUnvalidated'),
          openers: metric('knownResources', 'openers', 'requiredOpeners', option.openers,
            'buildProgressOptions/openersFor', 'Openers required for the additional Seals; not available Openers.'),
          additionalSeals: metric('remainingEffort', 'seals', 'additionalSeals', option.additionalSeals,
            'buildProgressOptions', 'Additional Seal units needed for this stage, not acquisition difficulty.'),
          incrementalGain: metric('incrementalGain', isPercent(attribute) ? 'percent' : 'absolute',
            `${attribute}||${isPercent(attribute) ? 'percent' : 'absolute'}`,
            goalDisplayValue({ system: 'seals', attribute }, option.bonusGain),
            'buildProgressOptions/goalDisplayValue', 'Additional attribute bonus beyond the registered current stage.'),
          progressReuse: metric('progressReuse', 'seals', 'registeredSealQuantity', state.quantity,
            'getSealState', 'Registered Seal units already contributing toward this destination; not an efficiency score.'),
        },
      }
    })
  })
}

/** Pareto comparison across all five dimensions. Unknown evidence prevents
 * dominance; neither missing data nor a tie is used to discard an option. */
export function compareClassifiedSealOptions(left: ClassifiedSealOption, right: ClassifiedSealOption): SealOptionComparison {
  const outcomes = sealClassificationDimensions.map(key =>
    compareRecommendationMetrics(left.metrics[key], right.metrics[key]).outcome)
  if (outcomes.includes('inconclusive')) return 'inconclusive'
  const better = outcomes.includes('better'), worse = outcomes.includes('worse')
  return better && worse ? 'tradeoff' : better ? 'dominates' : worse ? 'dominated' : 'equal'
}

/** Exact nondominance only among supplied single-stage options. It does not
 * claim a globally optimal multi-Seal route or reorder options economically.
 * O(n²); no candidate truncation. Inputs and player state are not mutated. */
export const nonDominatedSealOptions = (options: readonly ClassifiedSealOption[]) =>
  options.filter(option => !options.some(other => other !== option &&
    compareClassifiedSealOptions(other, option) === 'dominates'))
