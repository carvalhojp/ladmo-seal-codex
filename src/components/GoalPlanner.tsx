import { useEffect, useMemo, useRef, useState } from 'react'
import { seals } from '../data/seals'
import type { Attribute } from '../types'
import { formatValue, levelFor, maxSealsFor } from '../utils/calculations'
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

export interface SealRouteConfirmation {
  prepare: (before: SealStateMap, after: SealStateMap) => boolean;
  saved: (before: SealStateMap, after: SealStateMap) => boolean;
  failed: () => void;
}

interface PendingRouteConfirmation {
  snapshot: DisplaySnapshot;
  before: SealStateMap;
  after: SealStateMap;
  attribute: Attribute;
  target: number | undefined;
}

function isSingleSealConfirmation(before: SealStateMap, after: SealStateMap, id: string): boolean {
  const seal=seals.find(item=>item.id===id)
  if(!seal||!after[id])return false
  const previous=getSealState(before,id),next=after[id]
  if(
    !Number.isSafeInteger(next.quantity)||next.quantity<0||next.quantity>maxSealsFor(seal)||
    next.hasSeal!==(next.quantity>0||previous.hasSeal)||
    next.doNotRecommend!==previous.doNotRecommend
  )return false
  // Existing updates preserve all untouched records' identities.
  return [...new Set([...Object.keys(before),...Object.keys(after)])]
    .every(key=>key===id||before[key]===after[key])
}

export function GoalPlanner({t,lang,attribute,sealStates,go,addRecommendation,ticketBudget:initialTicketBudget,initialDraft,goalDraft,goalTarget,editSeal}:{
  initialDraft?:string;
  goalDraft?:string;
  goalTarget?:number;
  editSeal?:(id:string,destination:number,confirmation?:SealRouteConfirmation)=>void;
  t:Record<string,string>;lang:Lang;attribute:Attribute;sealStates:SealStateMap;go:(tab:'codex')=>void;
  addRecommendation:(sealId:string,additionalQuantity:number,confirmation?:SealRouteConfirmation)=>void;ticketBudget?:number;
}) {
  const [draft,setDraft]=useState(goalDraft??initialDraft??'')
  const [mode,setMode]=useState<PlannerStrategy>('cheap')
  const [budgetDraft,setBudgetDraft]=useState(String(Math.max(0,Math.trunc(initialTicketBudget??0))))
  const [snapshot,setSnapshot]=useState<DisplaySnapshot|null>(null)
  const [invalidated,setInvalidated]=useState(false)
  const [confirmation,setConfirmation]=useState('')
  const [attempted,setAttempted]=useState(false)
  const [stale,setStale]=useState(false)
  const inputRef=useRef<HTMLInputElement>(null),budgetRef=useRef<HTMLInputElement>(null),statusRef=useRef<HTMLDivElement>(null)
  const pendingAdditions=useRef(new Set<string>())
  const [goalContext,setGoalContext]=useState({attribute,draft:goalDraft,target:goalTarget})
  const manuallyEdited=useRef(false)
  const [goalConflict,setGoalConflict]=useState(false)
  const mounted=useRef(false)
  const pendingConfirmation=useRef<PendingRouteConfirmation|null>(null)
  const [awaitingConfirmation,setAwaitingConfirmation]=useState(false)
  const ownsTransition=Boolean(
    snapshot&&pendingConfirmation.current&&
    snapshot===pendingConfirmation.current.snapshot&&
    sealStates===pendingConfirmation.current.after&&
    attribute===pendingConfirmation.current.attribute&&
    goalTarget===pendingConfirmation.current.target&&
    snapshot.attribute===attribute&&snapshot.draft===draft&&
    snapshot.mode===mode&&snapshot.budgetDraft===budgetDraft
  )
  const contextChanged=goalDraft!==undefined&&(
    goalContext.attribute!==attribute||
    goalContext.draft!==goalDraft||goalContext.target!==goalTarget
  )
  const requiresReconciliation=(!ownsTransition&&contextChanged)||goalConflict
  const live=useRef({snapshot,sealStates,attribute,goalDraft,goalTarget,draft,mode,budgetDraft,requiresReconciliation})

  useEffect(()=>{
    mounted.current=true
    return ()=>{mounted.current=false;pendingConfirmation.current=null}
  },[])
  // Publish committed context before rejection/synchronization and App's effects.
  useEffect(()=>{
    live.current={snapshot,sealStates,attribute,goalDraft,goalTarget,draft,mode,budgetDraft,requiresReconciliation}
  })
  useEffect(()=>{
    if(!awaitingConfirmation||ownsTransition)return
    pendingConfirmation.current=null
    setAwaitingConfirmation(false)
    setSnapshot(null)
    setInvalidated(true)
    setConfirmation('')
    pendingAdditions.current.clear()
  },[awaitingConfirmation,ownsTransition])

  useEffect(()=>{
    if(goalDraft===undefined)return
    if(ownsTransition)return
    if(goalContext.attribute===attribute&&goalContext.draft===goalDraft&&goalContext.target===goalTarget)return
    pendingConfirmation.current=null
    setAwaitingConfirmation(false)
    setGoalContext({attribute,draft:goalDraft,target:goalTarget})
    setSnapshot(null)
    setInvalidated(true)
    setAttempted(false)
    setConfirmation('')
    setStale(false)
    pendingAdditions.current.clear()
    if(manuallyEdited.current){
      setGoalConflict(true)
    }else{
      setDraft(goalDraft)
      setGoalConflict(false)
    }
  },[attribute,goalDraft,goalTarget,ownsTransition])
  const unit=progressionUnit(attribute,'seals')
  const parsed=parseProgressionTarget(draft,unit,'seals'),budget=parseProgressionBudget(budgetDraft)
  const locale={pt:'pt-BR',en:'en-US',es:'es',ko:'ko-KR'}[lang]
  const number=(value:number)=>value.toLocaleString(locale)
  const unitLabel=`${attribute} (${unit==='percent'?'%':t.ppPoints})`
  const invalidate=()=>{
    pendingConfirmation.current=null
    setAwaitingConfirmation(false)
    if(snapshot){setInvalidated(true);setSnapshot(null)}
  }
  const currentSnapshot=!requiresReconciliation&&snapshot&&snapshot.attribute===attribute&&snapshot.draft===draft&&snapshot.mode===mode&&snapshot.budgetDraft===budgetDraft?snapshot:null
  const outdated=Boolean(currentSnapshot&&(awaitingConfirmation||stale||currentSnapshot.source!==sealStates))
  const routeConfirmation=(id:string):SealRouteConfirmation=>{
    const original=currentSnapshot
    let prepared:PendingRouteConfirmation|null=null
    return {
      prepare:(before,after)=>{
        const current=live.current
        if(
          !mounted.current||!original||pendingConfirmation.current||
          current.snapshot!==original||current.requiresReconciliation||
          current.attribute!==original.attribute||current.goalTarget!==goalTarget||
          current.draft!==original.draft||current.mode!==original.mode||
          current.budgetDraft!==original.budgetDraft||current.sealStates!==before||
          original.source!==before||
          !original.plan?.recommendations.some(item=>item.seal.id===id)||
          !isSingleSealConfirmation(before,after,id)
        )return false
        prepared={snapshot:original,before,after,attribute:current.attribute,target:current.goalTarget}
        pendingConfirmation.current=prepared
        setAwaitingConfirmation(true)
        return true
      },
      saved:(before,after)=>{
        const current=live.current
        if(
          !mounted.current||!original||!prepared||pendingConfirmation.current!==prepared||
          prepared.before!==before||prepared.after!==after||current.sealStates!==after||
          current.snapshot!==original||current.attribute!==prepared.attribute||
          current.goalTarget!==prepared.target||current.draft!==original.draft||
          current.mode!==original.mode||current.budgetDraft!==original.budgetDraft
        )return false
        const nextDraft=manuallyEdited.current?current.draft:current.goalDraft??current.draft
        setSnapshot({...original,source:after,draft:nextDraft})
        setDraft(nextDraft)
        setGoalContext({attribute:current.attribute,draft:current.goalDraft,target:current.goalTarget})
        const destination=original.plan!.recommendations.find(item=>item.seal.id===id)!.finalQuantity
        if(getSealState(after,id).quantity>=destination)pendingAdditions.current.add(id)
        else pendingAdditions.current.delete(id)
        pendingConfirmation.current=null
        setAwaitingConfirmation(false)
        setGoalConflict(false)
        setStale(false)
        setInvalidated(false)
        setAttempted(false)
        setConfirmation('ppRegistered')
        return true
      },
      failed:()=>{
        if(!mounted.current||!original||live.current.snapshot!==original||
          (pendingConfirmation.current&&pendingConfirmation.current!==prepared))return
        pendingConfirmation.current=null
        setAwaitingConfirmation(false)
        setSnapshot(null)
        setInvalidated(true)
        setConfirmation('')
        setStale(false)
        pendingAdditions.current.clear()
      },
    }
  }
  const start=useMemo(()=>{
    const owned=toOwnedSeals(sealStates)
    return {bonus:calculateAttributeTotals(owned,seals)[attribute],count:owned.filter(item=>{const seal=seals.find(s=>s.id===item.sealId);return seal?.attribute===attribute&&Boolean(levelFor(item.quantity,seal))}).length}
  },[attribute,sealStates])
  const strategyHelp={cheap:t.ppCheapHelp,openers:t.ppOpenersHelp,value:t.ppBalancedHelp,ticketLimit:t.ppLimitHelp}[mode]
  const calculate=()=>{
    if(requiresReconciliation||awaitingConfirmation)return
    setAttempted(true)
    if(!parsed.ok){inputRef.current?.focus();return}
    if(mode==='ticketLimit'&&budget===null){budgetRef.current?.focus();return}
    const progressById=Object.fromEntries(seals.map(seal=>{const current=getSealState(sealStates,seal.id);return [seal.id,{quantity:current.quantity,doNotRecommend:current.doNotRecommend}]}))
    const result=mode==='ticketLimit'?optimizeGoalWithTicketLimit(attribute,parsed.value,seals,progressById,budget!):{plan:createGoalPlanSnapshot(attribute,parsed.value,mode,progressById),bestWithinBudget:null,additionalTicketsNeeded:null}
    pendingConfirmation.current=null
    setSnapshot({...result,attribute,goal:parsed.value,ticketBudget:mode==='ticketLimit'?budget!:undefined,source:sealStates,draft,mode,budgetDraft})
    setStale(false);setInvalidated(false);setConfirmation('');pendingAdditions.current.clear()
  }
  const register=(id:string,destination:number)=>{
    if(!currentSnapshot||pendingAdditions.current.has(id))return
    const remaining=Math.max(0,destination-getSealState(sealStates,id).quantity)
    if(!remaining)return
    if(goalDraft!==undefined){
      if(outdated)return
      addRecommendation(id,remaining,routeConfirmation(id))
      return
    }
    pendingAdditions.current.add(id);setStale(true);setConfirmation('ppRegistered');addRecommendation(id,remaining)
  }
  return <section className="progression-system" aria-label="Seal Master">
    <div className="progression-start"><h2>{t.ppStart} · Seal Master</h2><p>{t.ppRecorded}</p><dl><div><dt>{t.ppCurrent}</dt><dd>{formatValue(start.bonus,attribute,locale)}</dd></div><div><dt>{t.ppContributing}</dt><dd>{number(start.count)}</dd></div></dl>{!start.count&&<p>{t.ppNone}</p>}<button className="quiet" onClick={()=>go('codex')}>{t.ppUpdateSeals}</button></div>
    <div ref={statusRef} tabIndex={-1} role="status" className="progression-status">{confirmation&&t[confirmation]}{invalidated&&<p>{t.ppRecalculate}</p>}</div>
    <section className="planner">
      <form className="control-panel" noValidate onSubmit={event=>{event.preventDefault();calculate()}}>
        {requiresReconciliation&&<div className="progression-status" role="status">
          <p>{t.ppGoalChanged}</p>
          <p>{t.tgRemaining}: {goalDraft} · {unitLabel}</p>
          <div className="tamer-actions">
            <button type="button" className="quiet" disabled={contextChanged} onClick={()=>{
              setSnapshot(null)
              setInvalidated(true)
              setDraft(goalDraft??'')
              manuallyEdited.current=false
              setGoalConflict(false)
              setAttempted(false)
            }}>{t.ppUseGoalRemaining}</button>
            <button type="button" className="quiet" disabled={contextChanged} onClick={()=>{
              setSnapshot(null)
              setInvalidated(true)
              manuallyEdited.current=true
              setGoalConflict(false)
              setAttempted(false)
            }}>{t.ppKeepGoalDraft}</button>
          </div>
        </div>}
        <label htmlFor="seal-target">{progressionText(t.ppTarget,{attribute:unitLabel})}</label>
        <input id="seal-target" ref={inputRef} type="text" inputMode={unit==='percent'?'decimal':'numeric'} value={draft} placeholder={unit==='percent'?'1,25':'500'} aria-invalid={!parsed.ok&&(attempted||Boolean(draft))} aria-describedby="seal-target-help seal-target-error" onChange={event=>{
          invalidate()
          if(goalDraft!==undefined)manuallyEdited.current=true
          setDraft(event.target.value)
        }}/>
        <small id="seal-target-help">{unitLabel}{unit==='percent'&&` · ${t.ppPercentHint}`}</small>
        <small id="seal-target-error" className="progression-error">{!parsed.ok&&(attempted||Boolean(draft))?t[parsed.error]:''}</small>
        <label htmlFor="seal-strategy">{t.strategy}</label><select id="seal-strategy" value={mode} onChange={event=>{invalidate();setMode(event.target.value as PlannerStrategy)}}><option value="cheap">{t.ppCheap}</option><option value="openers">{t.ppOpeners}</option><option value="value">{t.ppBalanced}</option><option value="ticketLimit">{t.ppLimit}</option></select>
        <small>{strategyHelp}</small>{(mode==='openers'||mode==='value')&&<details><summary>{t.details}</summary><small>{t.ppWeightHelp}</small></details>}
        {mode==='ticketLimit'&&<><label htmlFor="seal-budget">{t.ppBudget}</label><input id="seal-budget" ref={budgetRef} type="text" inputMode="numeric" value={budgetDraft} aria-describedby="seal-budget-help seal-budget-error" aria-invalid={budget===null} onChange={event=>{invalidate();setBudgetDraft(event.target.value)}}/><small id="seal-budget-help">{t.ppBudgetHelp}</small><small id="seal-budget-error" className="progression-error">{budget===null?t.ppBudgetError:''}</small></>}
        <button type="submit" className="primary calculate-route" disabled={requiresReconciliation||awaitingConfirmation}>{t.ppCalculateSeal}</button>
      </form>
      <div className="plan-output" aria-live="polite"><span className="eyebrow">{t.ppRoute}</span>
        {outdated&&<div className="progression-status" role="status"><b>{t.ppProgressUpdated}</b><p>{t.ppSealStale}</p><button className="quiet" onClick={calculate}>{t.ppRecalculateSeal}</button></div>}
        {!currentSnapshot?<div className="empty">{t.ppReady}</div>:currentSnapshot.plan?<>
          <h2>{progressionText(t.ppSuccess,{gain:formatValue(currentSnapshot.plan.totalBonus,attribute,locale),target:formatValue(currentSnapshot.goal,attribute,locale)})}</h2>
          <div className="plan-stats"><span>{t.ppTickets}: {number(currentSnapshot.plan.totalTickets)}</span><span>{t.newSeals}: {number(currentSnapshot.plan.totalAdditionalSeals)}</span><span>{t.ppOpenersNeeded}: {number(currentSnapshot.plan.totalOpeners)}</span></div><p>{t.ppOpenersNotice}</p>
          {currentSnapshot.ticketBudget!==undefined&&<div className="plan-stats"><span>{t.ppBudgetDeclared}: {number(currentSnapshot.ticketBudget)}</span><span>{t.ppMargin}: {number(currentSnapshot.ticketBudget-currentSnapshot.plan.totalTickets)}</span></div>}
          <h3>{t.ppUpdate}</h3><p>{t.ppRegisterHelp}</p>
          {currentSnapshot.plan.recommendations.map(item=>{
            const remaining=Math.max(0,item.finalQuantity-getSealState(sealStates,item.seal.id).quantity)
            const registered=remaining===0||pendingAdditions.current.has(item.seal.id)
            return <div className="plan-row" key={item.seal.id}>
              <span className={'attr '+attribute}>{attribute}</span>
              <div><b>{localizedSealName(item.seal,lang)}</b><small>{item.levelLabel} · {t.current}: {number(item.finalQuantity-item.additionalSeals)} · {t.destination}: {number(item.finalQuantity)} · {t.needed}: {number(item.additionalSeals)} · {t.gain} {formatValue(item.bonusGain,attribute,locale)}</small></div>
              <strong>{number(item.tickets)} <small>{t.tickets} · {number(item.openers)} OP</small></strong>
              <button className="quiet recommendation-add" disabled={registered||(goalDraft!==undefined&&outdated)} onClick={()=>register(item.seal.id,item.finalQuantity)}>{registered?`✓ ${t.ppStepRegistered}`:progressionText(t.ppRegister,{quantity:number(remaining)})}</button>
              {editSeal&&<button type="button" className="quiet" data-seal-id={item.seal.id} data-destination={item.finalQuantity} aria-label={`${t.ppUpdateSeals}: ${localizedSealName(item.seal,lang)}`} disabled={outdated} onClick={()=>{
                if(outdated||!currentSnapshot)return
                if(goalDraft!==undefined)editSeal(item.seal.id,item.finalQuantity,routeConfirmation(item.seal.id))
                else editSeal(item.seal.id,item.finalQuantity)
              }}>{t.ppUpdateSeals}</button>}
            </div>
          })}
        </>:<div className="empty">{currentSnapshot.ticketBudget!==undefined?<><p>{t.ppBudgetInsufficient}</p>{currentSnapshot.bestWithinBudget&&<p>{progressionText(t.ppPartial,{gain:formatValue(currentSnapshot.bestWithinBudget.totalBonus,attribute,locale)})}</p>}{currentSnapshot.additionalTicketsNeeded!==null&&<p>{t.additionalTicketsNeeded}: {number(currentSnapshot.additionalTicketsNeeded)}</p>}</>:t.ppSealInsufficient}</div>}
      </div>
    </section>
  </section>
}
