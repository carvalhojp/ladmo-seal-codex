import { useState } from 'react'
import type { Lang } from '../App'
import { dUnitSets } from '../data/dUnitAudit'
import { localizedSealName } from '../data/localizedSealNames'
import { formatValue } from '../utils/calculations'
import type { DUnitProgress } from '../utils/dUnit'
import { goalRecommendations } from '../utils/goalRecommendations'
import { progressionObjectiveLabelKey, progressionSubtypeLabelKey } from '../utils/progressionPlanner'
import type { SealStateMap } from '../utils/sealState'
import { goalDisplayValue, goalMetricInfo, type TamerGoal } from '../utils/tamerGoals'

const locales = { pt:'pt-BR', en:'en-US', es:'es', ko:'ko-KR' }
export function planningGoalLabel(goal:TamerGoal,t:Record<string,string>,lang:Lang) {
  if(goal.type==='dunit-set')return dUnitSets.find(set=>set.id===goal.setId)?.name??t.pvUnknown
  const info=goalMetricInfo(goal.metric)
  if(!info)return t.pvUnknown
  const attribute=t[progressionObjectiveLabelKey(info.objective)??'']??info.objective
  const qualifier=info.qualifier?(t[progressionSubtypeLabelKey(info.qualifier)]??info.qualifier):''
  const unit=info.unit==='percent'?'%':t.ppPoints
  return `${goal.metric.system==='seals'?'Seal Master':'D-Unit'} · ${[attribute,qualifier].filter(Boolean).join(' ')} (${unit}) · +${goalDisplayValue(goal.metric,goal.desiredGain).toLocaleString(locales[lang],{maximumFractionDigits:2})}`
}

export function GoalRecommendations({goal,t,lang,sealStates,progress,go,viewSet}:{
  goal:TamerGoal;t:Record<string,string>;lang:Lang;sealStates:SealStateMap;progress:DUnitProgress;
  go:(tab:'codex'|'dunit'|'tamer')=>void;viewSet?:(id:string)=>void;
}) {
  const [limits,setLimits]=useState({started:6,other:6})
  const options=goalRecommendations(goal,sealStates,progress),result=options.result
  const locale=locales[lang],number=(value:number)=>value.toLocaleString(locale,{maximumFractionDigits:2})
  const info=goal.type==='attribute'?goalMetricInfo(goal.metric):null
  const value=(amount:number)=>goal.type==='attribute'?`${number(goalDisplayValue(goal.metric,amount))}${info?.unit==='percent'?'%':` ${t.ppPoints}`}`:`${number(amount)} ${t.tgConditions}`
  const conditions=(items:typeof options.sets[number]['matchingConditions'])=><ul className="tamer-next-list">{items.map(({condition,completed})=><li key={condition.id}>
    <b>{completed?'✓':'○'} {condition.requirement}</b><span>{condition.bonus.rawLabel}{(!condition.confirmed||!condition.bonus.confirmed||condition.bonus.value===null||condition.bonus.unit===null)&&` · ${t.pvUnknown}`}</span><span>{completed?t.ppStepDone:t.pvPending}</span>
  </li>)}</ul>
  return <section className="tamer-panel progression-goal-summary" aria-label={t.pvGoal}>
    <h2>{planningGoalLabel(goal,t,lang)}</h2><p>{t.ppRecorded}</p>
    {!result?<p role="status">{t.pvUnknownDetail}</p>:<>
      <dl className="tamer-stats"><div><dt>{t.pvTarget}</dt><dd>{value(goal.type==='attribute'?goal.baseline+goal.desiredGain:result.total)}</dd></div><div><dt>{t.ppCurrent}</dt><dd>{value(result.current)}</dd></div><div><dt>{t.tgRemaining}</dt><dd>{value(result.remaining)}</dd></div></dl>
      <p>{result.complete?t.tgComplete:t.tgActive} · {value(result.done)} / {value(result.total)}</p>
      {!result.complete&&<>
        <p>{t.pvOptionsNotice}</p>
        {goal.type==='attribute'&&goal.metric.system==='seals'?<p>{t.pvOpenersNotice}</p>:<p>{t.pvCostNotice}</p>}
        {[true,false].map(started=>{
          const key=started?'started':'other',sealOptions=options.seals.filter(item=>item.started===started),sets=options.sets.filter(item=>item.started===started)
          const total=sealOptions.length+sets.length,limit=limits[key]
          return <section key={key} aria-label={started?t.pvNext:t.pvOther}><h3>{started?t.pvNext:t.pvOther}</h3>
            {!total?<p>{t.ppNoOptions}</p>:<details className="tamer-details" open={started}>
              <summary>{t.pvShowOptions} ({total})</summary><p>{t.pvShowing}: {Math.min(total,limit)} / {total}</p>
              <div className="tamer-goal-list">{sealOptions.slice(0,limit).map(item=><article className="tamer-goal-card" key={item.seal.id}>
                <h3>{localizedSealName(item.seal,lang)}</h3><strong>{t.gain}: {formatValue(item.bonusGain,item.seal.attribute,locale)}</strong>
                <span>{t.current}: {number(item.quantity)} · {t.destination}: {number(item.finalQuantity)} ({item.levelLabel})</span>
                <span>{t.newSeals}: {number(item.additionalSeals)}</span><span>{t.ppTickets}: {number(item.tickets)} · {t.ppOpenersNeeded}: {number(item.openers)}</span>
                <button className="quiet" onClick={()=>go('codex')}>{t.ppUpdateSeals}</button>
              </article>)}{sets.slice(0,limit).map(item=><article className="tamer-goal-card" key={item.set.id}>
                <h3>{item.set.name}</h3><span>{item.done}/{item.set.conditions.length} {t.tgConditions}</span>
                {goal.type==='attribute'&&<strong>{t.pvPendingGain}: {item.pendingGain===null?t.pvUnknown:`+${value(item.pendingGain)}`}</strong>}
                <details><summary>{t.details}</summary><h4>{goal.type==='dunit-set'?t.tgConditions:t.pvMatching}</h4>{conditions(item.matchingConditions)}
                  {item.otherConditions.length>0&&<><h4>{t.pvOtherConditions}</h4><p>{t.pvOtherHint}</p>{conditions(item.otherConditions)}</>}
                </details><button className="quiet" onClick={()=>viewSet?viewSet(item.set.id):go('dunit')}>{t.tgView}</button>
              </article>)}</div>
              {limit<total&&<button className="quiet" onClick={()=>setLimits(previous=>({...previous,[key]:previous[key]+6}))}>{t.pvMore}</button>}
            </details>}
          </section>
        })}
      </>}
    </>}
  </section>
}
