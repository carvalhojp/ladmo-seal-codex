import { useEffect, useMemo, useRef, useState } from 'react'
import type { GoalPlannerIntent } from '../utils/tamerGoals'
import type { Lang } from '../App'
import type { Attribute } from '../types'
import type { SealStateMap } from '../utils/sealState'
import { dUnitPlayerStateFromInventory, type DUnitInventory, type DUnitProgress } from '../utils/dUnit'
import { mainProgressionAttributes, otherProgressionAttributes, progressionObjectiveLabelKey, progressionSystems, progressionUnit, type ProgressionObjective, type ProgressionSystem } from '../utils/progressionPlanner'
import { PageHead } from './PageHead'
import { GoalPlanner } from './GoalPlanner'
import { DUnitGoalPlanner } from './DUnitGoalPlanner'

export const progressionPlannerTab='goal'
export function ProgressionPlanner({t,lang,sealStates,progress,inventory,ticketBudget,go,addRecommendation,toggle,intent,consumeIntent,navigation}:{
  navigation?:{objective:ProgressionObjective|'';system:ProgressionSystem|null;go:(objective:ProgressionObjective|'',system:ProgressionSystem|null,replace?:boolean)=>void};
  intent?:GoalPlannerIntent|null;consumeIntent?:()=>void;
  t:Record<string,string>;lang:Lang;sealStates:SealStateMap;progress:DUnitProgress;inventory:DUnitInventory;ticketBudget:number;
  go:(tab:'codex'|'dunit'|'tamer')=>void;addRecommendation:(id:string,quantity:number)=>void;toggle:(setId:string,conditionId:string,checked:boolean)=>void;
}) {
  const [localObjective,setObjective]=useState<ProgressionObjective|''>('')
  const [localSystem,setSystem]=useState<ProgressionSystem|null>(null)
  const objective=navigation?navigation.objective:localObjective
  const system=navigation?navigation.system:localSystem
  const consumed=useRef<GoalPlannerIntent|null>(null)
  const [prefill,setPrefill]=useState<(GoalPlannerIntent & { sequence:number })|null>(null)
  useEffect(()=>{
    if(!intent||consumed.current===intent)return
    consumed.current=intent
    setObjective(intent.objective);setSystem(intent.system)
    setPrefill(previous=>({...intent,sequence:(previous?.sequence??0)+1}))
    consumeIntent?.()
  },[intent,consumeIntent])
  const playerState=useMemo(()=>dUnitPlayerStateFromInventory(inventory),[inventory])
  const systems=progressionSystems(objective)
  const label=(value:ProgressionObjective)=>{const key=progressionObjectiveLabelKey(value);return key?t[key]:value}
  const choose=(value:ProgressionObjective|'')=>{setPrefill(null);setObjective(value);const compatible=progressionSystems(value);const next=compatible.length===1?compatible[0]:null;setSystem(next);navigation?.go(value,next,true)}
  return <div className="progression-planner">
    <PageHead eyebrow="LADMO CODEX" title={t.ppTitle} text={t.ppIntro}/>
    <section className="progression-objective"><label htmlFor="progression-objective">{t.ppObjective}</label><select id="progression-objective" value={objective} onChange={event=>choose(event.target.value as ProgressionObjective|'')}><option value="">{t.ppChoose}</option><optgroup label={t.ppMain}>{mainProgressionAttributes.map(value=><option key={value} value={value}>{value}</option>)}</optgroup><optgroup label={t.ppOther}>{otherProgressionAttributes.map(value=><option key={value} value={value}>{label(value)}</option>)}</optgroup></select><p>{t.ppSimulation}</p><button className="quiet" onClick={()=>go('tamer')}>{t.ppView}</button></section>
    {objective&&<><section className="progression-paths"><h2>{t.ppPaths}</h2><p>{t.ppSeparate}</p><div className="subtabs">{systems.map(value=><button key={value} aria-pressed={system===value} className={system===value?'active':''} onClick={()=>{setSystem(value);navigation?.go(objective,value)}}>{value==='seals'?'Seal Master':'D-Unit'} · {label(objective)} ({progressionUnit(objective,value)==='percent'?'%':t.ppPoints})</button>)}</div></section>
      <div key={prefill?`${objective}:${prefill.sequence}`:objective}>
        {systems.includes('seals')&&<div hidden={system!=='seals'}><GoalPlanner initialDraft={prefill?.objective===objective&&prefill.system==='seals'?prefill.draft:undefined} t={t} lang={lang} attribute={objective as Attribute} sealStates={sealStates} go={go} addRecommendation={addRecommendation} ticketBudget={ticketBudget}/></div>}
        <div hidden={system!=='dunit'}><DUnitGoalPlanner initialDraft={prefill?.objective===objective&&prefill.system==='dunit'?prefill.draft:undefined} initialBonusKey={prefill?.objective===objective&&prefill.system==='dunit'?prefill.bonusKey:undefined} t={t} lang={lang} objective={objective} progress={progress} toggle={toggle} playerState={playerState} go={()=>go('dunit')}/></div>
      </div>
    </>}
  </div>
}
