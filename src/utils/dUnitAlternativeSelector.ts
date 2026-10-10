import type { DUnitCandidateRoute } from './dUnitCostBenefit'
import { DUNIT_MAX_LINE_STATES_PER_GAIN } from './dUnitCostBenefit'
import { bonusKey, isDUnitConditionCompleted, type DUnitBonusKey, type DUnitInventory, type DUnitProgress } from './dUnit'
import { classifyDUnitConditionWork, type ClassifiedDUnitCondition } from './dUnitWorkClassification'
import { compareRecommendationMetrics, type RecommendationMetric } from './recommendationClassification'

export type DUnitSelectorCandidate = Pick<DUnitCandidateRoute, 'totalGain' | 'recommendations' | 'setCount' | 'unverifiedSetIds'>
export type DUnitAlternativeView = 'source' | 'confirmedProgress' | 'knownRemainingWork' | 'incrementalGain'
export const DUNIT_ALTERNATIVE_COMPARISON_LIMIT = 24
/** Same identity convention as the existing planner: never translated names. */
export const dUnitAlternativeId = (route: DUnitSelectorCandidate) => route.recommendations.map(item => item.condition.id).sort().join('|')

export interface SelectedDUnitAlternative {
  id: string
  candidate: DUnitSelectorCandidate
  conditions: readonly ClassifiedDUnitCondition[]
  gain: RecommendationMetric
  /** Separate dimensions, deduplicated only when their semantics AND values
   * coincide. No sums across populations or thresholds and no proxy costs. */
  dimensions: readonly RecommendationMetric[]
  assessment: 'determined' | 'inconclusive' | 'outsideComparison'
  issues: readonly string[]
  dominatedBy: string[]
}
type PairOutcome = 'leftDominates' | 'rightDominates' | 'equal' | 'tradeoff' | 'inconclusive'
const dimensionId = (metric: RecommendationMetric) => JSON.stringify([metric.system, metric.criterion, metric.unit, metric.semanticKey, metric.contextKey])
const determined = (metrics: readonly RecommendationMetric[]) => metrics.length > 0 &&
  metrics.every(metric => compareRecommendationMetrics(metric, metric).outcome === 'equal')

function compareVectors(left: readonly RecommendationMetric[], right: readonly RecommendationMetric[]): PairOutcome {
  const a = new Map(left.map(metric => [dimensionId(metric), metric]))
  const b = new Map(right.map(metric => [dimensionId(metric), metric]))
  if (!a.size || a.size !== b.size || [...a.keys()].some(key => !b.has(key))) return 'inconclusive'
  const outcomes = [...a].map(([key, metric]) => compareRecommendationMetrics(metric, b.get(key)!).outcome)
  if (outcomes.includes('inconclusive')) return 'inconclusive'
  const better = outcomes.includes('better'), worse = outcomes.includes('worse')
  return better && worse ? 'tradeoff' : better ? 'leftDominates' : worse ? 'rightDominates' : 'equal'
}

/** View ordering only inside the bounded comparison window. Unknown slots
 * stay fixed. Compatible dominance creates a partial order; tradeoffs and
 * ties retain source precedence. No intransitive Array.sort comparator. */
function viewOrder(items: readonly SelectedDUnitAlternative[], windowIds: Set<string>, view: DUnitAlternativeView) {
  if (view === 'source') return [...items]
  const dimensions = (item: SelectedDUnitAlternative) => view === 'incrementalGain' ? [item.gain] :
    item.dimensions.filter(metric => metric.criterion === (view === 'confirmedProgress' ? 'progressReuse' : 'remainingEffort'))
  const sortable = items.filter(item => windowIds.has(item.id) && determined(dimensions(item)))
  const incoming = new Map(sortable.map(item => [item.id, new Set<string>()]))
  for (let i = 0; i < sortable.length; i++) for (let j = i + 1; j < sortable.length; j++) {
    const a = sortable[i], b = sortable[j], outcome = compareVectors(dimensions(a), dimensions(b))
    if (outcome === 'leftDominates') incoming.get(b.id)!.add(a.id)
    if (outcome === 'rightDominates') incoming.get(a.id)!.add(b.id)
  }
  const pending = [...sortable], ordered: SelectedDUnitAlternative[] = []
  while (pending.length) {
    const index = pending.findIndex(item => incoming.get(item.id)!.size === 0)
    // A cycle cannot occur for compatible Pareto dimensions; preserve input
    // if inconsistent future contracts prevent a partial order.
    if (index < 0) { ordered.push(...pending); break }
    const [item] = pending.splice(index, 1)
    ordered.push(item)
    incoming.forEach(edges => edges.delete(item.id))
  }
  const sortedIds = new Set(sortable.map(item => item.id))
  let cursor = 0
  return items.map(item => sortedIds.has(item.id) ? ordered[cursor++] : item)
}

/** Consumes already generated routes only. Retains EVERY unique supplied
 * candidate, including dominated, incomplete and outside-window candidates.
 * Classification is cached per condition. Pairwise work is bounded to 24
 * candidates (276 pairs), independent of the supplied list length.
 * Source search is NOT exhaustive: 32 states/gain, up to four-set early
 * packages and 24 compact alternatives in the current engine. This module
 * changes none of those limits and cannot recover omitted combinations. */
export function selectDUnitAlternatives(
  candidates: readonly DUnitSelectorCandidate[],
  options: { key: DUnitBonusKey; contextKey: string; progress: DUnitProgress; inventory: DUnitInventory;
    comparisonIds?: readonly string[]; view?: DUnitAlternativeView },
) {
  const unique = new Map<string, DUnitSelectorCandidate>()
  candidates.forEach(candidate => { const id = dUnitAlternativeId(candidate); if (!unique.has(id)) unique.set(id, candidate) })
  const requested = [...new Set(options.comparisonIds ?? [...unique.keys()])]
  const validRequested = requested.filter(id => unique.has(id))
  const windowIds = new Set(validRequested.slice(0, DUNIT_ALTERNATIVE_COMPARISON_LIMIT))
  const cache = new Map<string, ClassifiedDUnitCondition>()
  const entries: SelectedDUnitAlternative[] = [...unique].map(([id, candidate]) => {
    const issues: string[] = []
    const conditions = candidate.recommendations.map(item => {
      const cacheKey = `${item.setId}:${item.condition.id}`
      if (!cache.has(cacheKey)) cache.set(cacheKey, classifyDUnitConditionWork(item.setId, item.condition, options.progress, options.inventory, options.contextKey))
      return cache.get(cacheKey)!
    })
    const validGain = Boolean(id && options.contextKey) && candidate.recommendations.every(item =>
      item.condition.confirmed && item.condition.bonus.confirmed && item.condition.bonus.value !== null &&
      item.condition.bonus.unit !== null && bonusKey(item.condition) === options.key &&
      !isDUnitConditionCompleted(options.progress, item.condition)) &&
      Number.isFinite(candidate.totalGain) && candidate.totalGain >= 0
    if (!validGain) issues.push('gainUnavailableOrStale')
    const unit = options.key.split('|').slice(-1)[0]
    const gainContext = { criterion: 'incrementalGain' as const, system: 'dunit' as const,
      semanticKey: options.key, contextKey: options.contextKey,
      unit: unit === 'percent' ? 'percent' as const : 'absolute' as const,
      confirmation: validGain ? 'confirmed' as const : 'unknown' as const,
      sources: [{ kind: 'calculation' as const, reference: 'dUnitCostBenefit:totalGain', confirmation: validGain ? 'confirmed' as const : 'unknown' as const }],
      explanation: 'Incremental gain supplied by the current engine, not a recomputed route or economic score.',
      limitations: ['Only valid for the supplied current player snapshot and exact bonus key.'],
    }
    const gain: RecommendationMetric = validGain ? { ...gainContext, availability: 'known', value: candidate.totalGain } :
      { ...gainContext, availability: 'unknown', value: null }
    const dimensions = new Map<string, RecommendationMetric>()
    for (const condition of conditions) for (const metric of Object.values(condition.metrics)) {
      if (metric.availability === 'notApplicable') continue
      const key = dimensionId(metric), previous = dimensions.get(key)
      if (previous && compareRecommendationMetrics(previous, metric).outcome !== 'equal') issues.push('conflictingOrIncompleteDimension')
      if (!previous) dimensions.set(key, metric)
    }
    const vector = [...dimensions.values()]
    if (!determined([...vector, gain])) issues.push('workIncomplete')
    return { id, candidate, conditions, gain, dimensions: vector,
      assessment: !windowIds.has(id) ? 'outsideComparison' : issues.length ? 'inconclusive' : 'determined',
      issues, dominatedBy: [] } as SelectedDUnitAlternative
  })
  const window = entries.filter(item => windowIds.has(item.id))
  const pairs: { leftId: string; rightId: string; outcome: PairOutcome }[] = []
  for (let i = 0; i < window.length; i++) for (let j = i + 1; j < window.length; j++) {
    const a = window[i], b = window[j]
    const outcome = a.assessment === 'determined' && b.assessment === 'determined'
      ? compareVectors([...a.dimensions, a.gain], [...b.dimensions, b.gain]) : 'inconclusive'
    pairs.push({ leftId: a.id, rightId: b.id, outcome })
    if (outcome === 'leftDominates') b.dominatedBy.push(a.id)
    if (outcome === 'rightDominates') a.dominatedBy.push(b.id)
  }
  // Sufficient evidence for one route does not imply compatibility with its
  // peers. Keep such isolated vectors explicitly inconclusive, not inferior.
  window.forEach(item => {
    if (window.length > 1 && item.assessment === 'determined' && !pairs.some(pair =>
      (pair.leftId === item.id || pair.rightId === item.id) && pair.outcome !== 'inconclusive')) {
      item.assessment = 'inconclusive'; (item.issues as string[]).push('noCompatiblePeer')
    }
  })
  const ordered = viewOrder(entries, windowIds, options.view ?? 'source')
  return {
    candidates: ordered,
    determined: ordered.filter(item => item.assessment === 'determined'),
    inconclusive: ordered.filter(item => item.assessment === 'inconclusive'),
    outsideComparison: ordered.filter(item => item.assessment === 'outsideComparison'),
    nonDominated: ordered.filter(item => item.assessment === 'determined' && !item.dominatedBy.length),
    pairs, comparedIds: [...windowIds],
    ignoredComparisonIds: requested.filter(id => !unique.has(id)),
    deferredComparisonIds: validRequested.slice(DUNIT_ALTERNATIVE_COMPARISON_LIMIT),
    limits: { maxComparedCandidates: DUNIT_ALTERNATIVE_COMPARISON_LIMIT, sourceMaxLineStatesPerGain: DUNIT_MAX_LINE_STATES_PER_GAIN,
      exhaustive: false as const, sourceSearchUnchanged: true as const },
    economicCost: 'costUnvalidated' as const,
  }
}
