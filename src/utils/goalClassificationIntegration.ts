import { seals } from '../data/seals'
import { goalRecommendations } from './goalRecommendations'
import { goalDisplayValue, goalMetricInfo, type TamerGoal } from './tamerGoals'
import type { SealStateMap } from './sealState'
import type { DUnitBonusKey, DUnitInventory, DUnitProgress } from './dUnit'
import { classifySealProgressOptions } from './sealRecommendationClassification'
import { classifyDUnitSetWork } from './dUnitWorkClassification'
import { selectDUnitAlternatives, type DUnitSelectorCandidate } from './dUnitAlternativeSelector'
import { compareRecommendationMetrics, type RecommendationMetric } from './recommendationClassification'

export interface GoalDUnitCandidateSource {
  key: DUnitBonusKey
  contextKey: string
  /** Engine target in its original units, not a displayed conversion. */
  target: number
  candidates: readonly DUnitSelectorCandidate[]
}
export interface GoalClassificationContext {
  contextKey: string
  sealStates: SealStateMap
  progress: DUnitProgress
  inventory: DUnitInventory
  /** Already generated candidates indexed by existing goal ID. No automatic search. */
  dUnitSources?: Readonly<Record<string, GoalDUnitCandidateSource>>
}
export type GoalContributionCoverage = 'sufficientPotentialGain' | 'partialPotentialGain' |
  'indeterminate' | 'notApplicable' | 'alreadyComplete'

/** A confirmed catalog gain is still POTENTIAL until the player registers
 * progress. Coverage is not task completion, affordability or a cost ranking. */
function contribution(gain: RecommendationMetric | null, required: RecommendationMetric | null, complete: boolean) {
  let coverage: GoalContributionCoverage
  if (complete) coverage = 'alreadyComplete'
  else if (!gain || !required) coverage = 'notApplicable'
  else {
    const comparison = compareRecommendationMetrics(gain, required)
    coverage = comparison.outcome === 'inconclusive' ? 'indeterminate' : comparison.outcome === 'worse'
      ? 'partialPotentialGain' : 'sufficientPotentialGain'
  }
  return { gain, effect: 'potential' as const, coverage,
    evidence: gain && compareRecommendationMetrics(gain, gain).outcome === 'equal' ? 'confirmed' as const : 'indeterminate' as const,
    completesGoalAutomatically: false as const }
}

/** Read-only adapter. Each existing goal remains independent: the current
 * schema has one metric per attribute goal, not a multi-attribute composite.
 * Existing goalRecommendations supplies baseline/progress/remaining; all
 * work and resource metrics pass through unchanged from 2B/2C/2D.
 * No persistence, engine search, ranking or cross-goal aggregation is added. */
export function integrateGoalClassifications(goals: readonly TamerGoal[], context: GoalClassificationContext) {
  return goals.map(goal => {
    const recommendations = goalRecommendations(goal, context.sealStates, context.progress)
    const summary = recommendations.result
    const info = goal.type === 'attribute' ? goalMetricInfo(goal.metric) : null
    const semanticKey = goal.type === 'attribute' ? goal.metric.system === 'dunit'
      ? goal.metric.bonusKey : `${goal.metric.attribute}||${info?.unit ?? ''}` : null
    const gainMetric = (value: number | null, reference: string): RecommendationMetric | null => {
      if (goal.type !== 'attribute') return null
      const known = Boolean(info && context.contextKey && value !== null && Number.isFinite(value) && value >= 0)
      const base = { criterion: 'incrementalGain' as const, system: goal.metric.system,
        unit: info?.unit === 'percent' ? 'percent' as const : 'absolute' as const,
        semanticKey: semanticKey!, contextKey: context.contextKey,
        confirmation: known ? 'confirmed' as const : 'unknown' as const,
        sources: [{ kind: 'calculation' as const, reference, confirmation: known ? 'confirmed' as const : 'unknown' as const }],
        explanation: 'Attribute gain in the exact goal unit; separate from recorded progress and economic cost.',
        limitations: ['Potential contribution is not automatic completion or a verified game balance.'],
      }
      return known ? { ...base, availability: 'known', value: value! } : { ...base, availability: 'unknown', value: null }
    }
    const requiredGain = gainMetric(goal.type === 'attribute' && summary
      ? goalDisplayValue(goal.metric, summary.remaining) : null, 'goalRecommendations/goalDisplayValue:remaining')
    const complete = summary?.complete === true
    const sealAlternatives = goal.type === 'attribute' && goal.metric.system === 'seals' && !complete
      ? classifySealProgressOptions(seals, context.sealStates, goal.metric.attribute, context.contextKey).map(option => ({
          goalId: goal.id, id: `${option.sealId}:${option.level}`, classification: option,
          contribution: contribution(option.metrics.incrementalGain, requiredGain, complete),
        })) : []
    const dUnitSets = recommendations.sets.map(option => ({
      goalId: goal.id, id: option.set.id, recommendation: option,
      classification: classifyDUnitSetWork(option.set, context.progress, context.inventory, context.contextKey),
      // Existing presentation sums only pending bonuses of the exact key.
      // Set-completion goals deliberately have no heterogeneous gain total.
      contribution: contribution(gainMetric(option.pendingGain, 'goalRecommendations:pendingGain'), requiredGain, complete),
    }))
    const source = context.dUnitSources?.[goal.id]
    const applicable = goal.type === 'attribute' && goal.metric.system === 'dunit'
    const compatibleSource = goal.type === 'attribute' && goal.metric.system === 'dunit' && source && summary && !complete && source.key === goal.metric.bonusKey &&
      source.contextKey === context.contextKey && Boolean(context.contextKey) && source.target === summary.remaining
    const selection = compatibleSource ? selectDUnitAlternatives(source.candidates, {
      key: source.key, contextKey: context.contextKey, progress: context.progress, inventory: context.inventory,
    }) : null
    return {
      goalId: goal.id, goal, contextKey: context.contextKey,
      status: !summary || !context.contextKey ? 'indeterminate' as const : complete ? 'complete' as const : 'pending' as const,
      /** Original summary retains storage units and baseline semantics. */
      registeredProgress: summary,
      requiredGain,
      sealAlternatives, dUnitSets,
      dUnitRoutes: {
        status: !applicable ? 'notApplicable' as const : !source ? 'notProvided' as const :
          compatibleSource ? 'ready' as const : 'sourceMismatch' as const,
        // Retain unclassified/mismatched input for inspection, never silently
        // claim it matches the current target or discard its candidates.
        source: source ?? null, selection,
        alternatives: selection?.candidates.map(candidate => ({
          goalId: goal.id, id: candidate.id, classification: candidate,
          contribution: contribution(candidate.gain, requiredGain, complete),
        })) ?? [],
      },
      limitations: ['Each goal and exact attribute/unit is independent.',
        'Candidate gain is potential; acquisition and economic cost may remain unknown.',
        'D-Unit search is not exhaustive; the existing 24-candidate comparison window is unchanged.',
        'No candidate search is run automatically and no progress is modified.'],
    }
  })
}
