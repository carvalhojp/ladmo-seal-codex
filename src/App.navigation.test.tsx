import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Equipment } from './components/Equipment'
import { EquipmentProgress } from './components/EquipmentProgress'
import { EquipmentProgressionCalculator } from './components/EquipmentProgressionCalculator'
import { ProgressionPlanner } from './components/ProgressionPlanner'
import { DUnitGoalPlanner } from './components/DUnitGoalPlanner'
import { DUnitCodex } from './components/DUnitCodex'
import { MyDUnit } from './components/MyDUnit'
import { MyTamer } from './components/MyTamer'
import { GoalRecommendations } from './components/GoalRecommendations'
import { Home } from './components/Home'
import { createNavigation } from './utils/navigation'
import { seals } from './data/seals'
import { dUnitSets } from './data/dUnitAudit'

// Same handler-level integration approach as the existing planner tests, with
// independent hook stores per component and a browser-like session history.
// Native Chrome/mouse/keyboard validation is performed manually on the preview.
const hooks = vi.hoisted(() => ({ stores:new Map<any,any>(), current:null as any }))
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>()
  const changed = (a:any[], b:any[]) => !a || !b || a.length !== b.length || a.some((v,i) => !Object.is(v,b[i]))
  return {...actual,
    useState:(initial:any) => { const s=hooks.current,i=s.cursor++; if (!(i in s.slots)) s.slots[i]=typeof initial==='function'?initial():initial; return [s.slots[i],(value:any)=>{s.slots[i]=typeof value==='function'?value(s.slots[i]):value;s.dirty=true}] },
    useRef:(initial:any) => { const s=hooks.current,i=s.cursor++; return s.slots[i]??(s.slots[i]={current:initial}) },
    useMemo:(factory:()=>any,deps:any[]) => { const s=hooks.current,i=s.cursor++,old=s.slots[i]; if(!old||changed(old.deps,deps))s.slots[i]={deps,value:factory()}; return s.slots[i].value },
    useEffect:(effect:()=>any,deps:any[]) => { const s=hooks.current,i=s.cursor++,old=s.slots[i]; if(!old||changed(old.deps,deps)){s.slots[i]={deps};s.effects.push(()=>{old?.cleanup?.();s.slots[i].cleanup=effect()})} },
  }
})
function render(component:any, props:any={}) {
  const s=hooks.stores.get(component)??{slots:[],cursor:0,effects:[],dirty:false}
  hooks.stores.set(component,s)
  let tree:any, turns=0
  do { if(++turns>20)throw new Error('Render loop');hooks.current=s;s.cursor=0;s.effects=[];s.dirty=false;tree=component(props);s.effects.forEach((effect:()=>void)=>effect()) } while(s.dirty)
  return tree
}
function unmount() { hooks.stores.forEach(s=>s.slots.forEach((slot:any)=>slot?.cleanup?.()));hooks.stores.clear() }
function nodes(node:any, match:(node:any)=>boolean):any[] {
  if(Array.isArray(node))return node.flatMap(n=>nodes(n,match))
  if(!node?.props)return []
  return [...(match(node)?[node]:[]),...nodes(node.props.children,match)]
}
const text=(node:any):string=>Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):typeof node==='object'?'':String(node??'')
const child=(tree:any,component:any)=>nodes(tree,n=>n.type===component)[0]
const button=(tree:any,label:string)=>nodes(tree,n=>n.type==='button'&&text(n)===label)[0]
function browserAt(hash='') {
  const entries=[{url:new URL(`http://127.0.0.1:52948/ladmo-seal-codex/?check=1${hash}`),state:null as any}]
  let index=0
  const events=new EventTarget()
  const history={
    get state(){return entries[index].state},get length(){return entries.length},
    pushState:vi.fn((state:any,_title:string,url:string)=>{entries.splice(index+1);entries.push({url:new URL(url,entries[index].url),state});index++}),
    replaceState:vi.fn((state:any,_title:string,url:string)=>{entries[index]={url:new URL(url,entries[index].url),state}}),
    back:()=>travel(-1),forward:()=>travel(1),
  }
  function travel(delta:number){if(index+delta<0||index+delta>=entries.length)return;index+=delta;events.dispatchEvent(new Event('popstate'));events.dispatchEvent(new Event('hashchange'))}
  return {get location(){return entries[index].url},history,scrollTo:vi.fn(),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)}
}
let browser:ReturnType<typeof browserAt>, values:Record<string,string>, tree:any
function mount(hash='') {
  browser=browserAt(hash);vi.stubGlobal('window',browser)
  tree=render(App)
}
function menu(key:string) {
  const t=nodes(tree,n=>n.props.t)[0].props.t
  const label=({tamer:t.myTamer,goal:t.goal,equipment:t.equipment,mine:t.mine,progress:t.progress} as Record<string,string>)[key]
  button(nodes(tree,n=>n.type==='nav')[0],label).props.onClick();tree=render(App)
}
beforeEach(()=>{
  values={external:'keep','ladmo-lang':'"pt"','ladmo-tickets':'123','ladmo-openers':'7',
    'ladmo-seal-state-v2':JSON.stringify({[seals[0].id]:{quantity:3000,hasSeal:true,doNotRecommend:false}}),
    'ladmo-dunit-progress-v1':JSON.stringify({[dUnitSets[0].id]:{[dUnitSets[0].conditions[0].id]:true}}),
    'ladmo-dunit-inventory-v1':JSON.stringify({}),
    'ladmo-tamer-goals-v1':JSON.stringify({version:1,goals:[]}),
    'ladmo-equipment-progress-v1':JSON.stringify({version:1,items:{'susanoomon-loader':{owned:true,stageId:'loader-lv-4'}}}),
  }
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values[key]??null,setItem:vi.fn((key:string,value:string)=>{values[key]=value}),removeItem:vi.fn((key:string)=>{delete values[key]})})
})
afterEach(()=>{unmount();vi.unstubAllGlobals();vi.restoreAllMocks()})

describe('App session-history integration',()=>{
  it('opens a goal URL without history state, restores it on F5 and navigates between goals, free mode and a set',()=>{
    values['ladmo-tamer-goals-v1']=JSON.stringify({version:1,goals:[
      {id:'goal-ht',type:'attribute',metric:{system:'seals',attribute:'HT'},baseline:0,desiredGain:500},
      {id:'goal-set',type:'dunit-set',setId:'dunit-159'},
    ]})
    mount('#goal/seals?goal=goal-ht')
    const before={...values},pushes=browser.history.pushState.mock.calls.length
    let p=child(tree,ProgressionPlanner).props,planner=render(ProgressionPlanner,p)
    let recommendation=child(planner,GoalRecommendations)
    expect(recommendation.props.goal).toMatchObject({id:'goal-ht',metric:{attribute:'HT'}})
    expect(text(render(GoalRecommendations,recommendation.props))).toContain('HT (pontos)')
    unmount();tree=render(App)
    expect(browser.history.pushState).toHaveBeenCalledTimes(pushes)
    p=child(tree,ProgressionPlanner).props;planner=render(ProgressionPlanner,p)
    expect(child(planner,GoalRecommendations).props.goal.id).toBe('goal-ht')
    nodes(planner,n=>n.props.id==='planning-goal')[0].props.onChange({target:{value:'goal-set'}})
    tree=render(App);planner=render(ProgressionPlanner,child(tree,ProgressionPlanner).props)
    expect(browser.location.hash).toBe('#goal?goal=goal-set')
    recommendation=child(planner,GoalRecommendations)
    expect(recommendation.props.goal.setId).toBe('dunit-159')
    recommendation.props.viewSet('dunit-159');tree=render(App)
    expect(child(tree,DUnitCodex).props.requestedSet).toBe('dunit-159')
    browser.history.back();tree=render(App);planner=render(ProgressionPlanner,child(tree,ProgressionPlanner).props)
    button(planner,child(tree,ProgressionPlanner).props.t.pvFree).props.onClick()
    tree=render(App);planner=render(ProgressionPlanner,child(tree,ProgressionPlanner).props)
    expect(browser.location.hash).toBe('#goal')
    expect(nodes(planner,n=>n.props.id==='progression-objective')[0].props.value).toBe('')
    browser.history.back();tree=render(App);planner=render(ProgressionPlanner,child(tree,ProgressionPlanner).props)
    expect(child(planner,GoalRecommendations).props.goal.id).toBe('goal-set')
    browser.history.forward();tree=render(App)
    expect(browser.location.hash).toBe('#goal');expect(values).toEqual(before)
  })
  it('restores goal and HT through existing history state on F5 and Back/Forward',()=>{
    const b=browserAt('#goal/dunit?goal=goal-one')
    const controller=createNavigation(b as unknown as Window)
    const stop=controller.subscribe(()=>{})
    controller.go({tab:'goal',section:'seals',goalId:'goal-two',objective:'HT'})
    expect(b.history.state.ladmoNavigation).toMatchObject({
      tab:'goal',section:'seals',goalId:'goal-two',objective:'HT',
    })
    const pushes=b.history.pushState.mock.calls.length
    b.history.back()
    expect(controller.get().goalId).toBe('goal-one')
    b.history.forward()
    expect(controller.get()).toMatchObject({goalId:'goal-two',objective:'HT'})
    stop()
    // Simulate reload: rebuild the controller, retaining the browser entry.
    const restoredState=JSON.parse(JSON.stringify(b.history.state))
    b.history.replaceState(restoredState,'',b.location.href)
    const reload=createNavigation(b as unknown as Window)
    expect(reload.get()).toMatchObject({goalId:'goal-two',objective:'HT'})
    expect(b.history.pushState).toHaveBeenCalledTimes(pushes)
    expect(b.location.pathname).toBe('/ladmo-seal-codex/')
    expect(b.location.search).toBe('?check=1')
  })
  it('does not invent HT when a goal URL has no previous history state',()=>{
    const b=browserAt('#goal/seals?goal=goal-two')
    expect(b.history.state).toBeNull()
    const controller=createNavigation(b as unknown as Window)
    expect(controller.get()).toEqual({
      tab:'goal',section:'seals',goalId:'goal-two',
    })
    expect(controller.get().objective).toBeUndefined()
  })
  it.each(['#goal','#goal/seals','#goal/dunit'])('preserves legacy planning URLs: %s',hash=>{
    const b=browserAt(hash),controller=createNavigation(b as unknown as Window)
    expect(controller.get().goalId).toBeUndefined()
    expect(b.location.hash).toBe(hash)
  })
  it.each(['','#invalid','a/b','a.b','x'.repeat(101)])('rejects an invalid goal ID: %s',id=>{
    const b=browserAt(`#goal/dunit?goal=${encodeURIComponent(id)}`)
    const controller=createNavigation(b as unknown as Window)
    expect(controller.get()).toEqual({tab:'goal',section:'dunit'})
    expect(b.location.hash).toBe('#goal/dunit')
    expect(b.history.pushState).not.toHaveBeenCalled()
  })
  it('opens Equipment My progress from the actual dashboard shortcut and returns through history',()=>{
    mount();menu('tamer');const before={...values},p=child(tree,MyTamer).props
    const dashboard=render(MyTamer,p)
    button(dashboard,p.t.tamerViewEquipmentProgress).props.onClick();tree=render(App)
    expect(browser.location.hash).toBe('#equipment/progress')
    expect(child(render(Equipment,child(tree,Equipment).props),EquipmentProgress)).toBeTruthy()
    browser.history.back();tree=render(App);expect(child(tree,MyTamer)).toBeTruthy()
    browser.history.forward();tree=render(App);expect(browser.location.hash).toBe('#equipment/progress')
    expect(values).toEqual(before)
  })
  it('navigates three main pages, goes back twice and forward, without duplicate pushes or storage writes',()=>{
    mount();const before={...values},writes=vi.mocked(localStorage.setItem).mock.calls.length
    menu('tamer');expect(child(tree,MyTamer)).toBeTruthy()
    menu('goal');expect(child(tree,ProgressionPlanner)).toBeTruthy()
    menu('equipment');expect(child(tree,Equipment)).toBeTruthy()
    const pushes=browser.history.pushState.mock.calls.length
    menu('equipment');expect(browser.history.pushState).toHaveBeenCalledTimes(pushes)
    browser.history.back();tree=render(App);expect(child(tree,ProgressionPlanner)).toBeTruthy()
    browser.history.back();tree=render(App);expect(child(tree,MyTamer)).toBeTruthy()
    browser.history.forward();tree=render(App);expect(child(tree,ProgressionPlanner)).toBeTruthy()
    expect(browser.history.pushState).toHaveBeenCalledTimes(pushes)
    expect(values).toEqual(before);expect(localStorage.setItem).toHaveBeenCalledTimes(writes)
  })
  it('connects real Equipment tab handlers to history and restores Calculator / My progress',()=>{
    mount();menu('equipment')
    let p=child(tree,Equipment).props,view=render(Equipment,p)
    button(view,p.t.progressionCalculator).props.onClick();tree=render(App)
    p=child(tree,Equipment).props;view=render(Equipment,p);expect(child(view,EquipmentProgressionCalculator)).toBeTruthy()
    button(view,p.t.epTitle).props.onClick();tree=render(App)
    p=child(tree,Equipment).props;view=render(Equipment,p);expect(child(view,EquipmentProgress)).toBeTruthy()
    const count=browser.history.length;button(view,p.t.epTitle).props.onClick();tree=render(App);menu('equipment')
    expect(browser.history.length).toBe(count)
    browser.history.back();tree=render(App);view=render(Equipment,child(tree,Equipment).props)
    expect(child(view,EquipmentProgressionCalculator)).toBeTruthy()
    browser.history.forward();tree=render(App);view=render(Equipment,child(tree,Equipment).props)
    expect(child(view,EquipmentProgress)).toBeTruthy()
    expect(browser.location.pathname).toBe('/ladmo-seal-codex/');expect(browser.location.search).toBe('?check=1')
  })
  it('restores My Status and Progress subtabs and My Tamer internal destinations',()=>{
    mount();menu('tamer');child(tree,MyTamer).props.navigate('myDUnit');tree=render(App)
    expect(child(tree,MyDUnit)).toBeTruthy();expect(browser.location.hash).toBe('#mine/dunit')
    const t=child(tree,MyDUnit).props.t;button(nodes(tree,n=>n.props.className==='subtabs')[0],t.mine).props.onClick();tree=render(App)
    expect(browser.location.hash).toBe('#mine/seals')
    browser.history.back();tree=render(App);expect(child(tree,MyDUnit)).toBeTruthy()
    menu('progress');button(tree,'D-Unit').props.onClick();tree=render(App)
    expect(browser.location.hash).toBe('#progress/dunit')
    browser.history.back();tree=render(App);expect(browser.location.hash).toBe('#progress/seals')
    browser.history.forward();tree=render(App);expect(browser.location.hash).toBe('#progress/dunit')
  })
  it('preserves Plan prefill and View set callbacks without changing player data',()=>{
    values['ladmo-tamer-goals-v1']=JSON.stringify({version:1,goals:[{id:'goal-test',type:'attribute',metric:{system:'dunit',bonusKey:'EXP||percent'},baseline:0,desiredGain:300}]})
    mount();const before={...values};menu('tamer')
    const intent={id:'goal-test',objective:'EXP',system:'dunit',draft:'300'}
    child(tree,MyTamer).props.goalsProps.plan(intent);tree=render(App)
    expect(browser.location.hash).toBe('#goal/dunit?goal=goal-test')
    const p=child(tree,ProgressionPlanner).props,planner=render(ProgressionPlanner,p)
    expect(child(planner,GoalRecommendations).props.goal).toMatchObject({id:'goal-test',metric:{bonusKey:'EXP||percent'},desiredGain:300})
    expect(child(planner,DUnitGoalPlanner)).toBeUndefined()
    tree=render(App);browser.history.back();tree=render(App)
    child(tree,MyTamer).props.goalsProps.viewSet('dunit-159');tree=render(App)
    expect(child(tree,DUnitCodex).props.requestedSet).toBe('dunit-159')
    child(tree,DUnitCodex).props.consumeRequest();tree=render(App)
    expect(child(tree,DUnitCodex).props.requestedSet).toBeNull();expect(values).toEqual(before)
  })
  it('records planner system tabs, replaces form context without adding an entry, and restores it on F5',()=>{
    mount();menu('goal');const count=browser.history.length
    let p=child(tree,ProgressionPlanner).props,planner=render(ProgressionPlanner,p)
    nodes(planner,n=>n.props.id==='progression-objective')[0].props.onChange({target:{value:'AT'}});tree=render(App)
    expect(browser.history.length).toBe(count)
    p=child(tree,ProgressionPlanner).props;planner=render(ProgressionPlanner,p)
    nodes(planner,n=>n.type==='button'&&text(n).startsWith('Seal Master'))[0].props.onClick();tree=render(App)
    p=child(tree,ProgressionPlanner).props;planner=render(ProgressionPlanner,p)
    nodes(planner,n=>n.type==='button'&&text(n).startsWith('D-Unit'))[0].props.onClick();tree=render(App)
    browser.history.back();tree=render(App);expect(child(tree,ProgressionPlanner).props.navigation).toMatchObject({objective:'AT',system:'seals'})
    browser.history.forward();tree=render(App);expect(child(tree,ProgressionPlanner).props.navigation.system).toBe('dunit')
    const pushes=browser.history.pushState.mock.calls.length,before={...values}
    unmount();tree=render(App)
    expect(child(tree,ProgressionPlanner).props.navigation).toMatchObject({objective:'AT',system:'dunit'})
    expect(browser.history.pushState).toHaveBeenCalledTimes(pushes);expect(values).toEqual(before)
  })
  it.each(['#equipment/progress','#mine/dunit','#progress/dunit'])('opens a valid direct destination and reloads without extra entries: %s',hash=>{
    mount(hash);const count=browser.history.length,before={...values}
    expect(browser.location.hash).toBe(hash)
    if(hash.startsWith('#equipment'))expect(child(render(Equipment,child(tree,Equipment).props),EquipmentProgress)).toBeTruthy()
    unmount();tree=render(App);expect(browser.location.hash).toBe(hash)
    expect(browser.history.length).toBe(count);expect(browser.history.pushState).not.toHaveBeenCalled();expect(values).toEqual(before)
  })
  it.each(['#not-a-page','#equipment/not-a-tab','#tamer/invalid','#equipment/progress/extra'])('falls back safely for an invalid URL: %s',hash=>{
    mount(hash);expect(child(tree,Home)).toBeTruthy();expect(browser.location.hash).toBe('')
    expect(browser.location.pathname).toBe('/ladmo-seal-codex/');expect(browser.history.length).toBe(1)
  })
  it('handles hashchange and popstate once, cleans listeners, and preserves unrelated history state',()=>{
    const b=browserAt();b.history.replaceState({external:'keep'},'',b.location.href)
    const navigation=createNavigation(b as unknown as Window),notify=vi.fn(),stop=navigation.subscribe(notify)
    navigation.go({tab:'equipment',section:'models'});expect(b.history.state.external).toBe('keep')
    const pushes=b.history.pushState.mock.calls.length
    b.history.back();expect(notify).toHaveBeenCalledTimes(2);expect(b.history.pushState).toHaveBeenCalledTimes(pushes)
    b.history.forward();expect(notify).toHaveBeenCalledTimes(3)
    stop();b.history.back();expect(notify).toHaveBeenCalledTimes(3)
  })
})
