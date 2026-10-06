import { useMemo, useState } from 'react'
import type { Lang } from '../App'
import type { Attribute } from '../types'
import type { SealStateMap } from '../utils/sealState'
import { dUnitPlayerStateFromInventory, type DUnitInventory, type DUnitProgress } from '../utils/dUnit'
import { mainProgressionAttributes, otherProgressionAttributes, progressionObjectiveLabelKey, progressionSystems, progressionUnit, type ProgressionObjective, type ProgressionSystem } from '../utils/progressionPlanner'
import { PageHead } from './PageHead'
import { GoalPlanner } from './GoalPlanner'
import { DUnitGoalPlanner } from './DUnitGoalPlanner'

export const progressionPlannerTab='goal'
export function ProgressionPlanner({t,lang,sealStates,progress,inventory,ticketBudget,go,addRecommendation,toggle}:{
  t:Record<string,string>;lang:Lang;sealStates:SealStateMap;progress:DUnitProgress;inventory:DUnitInventory;ticketBudget:number;
  go:(tab:'codex'|'dunit'|'tamer')=>void;addRecommendation:(id:string,quantity:number)=>void;toggle:(setId:string,conditionId:string,checked:boolean)=>void;
}) {
  const [objective,setObjective]=useState<ProgressionObjective|''>('')
  const [system,setSystem]=useState<ProgressionSystem|null>(null)
  const playerState=useMemo(()=>dUnitPlayerStateFromInventory(inventory),[inventory])
  const systems=progressionSystems(objective)
  const label=(value:ProgressionObjective)=>{const key=progressionObjectiveLabelKey(value);return key?t[key]:value}
  const choose=(value:ProgressionObjective|'')=>{setObjective(value);const compatible=progressionSystems(value);setSystem(compatible.length===1?compatible[0]:null)}
  return <div className="progression-planner">
    <PageHead eyebrow="LADMO CODEX" title={t.ppTitle} text={t.ppIntro}/>
    <section className="progression-objective"><label htmlFor="progression-objective">{t.ppObjective}</label><select id="progression-objective" value={objective} onChange={event=>choose(event.target.value as ProgressionObjective|'')}><option value="">{t.ppChoose}</option><optgroup label={t.ppMain}>{mainProgressionAttributes.map(value=><option key={value} value={value}>{value}</option>)}</optgroup><optgroup label={t.ppOther}>{otherProgressionAttributes.map(value=><option key={value} value={value}>{label(value)}</option>)}</optgroup></select><p>{t.ppSimulation}</p><button className="quiet" onClick={()=>go('tamer')}>{t.ppView}</button></section>
    {objective&&<><section className="progression-paths"><h2>{t.ppPaths}</h2><p>{t.ppSeparate}</p><div className="subtabs">{systems.map(value=><button key={value} aria-pressed={system===value} className={system===value?'active':''} onClick={()=>setSystem(value)}>{value==='seals'?'Seal Master':'D-Unit'} · {label(objective)} ({progressionUnit(objective,value)==='percent'?'%':t.ppPoints})</button>)}</div></section>
      <div key={objective}>
        {systems.includes('seals')&&<div hidden={system!=='seals'}><GoalPlanner t={t} lang={lang} attribute={objective as Attribute} sealStates={sealStates} go={go} addRecommendation={addRecommendation} ticketBudget={ticketBudget}/></div>}
        <div hidden={system!=='dunit'}><DUnitGoalPlanner t={t} lang={lang} objective={objective} progress={progress} toggle={toggle} playerState={playerState} go={()=>go('dunit')}/></div>
      </div>
    </>}
  </div>
}
