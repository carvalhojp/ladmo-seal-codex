import { useMemo, useState } from 'react'
import type { Lang } from '../App'
import { seals } from '../data/seals'
import { localizedSealName } from '../data/localizedSealNames'
import { integrateGoalClassifications } from '../utils/goalClassificationIntegration'
import { goalDisplayValue, type TamerGoal } from '../utils/tamerGoals'
import type { DUnitInventory, DUnitProgress } from '../utils/dUnit'
import type { SealStateMap } from '../utils/sealState'
import type { RecommendationMetric } from '../utils/recommendationClassification'

interface Props {
  goal: TamerGoal
  t: Record<string, string>
  lang: Lang
  sealStates: SealStateMap
  progress: DUnitProgress
  inventory?: DUnitInventory
}

const PAGE_SIZE = 6
const locales = { pt: 'pt-BR', en: 'en-US', es: 'es', ko: 'ko-KR' }

export function GoalClassificationDetails(props: Props) {
  const [open, setOpen] = useState(false)
  return <details className="tamer-details"
    onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{props.t.gcDetails}</summary>
    {open && <ClassificationContent {...props}/>}
  </details>
}

function ClassificationContent({ goal, t, lang, sealStates, progress, inventory }: Props) {
  const data = useMemo(() => integrateGoalClassifications([goal], {
    contextKey: `goal:${goal.id}`,
    sealStates, progress,
    // Missing fields remain unregistered in the classifier.
    // This adapter does not assert that the player owns no Digimons.
    inventory: inventory ?? {},
  })[0], [goal, sealStates, progress, inventory])
  const [page, setPage] = useState({ data, limit: PAGE_SIZE })
  const limit = page.data === data ? page.limit : PAGE_SIZE
  const number = (value: number) =>
    value.toLocaleString(locales[lang], { maximumFractionDigits: 2 })
  const unitLabels: Record<RecommendationMetric['unit'], string> = {
    tickets: t.tickets, openers: t.openers, seals: t.gcSeals,
    conditions: t.tgConditions, levels: t.gcLevels,
    baseDigimon: t.gcBases, evolutions: t.gcEvolutions,
    transcendences: t.gcTranscendences,
    absolute: t.ppPoints, percent: '%',
  }
  const metricValue = (metric: RecommendationMetric): string => {
    if (metric.availability === 'known' && metric.confirmation === 'confirmed')
      return `${number(metric.value)}${metric.unit === 'percent' ? '%' : ` ${unitLabels[metric.unit]}`}`
    if (metric.availability === 'notRecorded') return t.gcNotRecorded
    if (metric.availability === 'notApplicable') return t.gcNotApplicable
    if (metric.availability === 'costUnvalidated') return t.gcCost
    return t.gcUnknown
  }
  const coverageLabels = {
    sufficientPotentialGain: t.gcSufficient,
    partialPotentialGain: t.gcPartial,
    indeterminate: t.gcUnknown,
    notApplicable: t.gcNotApplicable,
    alreadyComplete: t.tgComplete,
  }
  type Contribution = typeof data.sealAlternatives[number]['contribution']
  const contribution = (item: Contribution) => item.gain && <>
    <p>{t.gcPotential}: <strong>{metricValue(item.gain)}</strong></p>
    <p>{item.evidence === 'confirmed' ? t.gcConfirmedGain : t.gcUnconfirmedGain}</p>
    <p>{coverageLabels[item.coverage]}</p>
  </>
  const workLabels = {
    registeredOwned: t.gcOwned,
    remainingOwnership: t.gcMissingOwnership,
    registeredLevels: t.gcRecordedLevels,
    remainingLevels: t.gcRemainingLevels,
    registeredUnlocks: t.gcRecordedUnlocks,
    remainingEvolutions: t.gcRemainingUnlocks,
    unlockRequirements: t.gcUnlockRequirements,
    registeredTranscendence: t.gcRecordedTranscendence,
    remainingTranscendence: t.gcRemainingTranscendence,
  }
  const entries = [
    ...data.sealAlternatives.map(item => ({ kind: 'seal' as const, item })),
    ...data.dUnitSets.map(item => ({ kind: 'dunit' as const, item })),
  ]
  const total = entries.length
  const visible = entries.slice(0, limit)
  const recorded = data.registeredProgress
  const recordedValue = recorded
    ? goal.type === 'attribute'
      ? `${number(goalDisplayValue(goal.metric, recorded.done))}${data.requiredGain?.unit === 'percent' ? '%' : ` ${t.ppPoints}`}`
      : `${number(recorded.done)} ${t.tgConditions}`
    : t.gcUnknown

  return <div>
    <p>{t.gcNotice}</p>
    <p>{t.gcRecorded}: <strong>{recordedValue}</strong></p>
    {data.status === 'indeterminate' && <p role="status">{t.gcUnknown}</p>}
    {data.status === 'complete' && <p>{t.tgComplete}</p>}
    {goal.type === 'attribute' && goal.metric.system === 'seals'
      ? <p>{t.gcResourcesNotice}</p>
      : <><p>{t.gcCost}</p><p>{t.gcRoutesNotEvaluated}</p>
          {inventory === undefined && <p>{t.gcInventoryUnavailable}</p>}
          <p>{t.gcWorkNotice}</p></>}
    {total > 0 && <p>{t.pvShowing}: {visible.length} / {total}</p>}
    <div className="tamer-goal-list">
      {visible.map(entry => {
        if (entry.kind === 'seal') {
          const item = entry.item
          const option = item.classification
          const seal = seals.find(candidate => candidate.id === option.sealId)!
          return <article className="tamer-goal-card" key={`seal:${item.id}`}>
            <h4>{localizedSealName(seal, lang)}</h4>
            <p>{t.destination}: {number(option.finalQuantity)} {t.gcSeals}</p>
            {contribution(item.contribution)}
            <dl className="tamer-stats">
              <div><dt>{t.tickets}</dt><dd>{metricValue(option.metrics.tickets)}</dd></div>
              <div><dt>{t.openers}</dt><dd>{metricValue(option.metrics.openers)}</dd></div>
              <div><dt>{t.newSeals}</dt><dd>{metricValue(option.metrics.additionalSeals)}</dd></div>
              <div><dt>{t.gcRecorded}</dt><dd>{metricValue(option.metrics.progressReuse)}</dd></div>
            </dl>
          </article>
        }
        const item = entry.item
        return <article className="tamer-goal-card" key={`dunit:${item.id}`}>
          <h4>{item.recommendation.set.name}</h4>
          <p>{t.gcRecorded}: {metricValue(item.classification.completedConditions)}</p>
          <p>{t.tgRemaining}: {metricValue(item.classification.pendingConditions)}</p>
          {contribution(item.contribution)}
          <details className="tamer-details"><summary>{t.details}</summary>
            {item.classification.conditions.map(condition => {
              const original = item.recommendation.set.conditions.find(entry => entry.id === condition.conditionId)!
              const matching = item.recommendation.matchingConditions.some(entry => entry.condition.id === condition.conditionId)
              return <section key={condition.conditionId}>
                <h5>{original.requirement}</h5>
                <p>{original.bonus.rawLabel} · {condition.completed ? t.ppStepDone : t.pvPending}</p>
                {goal.type === 'attribute' && <p>{matching ? t.pvMatching : t.pvOtherConditions}</p>}
                <dl className="tamer-stats">
                  {Object.entries(condition.metrics).map(([key, metric]) => <div key={key}>
                    <dt>{workLabels[key as keyof typeof workLabels]}</dt>
                    <dd>{metricValue(metric)}</dd>
                  </div>)}
                </dl>
              </section>
            })}
          </details>
        </article>
      })}
    </div>
    {!total && data.status !== 'complete' && <p>{t.ppNoOptions}</p>}
    {limit < total && <button className="quiet"
      onClick={() => setPage({ data, limit: limit + PAGE_SIZE })}>{t.gcMore}</button>}
  </div>
}
