import type { DUnitCondition, DUnitSet } from '../data/dUnitAudit'
import { progressionAuditForDUnitPortrait } from '../data/dUnitPortraitProgressionAudit'
import { dUnitPlayerStateFromInventory, isDUnitConditionCompleted, type DUnitInventory, type DUnitProgress } from './dUnit'
import { compareDUnitRouteWork, describeDUnitRouteWork, knownMembersForDUnitSet, type DUnitKnownSetMembers, type DUnitRouteWork } from './dUnitRouteWork'
import { compareRecommendationMetrics, type RecommendationMetric, type RecommendationCriterion, type RecommendationMetricUnit } from './recommendationClassification'

export type DUnitMetricUncertainty = 'identityUnknown' | 'relationUnconfirmed' | 'recordMissing' | 'unsupportedRequirement' | 'collectiveSharingUnknown'
export type DUnitWorkMetric = RecommendationMetric & { uncertainty?: DUnitMetricUncertainty }
type Availability = RecommendationMetric['availability']
type MetricInput = {
  criterion: RecommendationCriterion; unit: RecommendationMetricUnit; semanticKey: string
  contextKey: string; reference: string; explanation: string
  availability: Availability; value?: number; uncertainty?: DUnitMetricUncertainty
}
function metric(input: MetricInput): DUnitWorkMetric {
  const { value, reference, ...description } = input
  const confirmation = input.availability === 'known' ? 'confirmed' as const : 'unknown' as const
  const common = { ...description, system: 'dunit' as const, confirmation,
    sources: [{ kind: 'calculation' as const, reference, confirmation }],
    limitations: ['Describes recorded progress, not live game ownership or economic difficulty.',
      'Condition completion never implies individual inventory fields or evolution unlocks.'],
  }
  return input.availability === 'known' && value !== undefined && Number.isFinite(value) && value >= 0
    ? { ...common, availability: 'known', value }
    : { ...common, availability: input.availability === 'known' ? 'unknown' : input.availability, value: null }
}

export interface ClassifiedDUnitCondition {
  setId: string
  conditionId: string
  contextKey: string
  completed: boolean
  memberIds: readonly string[]
  confirmedLineIds: readonly string[]
  metrics: Record<'registeredOwned' | 'remainingOwnership' | 'registeredLevels' | 'remainingLevels' |
    'registeredUnlocks' | 'remainingEvolutions' | 'unlockRequirements' | 'registeredTranscendence' | 'remainingTranscendence', DUnitWorkMetric>
  /** Only individually determinable obtain/transcendence work. No implicit
   * evolution work, level sharing or costs may be inferred from this evidence. */
  sharingWork: DUnitRouteWork | null
}

/** Uses manual portrait progression relations, not legacy rank/line proxies.
 * Optional known composition follows describeDUnitRouteWork's existing API;
 * supplied members must themselves have confirmed identities. */
export function classifyDUnitConditionWork(
  setId: string, condition: DUnitCondition, progress: DUnitProgress,
  inventory: DUnitInventory, contextKey: string,
  known: DUnitKnownSetMembers = knownMembersForDUnitSet(setId),
): ClassifiedDUnitCondition {
  const complete = known.complete && known.members.length > 0 &&
    known.members.every(member => member.identityStatus === 'confirmed' && member.digimonId) &&
    new Set(known.members.map(member => member.digimonId)).size === known.members.length
  const composition = complete ? known : { complete: false, members: [] }
  const work = describeDUnitRouteWork(setId, condition, dUnitPlayerStateFromInventory(inventory), composition)
  const completed = isDUnitConditionCompleted(progress, condition)
  const ids = work.memberIds
  const audits = composition.members.map(member => progressionAuditForDUnitPortrait(setId, member.portraitIndex!))
  const linesKnown = complete && audits.every((audit, index) => audit?.evolutionStatus === 'confirmed' &&
    audit.digimonId === ids[index] && audit.evolutionLineId && audit.baseDigimonId && audit.relationship)
  const evolutionIds = linesKnown ? ids.filter((_, index) => audits[index]!.relationship !== 'base') : []
  const has = (id: string, field: 'owned' | 'evolutionUnlocked' | 'transcended' | 'level') => {
    const value = inventory[id]?.[field]
    return field === 'level' ? typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 : typeof value === 'boolean'
  }
  const all = (field: 'owned' | 'transcended' | 'level') => complete && ids.every(id => has(id, field))
  const any = (field: 'owned' | 'transcended' | 'level') => complete && ids.some(id => has(id, field))
  const scope = [...ids].sort().join(',') || setId
  const make = (name: string, unit: RecommendationMetricUnit, criterion: RecommendationCriterion,
    availability: Availability, value?: number, uncertainty?: DUnitMetricUncertainty) => metric({
      criterion, unit, semanticKey: `${name}:${scope}`, contextKey,
      reference: `${condition.id}:dUnitRouteWork:portraitProgressionAudit:inventory`,
      explanation: name, availability, value, uncertainty,
    })
  const recorded = (name: string, unit: RecommendationMetricUnit, present: boolean, value: number) =>
    make(name, unit, 'progressReuse', !complete ? 'unknown' : present ? 'known' : 'notRecorded', value,
      !complete ? 'identityUnknown' : present ? undefined : 'recordMissing')
  const remaining = (name: string, unit: RecommendationMetricUnit, applicable: boolean, available: boolean, value?: number) => {
    if (!applicable) return make(name, unit, 'remainingEffort', 'notApplicable')
    if (completed) return make(name, unit, 'remainingEffort', 'known', 0)
    return make(name, unit, 'remainingEffort', !complete ? 'unknown' : available ? 'known' : 'notRecorded', value,
      !complete ? 'identityUnknown' : available ? undefined : 'recordMissing')
  }
  // The existing count helper is exact when every pictured member is required.
  // Subset requirements need a selection model not provided by the current API.
  const fullPopulation = Number(condition.requirement.match(/\d+/)?.[0]) === ids.length
  const ownership = remaining('remainingOwnership', 'absolute', work.kind === 'obtained', all('owned'), work.missingOwned)
  const transcendence = remaining('remainingTranscendence', 'transcendences', work.kind === 'transcendence', all('transcended'), work.missingTranscendence)
  const unsupported = (item: DUnitWorkMetric) => complete && !completed && !fullPopulation && item.availability !== 'notApplicable'
    ? { ...item, availability: 'unknown' as const, value: null, uncertainty: 'unsupportedRequirement' as const } : item
  const unlocksRecorded = linesKnown && evolutionIds.every(id => has(id, 'evolutionUnlocked'))
  const metrics: ClassifiedDUnitCondition['metrics'] = {
    registeredOwned: recorded('registeredOwnedForms', 'absolute', any('owned'), work.owned.length),
    remainingOwnership: unsupported(ownership),
    registeredLevels: work.kind === 'level'
      ? recorded('registeredCollectiveLevel', 'levels', any('level'), work.levelCurrent ?? 0)
      : make('registeredCollectiveLevel', 'levels', 'progressReuse', 'notApplicable'),
    remainingLevels: remaining(`remainingCollectiveLevel:${condition.requirement}`, 'levels', work.kind === 'level', all('level'), work.levelRemaining),
    registeredUnlocks: make('registeredIndividualUnlocks', 'evolutions', 'progressReuse', !linesKnown ? 'unknown' :
      evolutionIds.length === 0 || evolutionIds.some(id => has(id, 'evolutionUnlocked')) ? 'known' : 'notRecorded',
      evolutionIds.filter(id => inventory[id]?.evolutionUnlocked === true).length,
      !linesKnown ? !complete ? 'identityUnknown' : 'relationUnconfirmed' : undefined),
    remainingEvolutions: make('remainingIndividualUnlocks', 'evolutions', 'remainingEffort', !linesKnown ? 'unknown' : unlocksRecorded ? 'known' : 'notRecorded',
      work.missingEvolutionIds.length, !linesKnown ? !complete ? 'identityUnknown' : 'relationUnconfirmed' : unlocksRecorded ? undefined : 'recordMissing'),
    unlockRequirements: make('unlockRequirements', 'evolutions', 'remainingEffort', !linesKnown ? 'unknown' : evolutionIds.length === 0 ? 'notApplicable' :
      audits.filter(audit => audit!.relationship !== 'base').every(audit => audit!.unlockStatus === 'confirmed' && Boolean(audit!.unlockRequirement)) ? 'known' : 'unknown',
      evolutionIds.length, !linesKnown ? !complete ? 'identityUnknown' : 'relationUnconfirmed' : undefined),
    registeredTranscendence: recorded('registeredTranscendedForms', 'transcendences', any('transcended'), ids.filter(id => inventory[id]?.transcended === true).length),
    remainingTranscendence: unsupported(transcendence),
  }
  const sharingKnown = !completed && complete && (work.kind === 'obtained' && metrics.remainingOwnership.availability === 'known' ||
    work.kind === 'transcendence' && metrics.remainingTranscendence.availability === 'known')
  return { setId, conditionId: condition.id, contextKey, completed, memberIds: ids,
    confirmedLineIds: linesKnown ? [...new Set(audits.map(audit => audit!.evolutionLineId!))] : [], metrics,
    sharingWork: sharingKnown ? { ...work, missingEvolution: [], missingEvolutionIds: [] } : null }
}

export function classifyDUnitSetWork(set: DUnitSet, progress: DUnitProgress, inventory: DUnitInventory, contextKey: string) {
  const conditions = set.conditions.map(condition => classifyDUnitConditionWork(set.id, condition, progress, inventory, contextKey))
  const done = conditions.filter(condition => condition.completed).length
  const count = (name: string, criterion: RecommendationCriterion, value: number) => metric({
    criterion, unit: 'conditions', semanticKey: name, contextKey, reference: `${set.id}:isDUnitConditionCompleted`,
    explanation: 'Explicit D-Unit checkboxes, not individual Digimons or difficulty.', availability: 'known', value,
  })
  return { setId: set.id, conditions,
    completedConditions: count('completedConditions', 'progressReuse', done),
    pendingConditions: count('pendingConditions', 'remainingEffort', conditions.length - done),
    economicCost: { availability: 'costUnvalidated' as const, value: null,
      explanation: 'No audited economic cost is derived from these work counts.' },
  }
}

/** Sharing is a count of audited forms with the SAME kind of pending work,
 * not interchangeable tasks, a shared level total or an economic saving. */
export function classifyDUnitSharedWork(left: ClassifiedDUnitCondition, right: ClassifiedDUnitCondition): DUnitWorkMetric {
  const base = { criterion: 'progressReuse' as const, unit: 'absolute' as const,
    semanticKey: 'sharedPendingForms', contextKey: left.contextKey,
    reference: 'compareDUnitRouteWork', explanation: 'Audited forms with the same kind of pending acquisition/transcendence work.' }
  if (left.contextKey !== right.contextKey || !left.contextKey)
    return metric({ ...base, availability: 'unknown', uncertainty: 'unsupportedRequirement' })
  if (left.completed || right.completed) return metric({ ...base, availability: 'known', value: 0 })
  if (!left.sharingWork || !right.sharingWork)
    return metric({ ...base, availability: 'unknown', uncertainty: 'collectiveSharingUnknown' })
  const result = compareDUnitRouteWork([left.sharingWork], [right.sharingWork])
  if (left.sharingWork.kind !== right.sharingWork.kind)
    return metric({ ...base, availability: 'notApplicable' })
  return metric({ ...base, availability: 'known', value: result.remainingShared.length })
}

/** Explicit dimensions only: inconclusive metrics never become zero or
 * automatically demote incomplete candidates. No scalar effort score. */
export const compareDUnitWorkMetrics = (left: DUnitWorkMetric, right: DUnitWorkMetric) => compareRecommendationMetrics(left, right)
