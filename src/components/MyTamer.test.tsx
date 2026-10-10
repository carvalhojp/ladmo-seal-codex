import { afterEach, describe, expect, it, vi } from 'vitest'
import { MyTamer } from './MyTamer'
import { TamerGoals } from './TamerGoals'
import { myTamerCopy } from '../data/myTamerCopy'
import { equipmentProgressCopy } from '../data/equipmentProgressCopy'
import { tamerGoalsCopy } from '../data/tamerGoalsCopy'
import { progressionPlannerCopy } from '../data/progressionPlannerCopy'
import { emptyEquipmentProgress, updateEquipmentProgress } from '../utils/equipmentState'
import { emptyTamerGoals } from '../utils/tamerGoals'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { levelsFor } from '../utils/calculations'

vi.mock('react',async original=>({...await original<typeof import('react')>(),useMemo:(fn:()=>any)=>fn()}))
const copy=(lang:'pt'|'en'|'es'|'ko'='pt')=>({...myTamerCopy[lang],...equipmentProgressCopy[lang],...tamerGoalsCopy[lang],...progressionPlannerCopy[lang],equipmentTitle:{pt:'Equipamentos',en:'Equipment',es:'Equipos',ko:'장비'}[lang]})
function nodes(node:any,match:(n:any)=>boolean):any[]{
  if(Array.isArray(node))return node.flatMap(n=>nodes(n,match))
  if(!node?.props)return []
  return [...(match(node)?[node]:[]),...nodes(node.props.children,match)]
}
const text=(node:any):string=>Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):typeof node==='object'?'':String(node??'')
const section=(tree:any,id:string)=>nodes(tree,n=>n.type==='section'&&n.props['aria-labelledby']===id)[0]
const stat=(tree:any,label:string)=>{
  const dt=nodes(tree,n=>n.type==='dt'&&text(n)===label)[0]
  const row=nodes(tree,n=>n.type==='div'&&Array.isArray(n.props.children)&&n.props.children.includes(dt))[0]
  return text(nodes(row,n=>n.type==='dd')[0])
}
const props=()=>({t:copy(),lang:'pt' as const,sealStates:{},progress:{},equipment:emptyEquipmentProgress(),navigate:vi.fn(),goalsProps:{state:emptyTamerGoals(),blocked:false,save:vi.fn(),plan:vi.fn(),viewSet:vi.fn()}})
afterEach(()=>vi.unstubAllGlobals())

describe('Meu Tamer V2 overview',()=>{
  it('forwards optional individual inventory without replacing missing records',()=>{
    const p=props()
    const absent=MyTamer(p)
    expect(nodes(absent,n=>n.type===TamerGoals)[0].props.inventory).toBeUndefined()
    const inventory={tentomon:{owned:true,level:120}}
    const recorded=MyTamer({...p,inventory})
    expect(nodes(recorded,n=>n.type===TamerGoals)[0].props.inventory).toBe(inventory)
  })
  it('shows four independent sections with honest empty states and keeps management available',()=>{
    const p=props(),tree=MyTamer(p)
    for(const id of ['tamer-seals','tamer-dunit','tamer-equipment','tamer-goals-summary'])expect(section(tree,id)).toBeTruthy()
    for(const label of [p.t.tamerEmptySeals,p.t.tamerEmptyDUnit,p.t.epEmpty,p.t.tgEmpty,p.t.tamerLoaderNotRecorded])expect(text(tree)).toContain(label)
    expect(stat(section(tree,'tamer-seals'),p.t.tamerOwned)).toMatch(/^0 /)
    expect(stat(section(tree,'tamer-dunit'),p.t.tamerSetsRecorded)).toMatch(/^0 /)
    expect(stat(section(tree,'tamer-equipment'),p.t.epPieces)).toBe('0 / 18')
    expect(stat(section(tree,'tamer-goals-summary'),p.t.tamerGoalsCount)).toBe('0')
    expect(nodes(tree,n=>n.type==='summary'&&text(n)===p.t.tamerManageGoals)).toHaveLength(1)
    expect(nodes(tree,n=>n.type===TamerGoals)[0].props.state).toBe(p.goalsProps.state)
  })
  it('reuses recorded Seal, D-Unit, equipment and goal progress without mistaking ownership for completion',()=>{
    const p=props(),master=levelsFor(seals[0]).find(level=>level.id==='master')!
    const sealStates={
      [seals[0].id]:{quantity:master.threshold,hasSeal:true,doNotRecommend:false},
      [seals[1].id]:{quantity:0,hasSeal:true,doNotRecommend:false},
      [seals[2].id]:{quantity:0,hasSeal:false,doNotRecommend:true},
    }
    const progress={
      [dUnitSets[0].id]:Object.fromEntries(dUnitSets[0].conditions.map(condition=>[condition.id,true])),
      [dUnitSets[1].id]:{[dUnitSets[1].conditions[0].id]:true},
    }
    let equipment=updateEquipmentProgress(emptyEquipmentProgress(),'susanoomon-loader',true)
    equipment=updateEquipmentProgress(updateEquipmentProgress(equipment,'mdg-tk-boots',true),'mdg-davies-helmet',true)
    const goalsProps={...p.goalsProps,state:{version:1 as const,goals:[{id:'known-goal',type:'dunit-set' as const,setId:dUnitSets[1].id}]}}
    const before=JSON.stringify({sealStates,progress,equipment,goalsProps})
    const tree=MyTamer({...p,sealStates,progress,equipment,goalsProps})
    expect(stat(section(tree,'tamer-seals'),p.t.tamerOwned)).toMatch(/^2 /)
    expect(stat(section(tree,'tamer-seals'),p.t.tamerMaster)).toBe('1')
    expect(stat(section(tree,'tamer-dunit'),p.t.tamerSetsRecorded)).toMatch(/^2 /)
    expect(stat(section(tree,'tamer-dunit'),p.t.tamerConditions)).toMatch(/^5 /)
    expect(text(section(tree,'tamer-dunit'))).toContain(`${p.t.tamerComplete}: 1`)
    expect(text(section(tree,'tamer-dunit'))).toContain(`${p.t.tamerStarted}: 1`)
    expect(stat(section(tree,'tamer-equipment'),p.t.epItems)).toBe('1 / 8')
    expect(stat(section(tree,'tamer-equipment'),p.t.epPieces)).toBe('2 / 18')
    expect(stat(section(tree,'tamer-goals-summary'),p.t.tamerGoalsCount)).toBe('1')
    expect(JSON.stringify({sealStates,progress,equipment,goalsProps})).toBe(before)
    expect(goalsProps.save).not.toHaveBeenCalled()
  })
  it.each([undefined,'loader-lv-0','loader-complete'])('distinguishes Loader unknown, Lv 0 and complete: %s',stage=>{
    const p=props(),tree=MyTamer({...p,equipment:updateEquipmentProgress(p.equipment,'susanoomon-loader',true,stage)})
    const content=text(section(tree,'tamer-equipment'))
    expect(content).toContain(stage==='loader-lv-0'?`${p.t.epLevel} 0`:stage==='loader-complete'?p.t.epComplete:p.t.epUnknownStage)
    if(stage===undefined)expect(content).not.toContain(`${p.t.epLevel} 0`)
  })
  it('does not misrepresent unavailable equipment/goals as zero progress',()=>{
    const p=props(),tree=MyTamer({...p,equipmentBlocked:true,goalsProps:{...p.goalsProps,blocked:true}})
    expect(text(section(tree,'tamer-equipment'))).toContain(p.t.epBlocked)
    expect(nodes(section(tree,'tamer-equipment'),n=>n.type==='dd')).toHaveLength(0)
    expect(text(section(tree,'tamer-goals-summary'))).toContain(p.t.tgBlocked)
    expect(nodes(section(tree,'tamer-goals-summary'),n=>n.type==='dd')).toHaveLength(0)
  })
  it('offers correct shortcuts without reading or writing browser storage or changing goals',()=>{
    const storage={getItem:vi.fn(),setItem:vi.fn(),removeItem:vi.fn()};vi.stubGlobal('localStorage',storage)
    const p=props(),tree=MyTamer(p)
    for(const [label,destination] of [[p.t.tamerRegisterSeals,'codex'],[p.t.tamerRegisterDUnit,'dunit'],[p.t.tamerViewEquipmentProgress,'equipmentProgress'],[p.t.ppTamerCTA,'goal']]){
      nodes(tree,n=>n.type==='button'&&text(n)===label)[0].props.onClick()
      expect(p.navigate).toHaveBeenLastCalledWith(destination)
    }
    for(const fn of Object.values(storage))expect(fn).not.toHaveBeenCalled()
    expect(p.goalsProps.save).not.toHaveBeenCalled()
  })
  it.each(['pt','en','es','ko'] as const)('has localized overview labels and empty states in %s',lang=>{
    const p=props(),t=copy(lang),tree=MyTamer({...p,t,lang})
    for(const label of [t.tamerSystemsTitle,t.tamerSetsRecorded,t.tamerGoalsCount,t.tamerViewEquipmentProgress,t.tamerManageGoals,t.tamerLoaderNotRecorded])expect(text(tree)).toContain(label)
    expect(text(tree)).not.toContain('undefined')
  })
})
