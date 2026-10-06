import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { ProgressionPlanner, progressionPlannerTab } from './ProgressionPlanner'
import { GoalPlanner } from './GoalPlanner'
import { DUnitGoalPlanner } from './DUnitGoalPlanner'
import { MyTamer } from './MyTamer'
import { progressionPlannerCopy } from '../data/progressionPlannerCopy'
import { myTamerCopy } from '../data/myTamerCopy'
import * as sealEngine from '../utils/goalOptimizer'
import * as dunitEngine from '../utils/dUnit'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'

// Exercise the existing components' handlers without adding a DOM dependency.
// Real browser rendering and responsive layout are validated separately.
const hooks=vi.hoisted(()=>({slots:[] as any[],cursor:0,effects:[] as (()=>void)[],dirty:false}))
vi.mock('react',async importOriginal=>{
  const actual=await importOriginal<typeof import('react')>()
  const changed=(a:unknown[]|undefined,b:unknown[]|undefined)=>!a||!b||a.length!==b.length||a.some((v,i)=>!Object.is(v,b[i]))
  return {...actual,
    useState:(initial:any)=>{const index=hooks.cursor++;if(!(index in hooks.slots))hooks.slots[index]=typeof initial==='function'?initial():initial;return [hooks.slots[index],(value:any)=>{hooks.slots[index]=typeof value==='function'?value(hooks.slots[index]):value;hooks.dirty=true}]},
    useRef:(initial:any)=>{const index=hooks.cursor++;return hooks.slots[index]??(hooks.slots[index]={current:initial})},
    useMemo:(factory:()=>any,deps:unknown[])=>{const index=hooks.cursor++,old=hooks.slots[index];if(!old||changed(old.deps,deps))hooks.slots[index]={value:factory(),deps};return hooks.slots[index].value},
    useEffect:(effect:()=>void,deps:unknown[])=>{const index=hooks.cursor++,old=hooks.slots[index];if(!old||changed(old.deps,deps)){hooks.slots[index]={deps};hooks.effects.push(effect)}},
  }
})
function render(component:(props:any)=>ReactElement,props:any){
  let tree:ReactElement
  do{hooks.cursor=0;hooks.dirty=false;hooks.effects=[];tree=component(props);hooks.effects.forEach(effect=>effect())}while(hooks.dirty)
  return tree!
}
function nodes(node:any,predicate:(node:any)=>boolean):any[]{
  if(Array.isArray(node))return node.flatMap(child=>nodes(child,predicate))
  if(!node||typeof node!=='object'||!node.props)return []
  return [...(predicate(node)?[node]:[]),...nodes(node.props.children,predicate)]
}
const find=(tree:any,id:string)=>nodes(tree,node=>node.props.id===id)[0]
const text=(tree:any):string=>Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'')
const input=(tree:any,id:string,value:string)=>find(tree,id).props.onChange({target:{value}})
const submit=(tree:any)=>nodes(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault:vi.fn()})
const t:Record<string,string>={...progressionPlannerCopy.pt,details:'Detalhes',strategy:'Estratégia',current:'Atual',destination:'Destino',needed:'Falta',gain:'Ganho',newSeals:'Selos adicionais',tickets:'Tickets',noTicketBudgetPlan:'Orçamento insuficiente',additionalTicketsNeeded:'Tickets adicionais',dunitSearchRoutes:'Buscar rotas'}
const sealProps=()=>({t,lang:'pt',attribute:'AT',sealStates:{},go:vi.fn(),addRecommendation:vi.fn(),ticketBudget:500})
const dunitProps=()=>({t,lang:'pt',objective:'EXP',progress:{},toggle:vi.fn(),playerState:{},go:vi.fn()})
const plan={recommendations:[],totalBonus:500,totalTickets:50,totalOpeners:2,totalAdditionalSeals:100,excess:0}
beforeEach(()=>{hooks.slots=[];hooks.cursor=0;vi.restoreAllMocks()})

describe('progression coordinator',()=>{
  it('starts blank without mounting planners or calling engines; preserves goal navigation',()=>{
    const seal=vi.spyOn(sealEngine,'optimizeGoal'),dunit=vi.spyOn(dunitEngine,'calculateDUnitGoalRoute')
    const props={t,lang:'pt',sealStates:{},progress:{},inventory:{},ticketBudget:500,go:vi.fn(),addRecommendation:vi.fn(),toggle:vi.fn()}
    let tree=render(ProgressionPlanner,props)
    expect(find(tree,'progression-objective').props.value).toBe('')
    expect(nodes(tree,node=>node.type===GoalPlanner||node.type===DUnitGoalPlanner)).toHaveLength(0)
    expect(progressionPlannerTab).toBe('goal')
    input(tree,'progression-objective','CT');tree=render(ProgressionPlanner,props)
    const paths=nodes(tree,node=>node.type==='button'&&node.props['aria-pressed']!==undefined)
    expect(paths.map(node=>text(node))).toEqual(['Seal Master · CT (%)','D-Unit · CT (pontos)'])
    expect(paths.every(node=>node.props['aria-pressed']===false)).toBe(true)
    paths[0].props.onClick();tree=render(ProgressionPlanner,props)
    const sealNode=nodes(tree,node=>node.type===GoalPlanner)[0]
    paths[1].props.onClick();tree=render(ProgressionPlanner,props)
    expect(nodes(tree,node=>node.type===GoalPlanner)[0].key).toBe(sealNode.key)
    expect(nodes(tree,node=>node.props.hidden===false)).toHaveLength(1)
    expect(seal).not.toHaveBeenCalled();expect(dunit).not.toHaveBeenCalled()
    input(tree,'progression-objective','EXP');tree=render(ProgressionPlanner,props)
    expect(nodes(tree,node=>node.type===GoalPlanner)).toHaveLength(0)
    expect(nodes(tree,node=>node.type===DUnitGoalPlanner)[0].props.objective).toBe('EXP')
    expect(nodes(tree,node=>node.key==='EXP')).toHaveLength(2) // option and reset boundary
  })
  it('adds only the Meu Tamer CTA with no carried goal',()=>{
    const navigate=vi.fn(),tree=render(MyTamer,{t:{...myTamerCopy.pt,...t},lang:'pt',sealStates:{},progress:{},navigate})
    nodes(tree,node=>node.type==='button'&&text(node)===t.ppTamerCTA)[0].props.onClick()
    expect(navigate).toHaveBeenCalledWith('goal')
  })
})

describe('Seal UI uses explicit calculation and incremental callbacks',()=>{
  it('never runs on mount, invalid input or input edits; converts CT only at calculation',()=>{
    const engine=vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue(plan),props={...sealProps(),attribute:'CT'}
    let tree=render(GoalPlanner,props);expect(engine).not.toHaveBeenCalled()
    input(tree,'seal-target','1e3');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    expect(engine).not.toHaveBeenCalled();expect(find(tree,'seal-target').props['aria-invalid']).toBe(true)
    input(tree,'seal-target','1,25');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    expect(engine).toHaveBeenLastCalledWith('CT',125,seals,expect.anything(),'cheap')
    expect(text(tree)).toContain(t.ppOpenersNotice)
    input(tree,'seal-target','2');tree=render(GoalPlanner,props)
    expect(text(tree)).toContain(t.ppRecalculate);expect(text(tree)).not.toContain(t.ppOpenersNotice)
    expect(engine).toHaveBeenCalledTimes(1)
  })
  it('keeps a valid route through language change, but clears it on real Seal state changes',()=>{
    const engine=vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue(plan),props=sealProps()
    let tree=render(GoalPlanner,props);input(tree,'seal-target','500');tree=render(GoalPlanner,props);submit(tree)
    tree=render(GoalPlanner,{...props,lang:'en',t:{...t,...progressionPlannerCopy.en}})
    expect(text(tree)).toContain(progressionPlannerCopy.en.ppOpenersNotice)
    tree=render(GoalPlanner,{...props,sealStates:{[seals[0].id]:{quantity:0,hasSeal:false,doNotRecommend:true}}})
    expect(text(tree)).toContain(t.ppRecalculate);expect(engine).toHaveBeenCalledTimes(1)
  })
  it('keeps Ticket editing temporary, returns partial budget results, and invalidates on strategy/budget changes',()=>{
    const engine=vi.spyOn(sealEngine,'optimizeGoalWithTicketLimit').mockReturnValue({plan:null,bestWithinBudget:plan,additionalTicketsNeeded:20}),props=sealProps()
    let tree=render(GoalPlanner,props);input(tree,'seal-target','500');input(tree,'seal-strategy','ticketLimit');tree=render(GoalPlanner,props)
    input(tree,'seal-budget','30');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    expect(engine).toHaveBeenCalledWith('AT',500,seals,expect.anything(),30)
    expect(text(tree)).toContain('maior ganho');expect(props.ticketBudget).toBe(500)
    input(tree,'seal-budget','40');tree=render(GoalPlanner,props);expect(text(tree)).toContain(t.ppRecalculate)
    expect(engine).toHaveBeenCalledTimes(1)
  })
  it('registers only an explicit acquisition and removes its old clickable route',()=>{
    const recommendation={seal:seals[0],level:'beginner',levelLabel:'Etapa',finalQuantity:50,additionalSeals:50,bonusGain:20,tickets:10,openers:1}
    vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue({...plan,recommendations:[recommendation]} as any)
    const props=sealProps();let tree=render(GoalPlanner,props);input(tree,'seal-target','20');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    expect(props.addRecommendation).not.toHaveBeenCalled()
    nodes(tree,node=>node.props.className?.includes('recommendation-add'))[0].props.onClick();tree=render(GoalPlanner,props)
    expect(props.addRecommendation).toHaveBeenCalledWith(seals[0].id,50)
    expect(text(tree)).toContain(t.ppRegistered);expect(nodes(tree,node=>node.props.className?.includes('recommendation-add'))).toHaveLength(0)
  })
  it('does not treat a zero-quantity owned Seal as a contributing bonus',()=>{
    const seal=seals.find(item=>item.attribute==='AT')!,props={...sealProps(),sealStates:{[seal.id]:{quantity:0,hasSeal:true,doNotRecommend:false}}}
    const tree=render(GoalPlanner,props);expect(text(tree)).toContain(t.ppNone)
  })
})

describe('D-Unit UI invalidation without extra engine calls',()=>{
  const stub=()=>vi.spyOn(dunitEngine,'calculateDUnitGoalRoute').mockReturnValue({maximum:0,target:300,current:0,totalGain:0,recommendations:[],alternatives:[],candidateAlternatives:[]} as any)
  it('validates skill type and human percent before calling the existing engine',()=>{
    const engine=stub(),props={...dunitProps(),objective:'Dano habilidade'}
    let tree=render(DUnitGoalPlanner,props)
    expect(nodes(find(tree,'dunit-type'),node=>node.type==='option')).toHaveLength(16)
    input(tree,'dunit-target','1,25');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    expect(engine).not.toHaveBeenCalled();expect(text(tree)).toContain(t.ppTypeError)
    const option=nodes(find(tree,'dunit-type'),node=>node.type==='option'&&node.props.value)[0]
    input(tree,'dunit-type',option.props.value);tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    expect(engine).toHaveBeenCalledWith(props.progress,option.props.value,1.25,props.playerState)
    input(tree,'dunit-type',nodes(find(tree,'dunit-type'),node=>node.type==='option'&&node.props.value)[1].props.value);tree=render(DUnitGoalPlanner,props)
    expect(text(tree)).toContain(t.ppRecalculate);expect(engine).toHaveBeenCalledTimes(1)
  })
  it.each(['progress','playerState'])('clears the D-Unit result on %s changes, without recalculating',field=>{
    const engine=stub(),props=dunitProps();let tree=render(DUnitGoalPlanner,props)
    expect(engine).not.toHaveBeenCalled()
    input(tree,'dunit-target','300');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    expect(text(tree)).toContain(t.ppNoOptions)
    tree=render(DUnitGoalPlanner,{...props,[field]:{}})
    expect(text(tree)).toContain(t.ppRecalculate);expect(text(tree)).not.toContain(t.ppNoOptions);expect(engine).toHaveBeenCalledTimes(1)
  })
  it('preserves a valid result on language change and presents insufficient available gain',()=>{
    const engine=stub(),props=dunitProps();engine.mockReturnValue({maximum:290,target:300,current:20,totalGain:290,recommendations:[],alternatives:[],candidateAlternatives:[]} as any)
    let tree=render(DUnitGoalPlanner,props);input(tree,'dunit-target','300');tree=render(DUnitGoalPlanner,props);submit(tree)
    tree=render(DUnitGoalPlanner,{...props,lang:'en',t:{...t,...progressionPlannerCopy.en}})
    expect(text(tree)).toContain('below the target');expect(engine).toHaveBeenCalledTimes(1)
  })
  it('registers an explicit condition, clears comparison, search and pagination but preserves confirmation',()=>{
    const condition=dUnitSets.find(set=>set.id==='dunit-34')!.conditions[0],recommendation={setId:'dunit-34',condition,estimatedCost:0,reasons:[],costBenefit:'unknown'}
    const engine=stub();engine.mockReturnValue({maximum:500,target:20,current:0,totalGain:20,setCount:1,unverifiedSetIds:['dunit-34'],recommendations:[recommendation],alternatives:[],candidateAlternatives:[]} as any)
    const props=dunitProps();let tree=render(DUnitGoalPlanner,props);input(tree,'dunit-target','20');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    const routeNode=nodes(tree,node=>typeof node.type==='function'&&node.props.onComplete)[0]
    routeNode.props.onSelect();tree=render(DUnitGoalPlanner,props)
    nodes(tree,node=>node.type==='input'&&node.props.placeholder===t.dunitSearchRoutes)[0].props.onChange({target:{value:'Tentomon'}});tree=render(DUnitGoalPlanner,props)
    expect(engine).toHaveBeenCalledTimes(1)
    routeNode.props.onComplete('dunit-34',condition.id);tree=render(DUnitGoalPlanner,props)
    expect(props.toggle).toHaveBeenCalledWith('dunit-34',condition.id,true)
    expect(text(tree)).toContain(t.ppConditionRecorded)
    expect(nodes(tree,node=>typeof node.type==='function'&&node.props.onComplete)).toHaveLength(0)
  })
})
