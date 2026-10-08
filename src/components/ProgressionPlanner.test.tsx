import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { ProgressionPlanner, progressionPlannerTab } from './ProgressionPlanner'
import { GoalPlanner } from './GoalPlanner'
import { DUnitGoalPlanner } from './DUnitGoalPlanner'
import { MyTamer } from './MyTamer'
import { GoalRecommendations } from './GoalRecommendations'
import { tamerGoalsCopy } from '../data/tamerGoalsCopy'
import { progressionDUnitOptions } from '../utils/progressionPlanner'
import { bonusKey } from '../utils/dUnit'
import type { TamerGoal } from '../utils/tamerGoals'
import { progressionPlannerCopy } from '../data/progressionPlannerCopy'
import { myTamerCopy } from '../data/myTamerCopy'
import * as sealEngine from '../utils/goalOptimizer'
import * as dunitEngine from '../utils/dUnit'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { addRecommendedQuantity, type SealStateMap } from '../utils/sealState'

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
const t:Record<string,string>={...progressionPlannerCopy.pt,...tamerGoalsCopy.pt,...myTamerCopy.pt,details:'Detalhes',strategy:'Estratégia',current:'Atual',destination:'Destino',needed:'Falta',gain:'Ganho',newSeals:'Selos adicionais',tickets:'Tickets',noTicketBudgetPlan:'Orçamento insuficiente',additionalTicketsNeeded:'Tickets adicionais',dunitSearchRoutes:'Buscar rotas'}
const sealProps=()=>({t,lang:'pt',attribute:'AT',sealStates:{},go:vi.fn(),addRecommendation:vi.fn(),ticketBudget:500})
const dunitProps=()=>({t,lang:'pt',objective:'EXP',progress:{},toggle:vi.fn(),playerState:{},go:vi.fn()})
const plan={recommendations:[],totalBonus:500,totalTickets:50,totalOpeners:2,totalAdditionalSeals:100,excess:0}
beforeEach(()=>{hooks.slots=[];hooks.cursor=0;vi.restoreAllMocks()})

describe('goal-oriented planning interface',()=>{
  const base=()=>({t,lang:'pt',sealStates:{},progress:{},inventory:{},ticketBudget:500,go:vi.fn(),addRecommendation:vi.fn(),toggle:vi.fn()})
  const sealGoal:TamerGoal={id:'seal-goal',type:'attribute',metric:{system:'seals',attribute:'HT'},baseline:0,desiredGain:5000}
  const panel=(goal:TamerGoal,extra:Record<string,unknown>={})=>({...base(),goal,viewSet:vi.fn(),...extra})

  it('selects a saved goal and returns to free planning without changing it or calling engines',()=>{
    const seal=vi.spyOn(sealEngine,'optimizeGoal'),dunit=vi.spyOn(dunitEngine,'calculateDUnitGoalRoute')
    const goals={version:1 as const,goals:[sealGoal]},before=JSON.stringify(goals),selectGoal=vi.fn()
    const p={...base(),goals,navigation:{objective:'' as const,system:null,selectGoal,go:vi.fn()}}
    let tree=render(ProgressionPlanner,p)
    input(tree,'planning-goal',sealGoal.id);expect(selectGoal).toHaveBeenLastCalledWith(sealGoal.id)
    tree=render(ProgressionPlanner,{...p,navigation:{...p.navigation,goalId:sealGoal.id}})
    expect(nodes(tree,n=>n.type===GoalRecommendations)[0].props.goal).toBe(sealGoal)
    expect(nodes(tree,n=>n.type===GoalPlanner||n.type===DUnitGoalPlanner)).toHaveLength(0)
    nodes(tree,n=>n.type==='button'&&text(n)===t.pvFree)[0].props.onClick()
    expect(selectGoal).toHaveBeenLastCalledWith('')
    tree=render(ProgressionPlanner,p)
    expect(find(tree,'progression-objective').props.value).toBe('')
    expect(JSON.stringify(goals)).toBe(before)
    expect(seal).not.toHaveBeenCalled();expect(dunit).not.toHaveBeenCalled()
    expect(p.addRecommendation).not.toHaveBeenCalled();expect(p.toggle).not.toHaveBeenCalled()
  })

  it('shows missing or blocked goals as unavailable instead of zero progress',()=>{
    const p={...base(),goals:{version:1 as const,goals:[sealGoal]},navigation:{objective:'' as const,system:null,goalId:'missing',selectGoal:vi.fn(),go:vi.fn()}}
    let tree=render(ProgressionPlanner,p)
    expect(text(tree)).toContain(t.pvUnavailable)
    expect(nodes(tree,n=>n.type===GoalRecommendations||n.type==='dd')).toHaveLength(0)
    tree=render(ProgressionPlanner,{...p,goalsBlocked:true,navigation:{...p.navigation,goalId:sealGoal.id}})
    expect(find(tree,'planning-goal').props.disabled).toBe(true)
    expect(text(tree)).toContain(t.tgBlocked)
  })

  it('shows incremental Seal quantities, Tickets and Openers and limits long lists',()=>{
    const seal=seals.find(item=>item.attribute==='HT')!,state={[seal.id]:{quantity:50,hasSeal:true,doNotRecommend:false}}
    const p=panel(sealGoal,{sealStates:state}),before=JSON.stringify(state)
    let tree=render(GoalRecommendations,p)
    const started=nodes(tree,n=>n.type==='section'&&n.props['aria-label']===t.pvNext)[0]
    expect(text(started)).toContain(`${t.newSeals}: 150`)
    expect(text(started)).toContain(`${t.ppOpenersNeeded}: 3`)
    expect(text(tree)).toContain(t.pvOpenersNotice)
    expect(nodes(tree,n=>n.type==='article').length).toBeLessThanOrEqual(12)
    nodes(started,n=>n.type==='button')[0].props.onClick();expect(p.go).toHaveBeenCalledWith('codex')
    const more=nodes(tree,n=>n.type==='button'&&text(n)===t.pvMore)[0]
    expect(more).toBeTruthy();more.props.onClick();tree=render(GoalRecommendations,p)
    expect(nodes(tree,n=>n.type==='article').length).toBeGreaterThan(7)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('separates exact elemental percent conditions from other set requirements',()=>{
    const metric=progressionDUnitOptions('Dano habilidade').find(item=>item.qualifier==='Elétrico'&&item.unit==='percent')!
    const set=dUnitSets.find(set=>set.conditions.some(c=>bonusKey(c)===metric.key))!
    const relevant=set.conditions.find(c=>bonusKey(c)===metric.key)!
    const completed=set.conditions.find(c=>bonusKey(c)!==metric.key)!
    const goal:TamerGoal={id:'electric-goal',type:'attribute',metric:{system:'dunit',bonusKey:metric.key},baseline:0,desiredGain:5}
    const p=panel(goal,{progress:{[set.id]:{[completed.id]:true}}}),tree=render(GoalRecommendations,p)
    expect(text(tree)).toContain('5%');expect(text(tree)).toContain(t.ppElectric)
    const card=nodes(tree,n=>n.type==='article'&&text(n).includes(set.name))[0]
    expect(text(card)).toContain(t.pvMatching);expect(text(card)).toContain(t.pvOtherConditions)
    expect(text(card)).toContain(relevant.requirement);expect(text(card)).toContain(`✓ ${completed.requirement}`)
    expect(text(card)).toContain(t.ppStepDone);expect(text(card)).toContain(t.pvPending)
    expect(text(tree)).toContain(t.pvCostNotice)
    nodes(card,n=>n.type==='button')[0].props.onClick();expect(p.viewSet).toHaveBeenCalledWith(set.id)
  })

  it('keeps a set goal actionable with one non-EXP requirement pending, then shows completion',()=>{
    const set=dUnitSets.find(set=>set.conditions.some(c=>c.bonus.attribute==='EXP')&&set.conditions.some(c=>c.bonus.attribute!=='EXP'))!
    const last=set.conditions.find(c=>c.bonus.attribute!=='EXP')!
    const goal:TamerGoal={id:'set-goal',type:'dunit-set',setId:set.id}
    const p=panel(goal,{progress:{[set.id]:Object.fromEntries(set.conditions.map(c=>[c.id,c.id!==last.id]))}})
    let tree=render(GoalRecommendations,p)
    expect(nodes(tree,n=>n.type==='article')).toHaveLength(1)
    expect(text(tree)).toContain(set.name);expect(text(tree)).toContain(last.requirement)
    expect(text(tree)).not.toContain(t.pvPendingGain)
    tree=render(GoalRecommendations,{...p,progress:{[set.id]:Object.fromEntries(set.conditions.map(c=>[c.id,true]))}})
    expect(text(tree)).toContain(t.tgComplete);expect(nodes(tree,n=>n.type==='article')).toHaveLength(0)
    expect(text(tree)).toContain(set.name)
  })

  it('does not show numeric progress for an unavailable metric',()=>{
    const goal:TamerGoal={id:'unknown-goal',type:'attribute',metric:{system:'dunit',bonusKey:'Unavailable||percent'},baseline:0,desiredGain:5}
    const tree=render(GoalRecommendations,panel(goal))
    expect(text(tree)).toContain(t.pvUnknownDetail)
    expect(nodes(tree,n=>n.type==='dd')).toHaveLength(0)
  })

  it('keeps the baseline and additional target while live D-Unit progress reduces the remaining gain',()=>{
    const set=dUnitSets.find(set=>set.conditions.filter(c=>c.bonus.attribute==='EXP'&&c.confirmed&&c.bonus.value!==null).length>1)!
    const [first,second]=set.conditions.filter(c=>c.bonus.attribute==='EXP'&&c.confirmed&&c.bonus.value!==null)
    const baseline=first.bonus.value!,goal:TamerGoal={id:'partial-exp',type:'attribute',metric:{system:'dunit',bonusKey:bonusKey(first)},baseline,desiredGain:300}
    const p=panel(goal,{progress:{[set.id]:{[first.id]:true}}}),before=JSON.stringify(goal)
    const stats=(tree:any)=>nodes(tree,n=>n.type==='dd').map(text)
    let tree=render(GoalRecommendations,p)
    expect(stats(tree)).toEqual([`${baseline+300}%`,`${baseline}%`,'300%'])
    tree=render(GoalRecommendations,{...p,progress:{[set.id]:{[first.id]:true,[second.id]:true}}})
    expect(stats(tree)).toEqual([`${baseline+300}%`,`${baseline+second.bonus.value!}%`,`${300-second.bonus.value!}%`])
    expect(JSON.stringify(goal)).toBe(before)
    expect(p.toggle).not.toHaveBeenCalled();expect(p.addRecommendation).not.toHaveBeenCalled()
  })

  it.each(['pt','en','es','ko'] as const)('localizes the goal interface in %s',lang=>{
    const localized={...t,...progressionPlannerCopy[lang],...tamerGoalsCopy[lang],...myTamerCopy[lang]}
    const tree=render(GoalRecommendations,panel(sealGoal,{t:localized,lang}))
    for(const label of [localized.pvTarget,localized.pvNext,localized.pvOther,localized.pvOptionsNotice,localized.pvOpenersNotice])expect(text(tree)).toContain(label)
    expect(text(tree)).not.toContain('undefined')
    const expected=Object.keys(progressionPlannerCopy.pt).sort()
    expect(Object.keys(progressionPlannerCopy[lang]).sort()).toEqual(expected)
    expect(Object.values(progressionPlannerCopy[lang]).every(Boolean)).toBe(true)
  })
})

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
  it('keeps a valid route through language and external Seal state changes, marking it stale',()=>{
    const engine=vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue(plan),props=sealProps()
    let tree=render(GoalPlanner,props);input(tree,'seal-target','500');tree=render(GoalPlanner,props);submit(tree)
    tree=render(GoalPlanner,{...props,lang:'en',t:{...t,...progressionPlannerCopy.en}})
    expect(text(tree)).toContain(progressionPlannerCopy.en.ppOpenersNotice)
    tree=render(GoalPlanner,{...props,sealStates:{[seals[0].id]:{quantity:0,hasSeal:false,doNotRecommend:true}}})
    expect(text(tree)).toContain(t.ppSealStale);expect(text(tree)).toContain(t.ppOpenersNotice);expect(engine).toHaveBeenCalledTimes(1)
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
  it('registers only an explicit acquisition and keeps its completed checklist step',()=>{
    const recommendation={seal:seals[0],level:'beginner',levelLabel:'Etapa',finalQuantity:50,additionalSeals:50,bonusGain:20,tickets:10,openers:1}
    vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue({...plan,recommendations:[recommendation]} as any)
    const props=sealProps();let tree=render(GoalPlanner,props);input(tree,'seal-target','20');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    expect(props.addRecommendation).not.toHaveBeenCalled()
    nodes(tree,node=>node.props.className?.includes('recommendation-add'))[0].props.onClick();tree=render(GoalPlanner,props)
    expect(props.addRecommendation).toHaveBeenCalledWith(seals[0].id,50)
    expect(text(tree)).toContain(t.ppRegistered);expect(nodes(tree,node=>node.props.className?.includes('recommendation-add'))[0].props.disabled).toBe(true)
    expect(text(tree)).toContain(t.ppStepRegistered);expect(text(tree)).toContain(t.ppSealStale)
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
  it.each(['progress','playerState'])('keeps the D-Unit snapshot stale on %s changes, without recalculating',field=>{
    const engine=stub(),props=dunitProps();let tree=render(DUnitGoalPlanner,props)
    expect(engine).not.toHaveBeenCalled()
    input(tree,'dunit-target','300');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    expect(text(tree)).toContain(t.ppNoOptions)
    tree=render(DUnitGoalPlanner,{...props,[field]:{}})
    expect(text(tree)).toContain(t.ppDUnitStale);expect(text(tree)).toContain(t.ppNoOptions);expect(engine).toHaveBeenCalledTimes(1)
  })
  it('preserves a valid result on language change and presents insufficient available gain',()=>{
    const engine=stub(),props=dunitProps();engine.mockReturnValue({maximum:290,target:300,current:20,totalGain:290,recommendations:[],alternatives:[],candidateAlternatives:[]} as any)
    let tree=render(DUnitGoalPlanner,props);input(tree,'dunit-target','300');tree=render(DUnitGoalPlanner,props);submit(tree)
    tree=render(DUnitGoalPlanner,{...props,lang:'en',t:{...t,...progressionPlannerCopy.en}})
    expect(text(tree)).toContain('below the target');expect(engine).toHaveBeenCalledTimes(1)
  })
  it('registers an explicit condition while keeping comparison, search and snapshot',()=>{
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
    const remaining=nodes(tree,node=>typeof node.type==='function'&&node.props.onComplete)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].props.selected).toBe(true)
    expect(remaining[0].props.progress['dunit-34'][condition.id]).toBe(true)
    expect(nodes(tree,node=>node.type==='input'&&node.props.placeholder===t.dunitSearchRoutes)[0].props.value).toBe('Tentomon')
    expect(text(tree)).toContain(t.ppDUnitStale)
    remaining[0].props.onComplete('dunit-34',condition.id)
    expect(props.toggle).toHaveBeenCalledTimes(1)
  })
})

describe('progression checklist snapshots',()=>{
  const clickText=(tree:any,label:string)=>nodes(tree,node=>node.type==='button'&&text(node)===label)[0].props.onClick()
  const actions=(tree:any)=>nodes(tree,node=>node.props.className?.includes('recommendation-add'))
  it('registers three Seal destinations without rerunning the engine and recalculates explicitly from latest progress',()=>{
    const recommendations=seals.slice(0,4).map(seal=>({seal,level:'beginner',levelLabel:'Etapa',finalQuantity:300,additionalSeals:300,bonusGain:20,tickets:10,openers:1}))
    const engine=vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue({...plan,recommendations} as any)
    const props=sealProps();props.addRecommendation=vi.fn((id,amount)=>{props.sealStates=addRecommendedQuantity(props.sealStates,id,amount)})
    let tree=render(GoalPlanner,props);input(tree,'seal-target','500');input(tree,'seal-strategy','openers');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    const status=nodes(tree,node=>node.props.role==='status'&&node.props.ref)[0],focus=vi.fn()
    status.props.ref.current={focus}
    for(let i=0;i<3;i++){actions(tree)[i].props.onClick();tree=render(GoalPlanner,props);expect(actions(tree).slice(0,i+1).every(node=>node.props.disabled)).toBe(true);expect(actions(tree)[3].props.disabled).toBe(false)}
    expect(engine).toHaveBeenCalledTimes(1);expect(props.addRecommendation).toHaveBeenCalledTimes(3)
    expect(focus).not.toHaveBeenCalled();expect(status.props.role).toBe('status')
    expect(props.ticketBudget).toBe(500);expect(text(tree)).toContain(t.ppSealStale)
    clickText(tree,t.ppRecalculateSeal);tree=render(GoalPlanner,props)
    expect(engine).toHaveBeenCalledTimes(2);expect(engine).toHaveBeenLastCalledWith('AT',500,seals,expect.objectContaining({[seals[0].id]:{quantity:300,doNotRecommend:false}}),'openers')
    expect(text(tree)).not.toContain(t.ppSealStale)
  })
  it.each([100,300,400])('safely handles Seal progress %s toward the snapshot destination 300',quantity=>{
    const seal=seals[0],recommendation={seal,level:'beginner',levelLabel:'Etapa',finalQuantity:300,additionalSeals:300,bonusGain:20,tickets:10,openers:1}
    const engine=vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue({...plan,recommendations:[recommendation]} as any)
    const props=sealProps();let tree=render(GoalPlanner,props);input(tree,'seal-target','500');tree=render(GoalPlanner,props);submit(tree)
    const states:SealStateMap={[seal.id]:{quantity,hasSeal:true,doNotRecommend:false}}
    tree=render(GoalPlanner,{...props,sealStates:states});const button=actions(tree)[0]
    expect(button.props.disabled).toBe(quantity>=300)
    button.props.onClick();button.props.onClick()
    if(quantity<300){expect(props.addRecommendation).toHaveBeenCalledExactlyOnceWith(seal.id,200);expect(addRecommendedQuantity(states,seal.id,200)[seal.id].quantity).toBe(300)}else expect(props.addRecommendation).not.toHaveBeenCalled()
    expect(engine).toHaveBeenCalledTimes(1)
  })
  it.each(['seal-target','seal-strategy','seal-budget'])('still removes a stale Seal snapshot when %s changes',id=>{
    vi.spyOn(sealEngine,'optimizeGoalWithTicketLimit').mockReturnValue({plan,bestWithinBudget:null,additionalTicketsNeeded:null})
    const props=sealProps();let tree=render(GoalPlanner,props);input(tree,'seal-target','500');input(tree,'seal-strategy','ticketLimit');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,props)
    input(tree,id,id==='seal-strategy'?'cheap':'600');tree=render(GoalPlanner,props);expect(text(tree)).not.toContain(t.ppOpenersNotice)
  })
  it('invalidates Seal results on an inherited attribute change without engine calls',()=>{
    const engine=vi.spyOn(sealEngine,'optimizeGoal').mockReturnValue(plan),props=sealProps()
    let tree=render(GoalPlanner,props);input(tree,'seal-target','500');tree=render(GoalPlanner,props);submit(tree);tree=render(GoalPlanner,{...props,attribute:'DE'})
    expect(text(tree)).not.toContain(t.ppOpenersNotice);expect(engine).toHaveBeenCalledTimes(1)
  })
  it('keeps D-Unit route values, search, loaded pages and comparison through three canonical completions; explicit recalculation replaces them',()=>{
    const set=dUnitSets.find(set=>set.id==='dunit-34')!,other=dUnitSets.find(set=>set.id==='dunit-41')!
    const recommendations=set.conditions.slice(0,3).map(condition=>({setId:set.id,condition,estimatedCost:0,reasons:[],costBenefit:'unknown'}))
    const base={totalGain:310,setCount:1,unverifiedSetIds:[set.id],recommendations}
    const alternatives=Array.from({length:26},(_,i)=>({...base,recommendations:[...recommendations,{setId:other.id,condition:{...other.conditions[0],id:`${other.id}-condition-${i+1}`},estimatedCost:0,reasons:[],costBenefit:'unknown'}]}))
    const engine=vi.spyOn(dunitEngine,'calculateDUnitGoalRoute').mockReturnValue({...base,maximum:1000,target:300,current:20,alternatives:[],candidateAlternatives:alternatives} as any)
    const props=dunitProps();props.toggle=vi.fn((setId,conditionId)=>{props.progress={...props.progress,[setId]:{...(props.progress as any)[setId],[conditionId]:true}}})
    let tree=render(DUnitGoalPlanner,props);input(tree,'dunit-target','300');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    const cards=()=>nodes(tree,node=>typeof node.type==='function'&&node.props.onComplete)
    cards()[0].props.onSelect();cards()[1].props.onSelect();tree=render(DUnitGoalPlanner,props)
    nodes(tree,node=>node.props.className==='quiet dunit-load-more')[0].props.onClick();tree=render(DUnitGoalPlanner,props);expect(cards()).toHaveLength(27)
    for(const condition of set.conditions.slice(0,3)){cards()[0].props.onComplete(set.id,condition.id);tree=render(DUnitGoalPlanner,props);expect(cards()).toHaveLength(27);expect(cards().every(card=>card.props.progress[set.id][condition.id]===true)).toBe(true);cards()[1].props.onComplete(set.id,condition.id)}
    expect(props.toggle).toHaveBeenCalledTimes(3);expect(engine).toHaveBeenCalledTimes(1)
    expect(cards()[0].props.currentBonus).toBe(20);expect(cards()[0].props.route.totalGain).toBe(310)
    expect(cards()[0].props.snapshotProgress).toEqual({})
    const comparison=nodes(tree,node=>typeof node.type==='function'&&node.props.routes)[0];expect(comparison.props.routes).toHaveLength(2);expect(comparison.props.progress[set.id][set.conditions[0].id]).toBe(true)
    const search=nodes(tree,node=>node.type==='input'&&node.props.placeholder===t.dunitSearchRoutes)[0];search.props.onChange({target:{value:'Tentomon'}});tree=render(DUnitGoalPlanner,props)
    expect(text(tree)).toContain(t.ppDUnitStale)
    clickText(tree,t.ppRecalculateDUnit);tree=render(DUnitGoalPlanner,props)
    expect(engine).toHaveBeenCalledTimes(2);expect(engine).toHaveBeenLastCalledWith(props.progress,'EXP||percent',300,props.playerState)
    expect(text(tree)).not.toContain(t.ppDUnitStale);expect(cards()).toHaveLength(24)
    expect(nodes(tree,node=>typeof node.type==='function'&&node.props.routes)[0].props.routes).toHaveLength(0)
    expect(nodes(tree,node=>node.type==='input'&&node.props.placeholder===t.dunitSearchRoutes)[0].props.value).toBe('')
    input(tree,'dunit-target','400');tree=render(DUnitGoalPlanner,props);expect(cards()).toHaveLength(0)
  })
  it('uses canonical progress, not inventory possession, to block duplicate D-Unit completions',()=>{
    const set=dUnitSets.find(set=>set.id==='dunit-34')!,condition=set.conditions[0]
    vi.spyOn(dunitEngine,'calculateDUnitGoalRoute').mockReturnValue({maximum:500,target:20,current:0,totalGain:20,setCount:1,unverifiedSetIds:[set.id],recommendations:[{setId:set.id,condition}],alternatives:[],candidateAlternatives:[]} as any)
    const props={...dunitProps(),playerState:{ownedDigimonIds:['tentomon']}};let tree=render(DUnitGoalPlanner,props);input(tree,'dunit-target','20');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    const card=()=>nodes(tree,node=>typeof node.type==='function'&&node.props.onComplete)[0]
    expect(card().props.progress).toEqual({});expect(props.toggle).not.toHaveBeenCalled()
    tree=render(DUnitGoalPlanner,{...props,progress:{[set.id]:{[condition.id]:true}}});card().props.onComplete(set.id,condition.id);expect(props.toggle).not.toHaveBeenCalled()
  })
  it.each(['pt','en','es','ko'] as const)('localizes every checklist message in %s',lang=>{
    for(const key of ['ppProgressUpdated','ppSealStale','ppDUnitStale','ppStepRegistered','ppStepDone','ppRecalculateSeal','ppRecalculateDUnit'])expect((progressionPlannerCopy[lang] as Record<string,string>)[key]).toBeTruthy()
  })
  it('completes a canonical condition in a large AT snapshot without spreading candidate arrays into arguments',()=>{
    const set=dUnitSets.find(set=>set.conditions.some(condition=>condition.bonus.attribute==='AT'))!,condition=set.conditions.find(condition=>condition.bonus.attribute==='AT')!
    const recommendation={setId:set.id,condition},route={totalGain:100,setCount:1,unverifiedSetIds:[set.id],recommendations:[recommendation]}
    const engine=vi.spyOn(dunitEngine,'calculateDUnitGoalRoute').mockReturnValue({...route,maximum:1000,target:100,current:0,alternatives:[],candidateAlternatives:Array(150000).fill(route)} as any)
    const props={...dunitProps(),objective:'AT'};props.toggle=vi.fn((setId,conditionId)=>{props.progress={...props.progress,[setId]:{...(props.progress as any)[setId],[conditionId]:true}}})
    let tree=render(DUnitGoalPlanner,props);input(tree,'dunit-target','100');tree=render(DUnitGoalPlanner,props);submit(tree);tree=render(DUnitGoalPlanner,props)
    const status=nodes(tree,node=>node.props.role==='status'&&node.props.ref)[0],focus=vi.fn();status.props.ref.current={focus}
    const card=()=>nodes(tree,node=>typeof node.type==='function'&&node.props.onComplete)[0]
    expect(()=>card().props.onComplete(set.id,condition.id)).not.toThrow();tree=render(DUnitGoalPlanner,props)
    expect(props.toggle).toHaveBeenCalledExactlyOnceWith(set.id,condition.id,true)
    expect(card().props.progress[set.id][condition.id]).toBe(true);expect(text(tree)).toContain(t.ppDUnitStale)
    card().props.onComplete(set.id,condition.id);expect(props.toggle).toHaveBeenCalledTimes(1)
    expect(engine).toHaveBeenCalledTimes(1);expect(focus).not.toHaveBeenCalled()
  })
})
