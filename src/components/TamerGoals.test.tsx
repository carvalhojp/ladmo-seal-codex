import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { TamerGoals } from './TamerGoals'
import { ProgressionPlanner } from './ProgressionPlanner'
import { GoalPlanner } from './GoalPlanner'
import { DUnitGoalPlanner } from './DUnitGoalPlanner'
import { DUnitCodex } from './DUnitCodex'
import { About } from './About'
import { tamerGoalsCopy } from '../data/tamerGoalsCopy'
import { progressionPlannerCopy } from '../data/progressionPlannerCopy'
import { progressionDUnitOptions } from '../utils/progressionPlanner'
import { dUnitSets } from '../data/dUnitAudit'
import { emptyTamerGoals, type TamerGoalsState } from '../utils/tamerGoals'
import { createLadmoSave } from '../utils/saveBackup'
import * as sealEngine from '../utils/goalOptimizer'
import * as dunitEngine from '../utils/dUnit'
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

const t={...tamerGoalsCopy.pt,...progressionPlannerCopy.pt,cancel:'Cancelar',importBackup:'Importar',dunitAll:'Todos'}
beforeEach(()=>{hooks.slots=[];hooks.cursor=0;vi.restoreAllMocks()})
const button=(tree:any,label:string)=>nodes(tree,node=>node.type==='button'&&text(node)===label)[0]
const control=(tree:any,label:string)=>nodes(tree,node=>node.type==='label'&&text(node).startsWith(label))[0].props.children.find((child:any)=>child?.type==='input'||child?.type==='select')
const change=(tree:any,label:string,value:string)=>control(tree,label).props.onChange({target:{value}})
const props=()=>{
  const props={t,lang:'pt',sealStates:{},progress:{},state:emptyTamerGoals(),save:vi.fn((state:TamerGoalsState)=>{props.state=state}),plan:vi.fn(),viewSet:vi.fn()}
  return props
}
describe('Tamer goals interface',()=>{
  it('reopens creation as an attribute goal after cancelling a set goal',()=>{
    const p=props(),existing={id:'existing',type:'dunit-set' as const,setId:dUnitSets[0].id}
    p.state={version:1,goals:[existing]}
    let tree=render(TamerGoals,p)
    button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgType,'dunit-set');tree=render(TamerGoals,p)
    expect(control(tree,t.tgType).props.value).toBe('dunit-set')
    button(tree,t.tgCancel).props.onClick();tree=render(TamerGoals,p)
    button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    expect(control(tree,t.tgType).props.value).toBe('attribute')
    expect(control(tree,t.tgSystem)).toBeTruthy()
    expect(text(tree)).toContain(t.tgAttributeHint)
    expect(p.state.goals).toEqual([existing]);expect(p.save).not.toHaveBeenCalled()
  })
  it('creates a D-Unit attribute goal with the exact elemental percentage key',()=>{
    const p=props(),expected=progressionDUnitOptions('Dano habilidade').find(option=>option.qualifier==='Elétrico'&&option.unit==='percent')!
    let tree=render(TamerGoals,p)
    button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgSystem,'dunit');tree=render(TamerGoals,p)
    const option=nodes(control(tree,t.tgMetric),n=>n.type==='option'&&text(n)===`${t.ppSkill} ${t.ppElectric} (%)`)[0]
    expect(option).toBeTruthy()
    change(tree,t.tgMetric,option.props.value);tree=render(TamerGoals,p)
    change(tree,t.tgGain,'5');tree=render(TamerGoals,p);submit(tree);tree=render(TamerGoals,p)
    expect(p.state.goals).toHaveLength(1)
    expect(p.state.goals[0]).toMatchObject({type:'attribute',metric:{system:'dunit',bonusKey:expected.key},desiredGain:5,baseline:0})
    expect(p.progress).toEqual({});expect(p.sealStates).toEqual({})
  })
  it('filters set names case-insensitively and retains the selected set',()=>{
    const p=props();let tree=render(TamerGoals,p)
    button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgType,'dunit-set');tree=render(TamerGoals,p)
    const set=dUnitSets[0],query=set.name.toLocaleUpperCase()
    change(tree,t.tgSearch,query);tree=render(TamerGoals,p)
    const ids=()=>nodes(control(tree,t.tgSet),n=>n.type==='option'&&n.props.value).map(n=>n.props.value)
    expect(ids()).toEqual(dUnitSets.filter(item=>item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(item=>item.id))
    change(tree,t.tgSet,set.id);tree=render(TamerGoals,p)
    change(tree,t.tgSearch,'__no_matching_dunit_set__');tree=render(TamerGoals,p)
    expect(ids()).toEqual([set.id])
    change(tree,t.tgSearch,'');tree=render(TamerGoals,p)
    expect(ids()).toEqual(dUnitSets.map(item=>item.id))
    expect(p.save).not.toHaveBeenCalled()
  })
  it('creates, edits only gain, enforces limit including completed goals and confirms removal',()=>{
    vi.stubGlobal('window',{confirm:vi.fn(()=>true)})
    const p=props()
    let tree=render(TamerGoals,p)
    button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgMetric,'1');tree=render(TamerGoals,p)
    change(tree,t.tgGain,'500');tree=render(TamerGoals,p);submit(tree);tree=render(TamerGoals,p)
    expect(p.state.goals).toHaveLength(1)
    const original=p.state.goals[0]
    expect(original).toMatchObject({type:'attribute',baseline:0,desiredGain:500,metric:{system:'seals',attribute:'HT'}})
    button(tree,t.tgEdit).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgGain,'600');tree=render(TamerGoals,p);submit(tree);tree=render(TamerGoals,p)
    expect(p.state.goals[0]).toEqual({...original,desiredGain:600})
    p.state={version:1,goals:[p.state.goals[0],{id:'two',type:'dunit-set',setId:dUnitSets[0].id},{id:'three',type:'dunit-set',setId:'dunit-999999'}]}
    tree=render(TamerGoals,p)
    expect(button(tree,t.tgCreate).props.disabled).toBe(true)
    expect(text(tree)).toContain(t.tgUnavailable)
    nodes(tree,n=>n.type==='button'&&text(n)===t.tgRemove)[0].props.onClick()
    expect(window.confirm).toHaveBeenCalledWith(t.tgRemoveConfirm)
    expect(p.state.goals).toHaveLength(2)
    expect(p.progress).toEqual({});expect(p.sealStates).toEqual({})
    vi.unstubAllGlobals()
  })
  it('creates a canonical D-Unit goal and navigates by ID without mutating progress',()=>{
    const p=props();let tree=render(TamerGoals,p)
    button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgType,'dunit-set');tree=render(TamerGoals,p)
    change(tree,t.tgSearch,dUnitSets[0].name);tree=render(TamerGoals,p)
    change(tree,t.tgSet,dUnitSets[0].id);tree=render(TamerGoals,p);submit(tree);tree=render(TamerGoals,p)
    expect(p.state.goals[0]).toMatchObject({type:'dunit-set',setId:dUnitSets[0].id})
    button(tree,t.tgView).props.onClick()
    expect(p.viewSet).toHaveBeenCalledWith(dUnitSets[0].id);expect(p.progress).toEqual({})
  })
  it('does not claim success on write failure and blocks invalid storage',()=>{
    const p=props();p.save.mockImplementation(()=>{throw Error('full')})
    let tree=render(TamerGoals,p);button(tree,t.tgCreate).props.onClick();tree=render(TamerGoals,p)
    change(tree,t.tgMetric,'0');tree=render(TamerGoals,p);change(tree,t.tgGain,'20');tree=render(TamerGoals,p);submit(tree);tree=render(TamerGoals,p)
    expect(text(tree)).toContain(t.tgError);expect(text(tree)).not.toContain(t.tgSaved);expect(p.state.goals).toHaveLength(0)
    tree=render(TamerGoals,{...p,blocked:true})
    expect(text(tree)).toContain(t.tgBlocked)
  })
  it('shows D-Unit completion then reopens after unchecking, keeping the goal',()=>{
    const p=props(),set=dUnitSets[0]
    p.state={version:1,goals:[{id:'set',type:'dunit-set',setId:set.id}]}
    p.progress={[set.id]:Object.fromEntries(set.conditions.map(condition=>[condition.id,true]))}
    let tree=render(TamerGoals,p)
    expect(text(tree)).toContain(t.tgComplete);expect(p.state.goals).toHaveLength(1)
    p.progress={[set.id]:{[set.conditions[0].id]:true}}
    tree=render(TamerGoals,p);expect(text(tree)).toContain(t.tgActive);expect(text(tree)).toContain('1 / 4')
  })
  it('consumes an intent once without invoking engines, and manual objective changes clear prefill',()=>{
    const seal=vi.spyOn(sealEngine,'optimizeGoal'),dunit=vi.spyOn(dunitEngine,'calculateDUnitGoalRoute')
    const intent={id:'meta',system:'seals',objective:'HT',draft:'300'}
    const p={t,lang:'pt',sealStates:{},progress:{},inventory:{},ticketBudget:500,go:vi.fn(),addRecommendation:vi.fn(),toggle:vi.fn(),intent,consumeIntent:vi.fn()}
    let tree=render(ProgressionPlanner,p)
    expect(p.consumeIntent).toHaveBeenCalledTimes(1)
    expect(find(tree,'progression-objective').props.value).toBe('HT')
    expect(nodes(tree,n=>n.type===GoalPlanner)[0].props.initialDraft).toBe('300')
    tree=render(ProgressionPlanner,{...p,progress:{changed:{}}})
    expect(p.consumeIntent).toHaveBeenCalledTimes(1)
    input(tree,'progression-objective','AT');tree=render(ProgressionPlanner,p)
    input(tree,'progression-objective','HT');tree=render(ProgressionPlanner,p)
    expect(nodes(tree,n=>n.type===GoalPlanner)[0].props.initialDraft).toBeUndefined()
    expect(seal).not.toHaveBeenCalled();expect(dunit).not.toHaveBeenCalled()
  })
  it.each(['seals','dunit'])('keeps %s prefilled input editable without automatic calculation',system=>{
    const seal=vi.spyOn(sealEngine,'optimizeGoal'),dunit=vi.spyOn(dunitEngine,'calculateDUnitGoalRoute')
    const component=system==='seals'?GoalPlanner:DUnitGoalPlanner
    const p={t,lang:'pt',attribute:'HT',objective:'EXP',sealStates:{},progress:{},playerState:{},go:vi.fn(),toggle:vi.fn(),addRecommendation:vi.fn(),initialDraft:'300',initialBonusKey:'EXP||percent'}
    const id=system==='seals'?'seal-target':'dunit-target'
    let tree=render(component as any,p)
    expect(find(tree,id).props.value).toBe('300')
    input(tree,id,'400');tree=render(component as any,{...p,progress:{changed:{}}})
    expect(find(tree,id).props.value).toBe('400')
    expect(seal).not.toHaveBeenCalled();expect(dunit).not.toHaveBeenCalled()
  })
  it('opens exactly the requested set and consumes navigation without toggling',()=>{
    const set=dUnitSets[50],p={t,progress:{},toggle:vi.fn(),requestedSet:set.id,consumeRequest:vi.fn()}
    const tree=render(DUnitCodex,p)
    expect(nodes(tree,n=>n.type==='article').map(n=>n.key)).toEqual([set.id])
    expect(p.toggle).not.toHaveBeenCalled();expect(p.consumeRequest).toHaveBeenCalledTimes(1)
  })
  it('previews V1 removal, cancels without import and confirms only explicitly',async()=>{
    const save=createLadmoSave({data:{seals:{},dUnitProgress:{},dUnitInventory:{}},preferences:{language:'pt'}})
    const legacy={...save,version:1}
    const p={t,reset:vi.fn(),exportSave:()=>save,importSave:vi.fn()}
    let tree=render(About,p)
    const fileInput=()=>nodes(tree,n=>n.type==='input'&&n.props.type==='file')[0]
    fileInput().props.onChange({target:{files:[{text:async()=>JSON.stringify(legacy)}]}})
    await Promise.resolve();await Promise.resolve();tree=render(About,p)
    expect(text(tree)).toContain(t.tgV1Warning)
    button(tree,t.cancel).props.onClick();tree=render(About,p);expect(p.importSave).not.toHaveBeenCalled()
    fileInput().props.onChange({target:{files:[{text:async()=>JSON.stringify(legacy)}]}})
    await Promise.resolve();await Promise.resolve();tree=render(About,p)
    button(tree,t.importBackup).props.onClick();expect(p.importSave).toHaveBeenCalledTimes(1)
  })
})
