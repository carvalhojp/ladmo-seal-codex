import { useMemo, useRef, useState } from 'react'
import { seals } from '../data/seals'
import type { Attribute } from '../types'
import { formatValue, levelFor } from '../utils/calculations'
import { optimizeGoal, optimizeGoalWithTicketLimit, type GoalPlan, type GoalStrategy, type SealProgressInput, type TicketBudgetResult } from '../utils/goalOptimizer'
import { getSealState, toOwnedSeals, type SealStateMap } from '../utils/sealState'
import { calculateAttributeTotals } from '../utils/dashboard'
import { parseProgressionBudget, parseProgressionTarget, progressionText, progressionUnit } from '../utils/progressionPlanner'
import { localizedSealName } from '../data/localizedSealNames'
import type { Lang } from '../App'

export const goalPlannerRegistrationTab = 'codex'
export function createGoalPlanSnapshot(attribute: Attribute, goal: number, mode: GoalStrategy, progressById: Record<string, SealProgressInput>): GoalPlan | null {
  return optimizeGoal(attribute, goal, seals, progressById, mode)
}
type PlannerStrategy = GoalStrategy | 'ticketLimit'
interface DisplaySnapshot extends TicketBudgetResult { attribute: Attribute; goal: number; ticketBudget?: number; source:SealStateMap; draft:string; mode:PlannerStrategy; budgetDraft:string }

export function GoalPlanner({t,lang,attribute,sealStates,go,addRecommendation,ticketBudget:initialTicketBudget,initialDraft}:{
  initialDraft?:string;
  t:Record<string,string>;lang:Lang;attribute:Attribute;sealStates:SealStateMap;go:(tab:'codex')=>void;
  addRecommendation:(sealId:string,additionalQuantity:number)=>void;ticketBudget?:number;
}) {
  const [draft,setDraft]=useState(initialDraft??'')
  const [mode,setMode]=useState<PlannerStrategy>('cheap')
  const [budgetDraft,setBudgetDraft]=useState(String(Math.max(0,Math.trunc(initialTicketBudget??0))))
  const [snapshot,setSnapshot]=useState<DisplaySnapshot|null>(null)
  const [invalidated,setInvalidated]=useState(false)
  const [confirmation,setConfirmation]=useState('')
  const [attempted,setAttempted]=useState(false)
  const [stale,setStale]=useState(false)
  const inputRef=useRef<HTMLInputElement>(null),budgetRef=useRef<HTMLInputElement>(null),statusRef=useRef<HTMLDivElement>(null)
  const pendingAdditions=useRef(new Set<string>())
  const unit=progressionUnit(attribute,'seals')
  const parsed=parseProgressionTarget(draft,unit,'seals'),budget=parseProgressionBudget(budgetDraft)
  const locale={pt:'pt-BR',en:'en-US',es:'es',ko:'ko-KR'}[lang]
  const number=(value:number)=>value.toLocaleString(locale)
  const unitLabel=`${attribute} (${unit==='percent'?'%':t.ppPoints})`
  const invalidate=()=>{if(snapshot){setInvalidated(true);setSnapshot(null)}}
  const currentSnapshot=snapshot&&snapshot.attribute===attribute&&snapshot.draft===draft&&snapshot.mode===mode&&snapshot.budgetDraft===budgetDraft?snapshot:null
  const outdated=Boolean(currentSnapshot&&(stale||currentSnapshot.source!==sealStates))
  const start=useMemo(()=>{
    const owned=toOwnedSeals(sealStates)
    return {bonus:calculateAttributeTotals(owned,seals)[attribute],count:owned.filter(item=>{const seal=seals.find(s=>s.id===item.sealId);return seal?.attribute===attribute&&Boolean(levelFor(item.quantity,seal))}).length}
  },[attribute,sealStates])
  const strategyHelp={cheap:t.ppCheapHelp,openers:t.ppOpenersHelp,value:t.ppBalancedHelp,ticketLimit:t.ppLimitHelp}[mode]
  const calculate=()=>{
    setAttempted(true)
    if(!parsed.ok){inputRef.current?.focus();return}
    if(mode==='ticketLimit'&&budget===null){budgetRef.current?.focus();return}
    const progressById=Object.fromEntries(seals.map(seal=>{const current=getSealState(sealStates,seal.id);return [seal.id,{quantity:current.quantity,doNotRecommend:current.doNotRecommend}]}))
    const result=mode==='ticketLimit'?optimizeGoalWithTicketLimit(attribute,parsed.value,seals,progressById,budget!):{plan:createGoalPlanSnapshot(attribute,parsed.value,mode,progressById),bestWithinBudget:null,additionalTicketsNeeded:null}
    setSnapshot({...result,attribute,goal:parsed.value,ticketBudget:mode==='ticketLimit'?budget!:undefined,source:sealStates,draft,mode,budgetDraft})
    setStale(false);setInvalidated(false);setConfirmation('');pendingAdditions.current.clear()
  }
  const register=(id:string,destination:number)=>{
    if(!currentSnapshot||pendingAdditions.current.has(id))return
    const remaining=Math.max(0,destination-getSealState(sealStates,id).quantity)
    if(!remaining)return
    pendingAdditions.current.add(id);setStale(true);setConfirmation('ppRegistered');addRecommendation(id,remaining)
  }
  return <section className="progression-system" aria-label="Seal Master">
    <div className="progression-start"><h2>{t.ppStart} · Seal Master</h2><p>{t.ppRecorded}</p><dl><div><dt>{t.ppCurrent}</dt><dd>{formatValue(start.bonus,attribute,locale)}</dd></div><div><dt>{t.ppContributing}</dt><dd>{number(start.count)}</dd></div></dl>{!start.count&&<p>{t.ppNone}</p>}<button className="quiet" onClick={()=>go('codex')}>{t.ppUpdateSeals}</button></div>
    <div ref={statusRef} tabIndex={-1} role="status" className="progression-status">{confirmation&&t[confirmation]}{invalidated&&<p>{t.ppRecalculate}</p>}</div>
    <section className="planner">
      <form className="control-panel" noValidate onSubmit={event=>{event.preventDefault();calculate()}}>
        <label htmlFor="seal-target">{progressionText(t.ppTarget,{attribute:unitLabel})}</label>
        <input id="seal-target" ref={inputRef} type="text" inputMode={unit==='percent'?'decimal':'numeric'} value={draft} placeholder={unit==='percent'?'1,25':'500'} aria-invalid={!parsed.ok&&(attempted||Boolean(draft))} aria-describedby="seal-target-help seal-target-error" onChange={event=>{invalidate();setDraft(event.target.value)}}/>
        <small id="seal-target-help">{unitLabel}{unit==='percent'&&` · ${t.ppPercentHint}`}</small>
        <small id="seal-target-error" className="progression-error">{!parsed.ok&&(attempted||Boolean(draft))?t[parsed.error]:''}</small>
        <label htmlFor="seal-strategy">{t.strategy}</label><select id="seal-strategy" value={mode} onChange={event=>{invalidate();setMode(event.target.value as PlannerStrategy)}}><option value="cheap">{t.ppCheap}</option><option value="openers">{t.ppOpeners}</option><option value="value">{t.ppBalanced}</option><option value="ticketLimit">{t.ppLimit}</option></select>
        <small>{strategyHelp}</small>{(mode==='openers'||mode==='value')&&<details><summary>{t.details}</summary><small>{t.ppWeightHelp}</small></details>}
        {mode==='ticketLimit'&&<><label htmlFor="seal-budget">{t.ppBudget}</label><input id="seal-budget" ref={budgetRef} type="text" inputMode="numeric" value={budgetDraft} aria-describedby="seal-budget-help seal-budget-error" aria-invalid={budget===null} onChange={event=>{invalidate();setBudgetDraft(event.target.value)}}/><small id="seal-budget-help">{t.ppBudgetHelp}</small><small id="seal-budget-error" className="progression-error">{budget===null?t.ppBudgetError:''}</small></>}
        <button type="submit" className="primary calculate-route">{t.ppCalculateSeal}</button>
      </form>
      <div className="plan-output" aria-live="polite"><span className="eyebrow">{t.ppRoute}</span>
        {outdated&&<div className="progression-status" role="status"><b>{t.ppProgressUpdated}</b><p>{t.ppSealStale}</p><button className="quiet" onClick={calculate}>{t.ppRecalculateSeal}</button></div>}
        {!currentSnapshot?<div className="empty">{t.ppReady}</div>:currentSnapshot.plan?<>
          <h2>{progressionText(t.ppSuccess,{gain:formatValue(currentSnapshot.plan.totalBonus,attribute,locale),target:formatValue(currentSnapshot.goal,attribute,locale)})}</h2>
          <div className="plan-stats"><span>{t.ppTickets}: {number(currentSnapshot.plan.totalTickets)}</span><span>{t.newSeals}: {number(currentSnapshot.plan.totalAdditionalSeals)}</span><span>{t.ppOpenersNeeded}: {number(currentSnapshot.plan.totalOpeners)}</span></div><p>{t.ppOpenersNotice}</p>
          {currentSnapshot.ticketBudget!==undefined&&<div className="plan-stats"><span>{t.ppBudgetDeclared}: {number(currentSnapshot.ticketBudget)}</span><span>{t.ppMargin}: {number(currentSnapshot.ticketBudget-currentSnapshot.plan.totalTickets)}</span></div>}
          <h3>{t.ppUpdate}</h3><p>{t.ppRegisterHelp}</p>
          {currentSnapshot.plan.recommendations.map(item=>{const remaining=Math.max(0,item.finalQuantity-getSealState(sealStates,item.seal.id).quantity),registered=remaining===0||pendingAdditions.current.has(item.seal.id);return <div className="plan-row" key={item.seal.id}><span className={'attr '+attribute}>{attribute}</span><div><b>{localizedSealName(item.seal,lang)}</b><small>{item.levelLabel} · {t.current}: {number(item.finalQuantity-item.additionalSeals)} · {t.destination}: {number(item.finalQuantity)} · {t.needed}: {number(item.additionalSeals)} · {t.gain} {formatValue(item.bonusGain,attribute,locale)}</small></div><strong>{number(item.tickets)} <small>{t.tickets} · {number(item.openers)} OP</small></strong><button className="quiet recommendation-add" disabled={registered} onClick={()=>register(item.seal.id,item.finalQuantity)}>{registered?`✓ ${t.ppStepRegistered}`:progressionText(t.ppRegister,{quantity:number(remaining)})}</button></div>})}
        </>:<div className="empty">{currentSnapshot.ticketBudget!==undefined?<><p>{t.ppBudgetInsufficient}</p>{currentSnapshot.bestWithinBudget&&<p>{progressionText(t.ppPartial,{gain:formatValue(currentSnapshot.bestWithinBudget.totalBonus,attribute,locale)})}</p>}{currentSnapshot.additionalTicketsNeeded!==null&&<p>{t.additionalTicketsNeeded}: {number(currentSnapshot.additionalTicketsNeeded)}</p>}</>:t.ppSealInsufficient}</div>}
      </div>
    </section>
  </section>
}
