import { seals } from '../data/seals'
import { dUnitSets, type DUnitCondition } from '../data/dUnitAudit'
import { buildProgressOptions } from './goalOptimizer'
import { getSealState, type SealStateMap } from './sealState'
import {
  bonusKey, isDUnitConditionCompleted, type DUnitProgress,
} from './dUnit'
import {
  deriveTamerGoal, goalMetricInfo, goalTotals,
  type TamerGoal, type TamerGoalsState,
} from './tamerGoals'

export function resolvePlanningGoal(
  id: string | undefined,
  state: TamerGoalsState,
  blocked = false,
) {
  if (!id) return { status: 'none' as const }
  if (blocked) return { status: 'unavailable' as const }
  const goal = state.goals.find(item => item.id === id)
  return goal
    ? { status: 'selected' as const, goal }
    : { status: 'unavailable' as const }
}

const confirmedBonus = (condition: DUnitCondition) =>
  condition.confirmed &&
  condition.bonus.confirmed &&
  condition.bonus.value !== null &&
  condition.bonus.unit !== null

/** Read-only presentation; reuses existing progression calculations. */
export function goalRecommendations(
  goal: TamerGoal,
  states: SealStateMap,
  progress: DUnitProgress,
) {
  const metric = goal.type === 'attribute' ? goal.metric : null
  const matches = (condition: DUnitCondition) =>
    metric?.system === 'dunit' &&
    bonusKey(condition) === metric.bonusKey
  const unknownCurrent = metric?.system === 'dunit' &&
    dUnitSets.some(set => set.conditions.some(condition =>
      matches(condition) &&
      isDUnitConditionCompleted(progress, condition) &&
      !confirmedBonus(condition),
    ))
  const result = unknownCurrent || metric && !goalMetricInfo(metric)
    ? null
    : deriveTamerGoal(goal, goalTotals(states, progress), progress)

  const sealOptions =
    result && !result.complete && metric?.system === 'seals'
      ? seals.flatMap(seal => {
          if (seal.attribute !== metric.attribute) return []
          const state = getSealState(states, seal.id)
          const next = buildProgressOptions(seal, state)[0]
          return next ? [{
            ...next,
            quantity: state.quantity,
            started: state.hasSeal || state.quantity > 0,
          }] : []
        })
      : []

  const sets =
    !result || result.complete || metric?.system === 'seals'
      ? []
      : dUnitSets.flatMap(set => {
          if (goal.type === 'dunit-set' && set.id !== goal.setId)
            return []
          const describe = (condition: DUnitCondition) => ({
            condition,
            completed: isDUnitConditionCompleted(progress, condition),
          })
          // A set-completion goal includes every condition, not just a bonus.
          const matchingConditions = set.conditions
            .filter(condition =>
              goal.type === 'dunit-set' || matches(condition),
            )
            .map(describe)
          const pending = matchingConditions.filter(item => !item.completed)
          if (!pending.length) return []
          const otherConditions = set.conditions
            .filter(condition =>
              !matchingConditions.some(item =>
                item.condition.id === condition.id,
              ),
            )
            .map(describe)
          const done = set.conditions.filter(condition =>
            isDUnitConditionCompleted(progress, condition),
          ).length
          return [{
            set, done, started: done > 0,
            matchingConditions, otherConditions,
            // Never sum different attributes/units for set-completion goals.
            pendingGain: metric?.system === 'dunit' &&
              pending.every(item => confirmedBonus(item.condition))
                ? pending.reduce(
                    (sum, item) => sum + item.condition.bonus.value!, 0,
                  )
                : null,
          }]
        })
  return { result, seals: sealOptions, sets }
}
