import { useMemo, useState } from 'react'
import type { Lang } from '../App'
import { dUnitSets } from '../data/dUnitAudit'
import type { SealStateMap } from '../utils/sealState'
import type { DUnitProgress } from '../utils/dUnit'
import { mainProgressionAttributes, otherProgressionAttributes, parseProgressionTarget, progressionDUnitOptions, progressionObjectiveLabelKey, progressionSubtypeLabelKey } from '../utils/progressionPlanner'
import { currentGoalBonus, deriveTamerGoal, goalDisplayValue, goalMetricInfo, goalPlannerIntent, goalTotals, newTamerGoalId, type GoalMetric, type GoalPlannerIntent, type TamerGoal, type TamerGoalsState } from '../utils/tamerGoals'

export interface TamerGoalsProps {
  t: Record<string, string>; lang: Lang; sealStates: SealStateMap; progress: DUnitProgress;
  state: TamerGoalsState; blocked?: boolean; save: (state: TamerGoalsState) => void;
  plan: (intent: GoalPlannerIntent) => void; viewSet: (id: string) => void;
}
export function TamerGoals({ t, lang, sealStates, progress, state, blocked, save, plan, viewSet }: TamerGoalsProps) {
  const totals = useMemo(() => goalTotals(sealStates, progress), [sealStates, progress])
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<string | null>(null)
  const [type, setType] = useState<'attribute' | 'dunit-set'>('attribute'), [system, setSystem] = useState<'seals' | 'dunit'>('seals')
  const [metricIndex, setMetricIndex] = useState(''), [draft, setDraft] = useState(''), [setId, setSetId] = useState(''), [query, setQuery] = useState(''), [message, setMessage] = useState('')
  const metrics = useMemo<GoalMetric[]>(() => system === 'seals' ? mainProgressionAttributes.map(attribute => ({ system, attribute })) : [...mainProgressionAttributes, ...otherProgressionAttributes].flatMap(objective => progressionDUnitOptions(objective).map(option => ({ system, bonusKey: option.key }))), [system])
  const existing = state.goals.find(goal => goal.id === editing)
  const metric = existing?.type === 'attribute' ? existing.metric : metrics[Number(metricIndex)]
  const info = metric && goalMetricInfo(metric)
  const locale = { pt:'pt-BR', en:'en-US', es:'es', ko:'ko-KR' }[lang]
  const format = (metric: GoalMetric, value: number) => `${goalDisplayValue(metric, value).toLocaleString(locale, { maximumFractionDigits: 2 })}${goalMetricInfo(metric)?.unit === 'percent' ? '%' : ''}`
  const label = (metric: GoalMetric) => {
    const info = goalMetricInfo(metric)
    if (!info) return t.tgUnavailable
    const key = progressionObjectiveLabelKey(info.objective)
    return [key ? t[key] : info.objective, info.qualifier ? t[progressionSubtypeLabelKey(info.qualifier)] ?? info.qualifier : '', info.unit === 'percent' ? '(%)' : `(${t.ppPoints})`].filter(Boolean).join(' ')
  }
  const start = () => { setType('attribute'); setEditing(null); setMetricIndex(''); setDraft(''); setSetId(''); setQuery(''); setMessage(''); setOpen(true) }
  const submit = () => {
    try {
      if (blocked || !editing && state.goals.length >= 3) throw new Error('Blocked')
      let goal: TamerGoal
      if (editing || type === 'attribute') {
        if (!metric || !info || !editing && metricIndex === '') throw new Error('Metric required')
        const parsed = parseProgressionTarget(draft, info.unit ?? 'absolute', metric.system)
        if (!parsed.ok) throw new Error('Invalid target')
        goal = { id: existing?.id ?? newTamerGoalId(state.goals), type: 'attribute', metric, baseline: existing?.type === 'attribute' ? existing.baseline : currentGoalBonus(metric, totals), desiredGain: parsed.value }
      } else {
        if (!dUnitSets.some(set => set.id === setId)) throw new Error('Set required')
        goal = { id: newTamerGoalId(state.goals), type: 'dunit-set', setId }
      }
      save({ version: 1, goals: editing ? state.goals.map(item => item.id === editing ? goal : item) : [...state.goals, goal] })
      setOpen(false); setMessage(t.tgSaved)
    } catch { setMessage(t.tgError) }
  }
  const remove = (id: string) => {
    if (!window.confirm(t.tgRemoveConfirm)) return
    try { save({ version: 1, goals: state.goals.filter(goal => goal.id !== id) }); if (editing === id) setOpen(false); setMessage(t.tgRemoved) } catch { setMessage(t.tgError) }
  }
  return <section className="tamer-panel tamer-goals" aria-labelledby="tamer-goals-title">
    <h2 id="tamer-goals-title">{t.tgTitle}</h2><p>{t.tgRecorded}</p>
    {blocked ? <p role="alert">{t.tgBlocked}</p> : <><button className="quiet" onClick={start} disabled={state.goals.length >= 3 || open}>{t.tgCreate}</button><small>{t.tgLimit}</small></>}
    {!blocked && state.goals.length === 0 && <p>{t.tgEmpty}</p>}
    {message && <p role="status">{message}</p>}
    {open && <form className="tamer-goal-form" onSubmit={event => { event.preventDefault(); submit() }}>
      {!editing && <label>{t.tgType}<select value={type} onChange={event => setType(event.target.value as typeof type)}><option value="attribute">{t.tgAttribute}</option><option value="dunit-set">{t.tgSet}</option></select></label>}
      {!editing && <small>{t.tgAttributeHint}</small>}
      {editing || type === 'attribute' ? <>
        {editing ? <p>{t.tgEditHint}</p> : <><label>{t.tgSystem}<select value={system} onChange={event => { setSystem(event.target.value as typeof system); setMetricIndex(''); setDraft('') }}><option value="seals">Seal Master</option><option value="dunit">D-Unit</option></select></label><label>{t.tgMetric}<select value={metricIndex} onChange={event => { setMetricIndex(event.target.value); setDraft('') }}><option value="">{t.tgChoose}</option>{metrics.map((item, index) => <option key={index} value={index}>{label(item)}</option>)}</select></label></>}
        <label>{t.tgGain}{info ? ` — ${label(metric)}` : ''}<input value={draft} inputMode="decimal" onChange={event => setDraft(event.target.value)} required /></label>
        {info && (editing || metricIndex !== '') && <p>{t.tgBaseline}: {format(metric, existing?.type === 'attribute' ? existing.baseline : currentGoalBonus(metric, totals))}</p>}
      </> : <><label>{t.tgSearch}<input value={query} onChange={event => setQuery(event.target.value)} /></label><label>{t.tgSet}<select value={setId} onChange={event => setSetId(event.target.value)} required><option value="">{t.tgChoose}</option>{dUnitSets.filter(set => set.id === setId || set.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(set => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label></>}
      <div className="tamer-actions"><button className="primary" type="submit">{t.tgSave}</button><button className="quiet" type="button" onClick={() => setOpen(false)}>{t.tgCancel}</button></div>
    </form>}
    <div className="tamer-goal-list">{state.goals.map(goal => {
      const result = deriveTamerGoal(goal, totals, progress)
      const title = goal.type === 'attribute' ? `${t.tgAttribute}: +${format(goal.metric, goal.desiredGain)} ${label(goal.metric)}` : dUnitSets.find(set => set.id === goal.setId)?.name ?? t.tgUnavailable
      const intent = goalPlannerIntent(goal, totals, progress)
      return <article className="tamer-goal-card" key={goal.id}>
        <h3>{title}</h3><small>{goal.type === 'attribute' && goal.metric.system === 'seals' ? 'Seal Master' : 'D-Unit'}</small>
        <b>{!result ? t.tgUnavailable : result.complete ? t.tgComplete : t.tgActive}</b>
        {result && <><span>{goal.type === 'attribute' ? `${format(goal.metric, result.done)} / ${format(goal.metric, result.total)}` : `${result.done} / ${result.total} ${t.tgConditions}`}</span><progress aria-label={title} max={result.total} value={result.done} /><span>{t.tgRemaining}: {goal.type === 'attribute' ? format(goal.metric, result.remaining) : result.remaining}</span></>}
        <div className="tamer-actions">{goal.type === 'attribute' ? <><button className="quiet" disabled={!intent} onClick={() => intent && plan(intent)}>{t.tgPlan}</button><button className="quiet" disabled={blocked || !result} onClick={() => { setEditing(goal.id); setDraft(String(goalDisplayValue(goal.metric, goal.desiredGain))); setMessage(''); setOpen(true) }}>{t.tgEdit}</button></> : <button className="quiet" disabled={!result} onClick={() => viewSet(goal.setId)}>{t.tgView}</button>}<button className="quiet" disabled={blocked} onClick={() => remove(goal.id)}>{t.tgRemove}</button></div>
      </article>
    })}</div>
  </section>
}
