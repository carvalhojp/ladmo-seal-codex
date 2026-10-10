import type { DUnitAuditStatus } from '../data/dUnitRankAudit'
import type { ProgressionSystem } from './progressionPlanner'

export type RecommendationCriterion =
  | 'remainingEffort' | 'knownResources' | 'incrementalGain' | 'progressReuse'
export type RecommendationMetricUnit =
  | 'tickets' | 'openers' | 'seals' | 'conditions' | 'levels'
  | 'baseDigimon' | 'evolutions' | 'transcendences' | 'absolute' | 'percent'
export interface RecommendationMetricSource {
  kind: 'catalog' | 'playerRecord' | 'audit' | 'calculation'
  /** Stable reference to a record, evidence or existing calculation. */
  reference: string
  confirmation: DUnitAuditStatus
}
interface MetricContext {
  criterion: RecommendationCriterion
  system: ProgressionSystem
  unit: RecommendationMetricUnit
  /** Exact attribute/qualifier/unit key or requirement/resource identity.
   * Different requirement populations must not share a key just because
   * their displayed text or numeric unit matches. */
  semanticKey: string
  /** Same player snapshot and planning assumptions; never a persisted ID. */
  contextKey: string
  confirmation: DUnitAuditStatus
  sources: readonly RecommendationMetricSource[]
  explanation: string
  limitations: readonly string[]
}
export type RecommendationMetric = MetricContext & (
  | { availability: 'known'; value: number }
  | { availability: 'unknown' | 'notRecorded' | 'costUnvalidated' | 'notApplicable'; value: null }
)

export const recommendationCriterionDirection = {
  remainingEffort: 'minimize', knownResources: 'minimize',
  incrementalGain: 'maximize', progressReuse: 'maximize',
} as const satisfies Record<RecommendationCriterion, 'minimize' | 'maximize'>

export type MetricComparison =
  | { outcome: 'better' | 'worse' | 'equal' }
  | { outcome: 'inconclusive'; reason:
      'incompatible' | 'unavailable' | 'unconfirmed' | 'invalidValue' }

/** Pairwise comparison of ONE compatible dimension, never an economic
 * ranking, weighted score, currency conversion or inference of ownership.
 * A known zero remains valid; unavailable values never enter arithmetic.
 * Confirmed means supported by its stated sources, not independently verified
 * against the live game. Callers must retain limitations when presenting it. */
export function compareRecommendationMetrics(
  left: RecommendationMetric, right: RecommendationMetric,
): MetricComparison {
  if (!left.semanticKey || !left.contextKey ||
    left.criterion !== right.criterion || left.system !== right.system ||
    left.unit !== right.unit || left.semanticKey !== right.semanticKey ||
    left.contextKey !== right.contextKey) {
    return { outcome: 'inconclusive', reason: 'incompatible' }
  }
  if (left.availability !== 'known' || right.availability !== 'known')
    return { outcome: 'inconclusive', reason: 'unavailable' }
  if (![left.value, right.value].every(value => Number.isFinite(value) && value >= 0))
    return { outcome: 'inconclusive', reason: 'invalidValue' }
  if ([left, right].some(metric => metric.confirmation !== 'confirmed' ||
    !metric.sources.length || metric.sources.some(source =>
      source.confirmation !== 'confirmed' || !source.reference.trim())))
    return { outcome: 'inconclusive', reason: 'unconfirmed' }
  if (left.value === right.value) return { outcome: 'equal' }
  const less = left.value < right.value
  const better = recommendationCriterionDirection[left.criterion] === 'minimize' ? less : !less
  return { outcome: better ? 'better' : 'worse' }
}
