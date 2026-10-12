// @vitest-environment jsdom
import { act, Component, StrictMode, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { GoalPlanner, type SealRouteConfirmation } from './GoalPlanner'
import { seals } from '../data/seals'
import { progressionPlannerCopy } from '../data/progressionPlannerCopy'
import { tamerGoalsCopy } from '../data/tamerGoalsCopy'
import * as engine from '../utils/goalOptimizer'
import { playerDataRepository } from '../utils/playerDataRepository'
import { addRecommendedQuantity, updateSealState, type SealStateMap } from '../utils/sealState'
import { deriveTamerGoal, goalTotals, type TamerGoal } from '../utils/tamerGoals'

type PlannerProps=ComponentProps<typeof GoalPlanner>
const capture=vi.hoisted(()=>({
  props:null as PlannerProps|null,
  transition:null as {confirmation:SealRouteConfirmation;before:SealStateMap;after:SealStateMap}|null,
}))

// Observe contracts only; App, component state/effects, persistence and optimizer remain real.
vi.mock('./GoalPlanner',async importOriginal=>{
  const actual=await importOriginal<typeof import('./GoalPlanner')>()
  const wrap=(confirmation:SealRouteConfirmation):SealRouteConfirmation=>({
    prepare:(before,after)=>{
      capture.transition={confirmation,before,after}
      return confirmation.prepare(before,after)
    },
    saved:(before,after)=>confirmation.saved(before,after),
    failed:()=>confirmation.failed(),
  })
  return {...actual,GoalPlanner:(props:PlannerProps)=>{
    capture.props=props
    return <actual.GoalPlanner {...props}
      addRecommendation={(id,additional,confirmation)=>{
        if(confirmation)props.addRecommendation(id,additional,wrap(confirmation))
        else props.addRecommendation(id,additional)
      }}
      editSeal={props.editSeal?(id,destination,confirmation)=>{
        if(confirmation)props.editSeal!(id,destination,wrap(confirmation))
        else props.editSeal!(id,destination)
      }:undefined}/>
  }}
})

const copy=progressionPlannerCopy.pt
const selected=seals.filter(seal=>seal.attribute==='HT'&&engine.buildProgressOptions(seal,{
  quantity:2000,doNotRecommend:false,
}).some(option=>option.bonusGain>0)).slice(0,2)
const initialStates=():SealStateMap=>Object.fromEntries(seals.map(seal=>[
  seal.id,selected.some(item=>item.id===seal.id)
    ? {quantity:2000,hasSeal:true,doNotRecommend:false}
    : {quantity:0,hasSeal:false,doNotRecommend:true},
]))
const recommendations=selected.map(seal=>{
  const options=engine.buildProgressOptions(seal,{quantity:2000,doNotRecommend:false})
  return options[options.length-1]
})
const desiredGain=recommendations.reduce((sum,item)=>sum+item.bonusGain,0)
const goal:TamerGoal={id:'session-goal',type:'attribute',metric:{system:'seals',attribute:'HT'},
  baseline:goalTotals(initialStates(),{}).seals.HT,desiredGain}

class TestBoundary extends Component<{children:ReactNode},{error:Error|null}>{
  state:{error:Error|null}={error:null}
  static getDerivedStateFromError(error:Error){return {error}}
  render(){return this.state.error?<p role="alert">{this.state.error.message}</p>:this.props.children}
}
let host:HTMLDivElement,root:Root
const states=():SealStateMap=>JSON.parse(localStorage.getItem('ladmo-seal-state-v2')!)
const registerButtons=()=>[...host.querySelectorAll<HTMLButtonElement>('.recommendation-add')]
const editorButtons=()=>[...host.querySelectorAll<HTMLButtonElement>('.plan-row [data-seal-id]')]
const snapshotDestinations=()=>editorButtons().map(button=>({id:button.dataset.sealId!,total:Number(button.dataset.destination)}))
async function click(button:HTMLButtonElement){
  expect(button).toBeTruthy();expect(button.disabled).toBe(false)
  await act(async()=>button.click())
}
async function clickText(text:string){await click([...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent===text)!)}
async function input(selector:string,value:string){
  const element=host.querySelector<HTMLInputElement>(selector)!
  expect(element).toBeTruthy()
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value)
    element.dispatchEvent(new Event('input',{bubbles:true}))
  })
}
async function select(selector:string,value:string){
  const element=host.querySelector<HTMLSelectElement>(selector)!
  expect(element).toBeTruthy()
  await act(async()=>{element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}))})
}
async function renderApp(strict=false){
  await act(async()=>root.render(<TestBoundary>{strict?<StrictMode><App/></StrictMode>:<App/>}</TestBoundary>))
}
async function mount(strict=false){
  localStorage.setItem('ladmo-lang',JSON.stringify('pt'))
  localStorage.setItem('ladmo-seal-state-v2',JSON.stringify(initialStates()))
  localStorage.setItem('ladmo-tamer-goals-v1',JSON.stringify({version:1,goals:[goal]}))
  localStorage.setItem('external-test-key','preserve')
  window.history.replaceState(null,'','#tamer')
  await renderApp(strict)
  const details=host.querySelector<HTMLDetailsElement>('section[aria-labelledby="tamer-goals-summary"] details')!
  expect(details).toBeTruthy()
  await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'))})
  const card=host.querySelector('.tamer-goal-card')!
  await click([...card.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent===tamerGoalsCopy.pt.tgPlan)!)
  expect(window.location.hash).toBe('#goal/seals?goal=session-goal')
}
async function calculate(){await clickText(copy.ppCalculateSeal);expect(registerButtons()).toHaveLength(2)}
function confirmation(){return {
  prepare:vi.fn((_before:SealStateMap,_after:SealStateMap)=>true),
  saved:vi.fn((_before:SealStateMap,_after:SealStateMap)=>true),failed:vi.fn(),
}}
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
  localStorage.clear();capture.props=null;capture.transition=null
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  expect(selected).toHaveLength(2);expect(recommendations.every(item=>item.bonusGain>0)).toBe(true)
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})

describe('goal-linked registration with real App and React',()=>{
  it.each(['acquisition','contextual'] as const)('registers two original totals sequentially through %s',async method=>{
    await mount();const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const original=snapshotDestinations(),savedGoal=localStorage.getItem('ladmo-tamer-goals-v1')
    for(const [index,item] of original.entries()){
      if(method==='contextual'){
        await click(editorButtons()[index])
        expect(host.querySelector<HTMLInputElement>('[role="dialog"] input')!.value).toBe(String(item.total))
        await clickText(copy.seReview);await clickText(copy.seConfirm)
      }else await click(registerButtons()[index])
      expect(states()[item.id].quantity).toBe(item.total)
      expect(registerButtons()[index].disabled).toBe(true)
      expect(registerButtons()[index].textContent).toContain(copy.ppStepRegistered)
      expect(snapshotDestinations()).toEqual(original);expect(optimize).toHaveBeenCalledTimes(1)
      const result=deriveTamerGoal(goal,goalTotals(states(),{}),{})!
      expect(host.querySelector<HTMLInputElement>('#seal-target')!.value).toBe(String(result.remaining))
      expect(host.querySelector('.progression-system > .progression-status')!.textContent).not.toContain(copy.ppRecalculate)
      if(index+1<original.length){expect(registerButtons()[index+1].disabled).toBe(false);expect(editorButtons()[index+1].disabled).toBe(false)}
    }
    expect(deriveTamerGoal(goal,goalTotals(states(),{}),{})!.complete).toBe(true)
    expect(host.querySelector('.progression-goal-summary')!.textContent).toContain(tamerGoalsCopy.pt.tgComplete)
    expect(host.querySelector('#seal-target')).not.toBeNull();expect(registerButtons()).toHaveLength(2)
    expect(localStorage.getItem('ladmo-tamer-goals-v1')).toBe(savedGoal)
    expect(localStorage.getItem('external-test-key')).toBe('preserve')
    await act(async()=>root.unmount());root=createRoot(host);await renderApp()
    original.forEach(item=>expect(states()[item.id].quantity).toBe(item.total))
    expect(host.querySelector('#seal-target')).not.toBeNull()
    expect(host.querySelectorAll('.plan-row')).toHaveLength(0);expect(optimize).toHaveBeenCalledTimes(1)
  })
  it('keeps a partial contextual edit pending and permits finishing its original total',async()=>{
    await mount();const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const original=snapshotDestinations()
    await click(editorButtons()[0]);await input('[role="dialog"] input','2001')
    await clickText(copy.seReview);await clickText(copy.seConfirm)
    expect(states()[original[0].id].quantity).toBe(2001);expect(snapshotDestinations()).toEqual(original)
    expect(registerButtons()[0].disabled).toBe(false);expect(editorButtons()[1].disabled).toBe(false)
    expect(optimize).toHaveBeenCalledTimes(1)
    await click(registerButtons()[0])
    expect(states()[original[0].id].quantity).toBe(original[0].total)
    expect(registerButtons()[0].disabled).toBe(true);expect(registerButtons()[1].disabled).toBe(false)
    expect(optimize).toHaveBeenCalledTimes(1)
  })
  it('cancel performs no preparation, acknowledgement or write',async()=>{
    await mount();await calculate()
    const before=localStorage.getItem('ladmo-seal-state-v2'),original=snapshotDestinations()
    await click(editorButtons()[0]);await input('[role="dialog"] input','2001');await clickText(copy.seReview)
    expect(capture.transition).toBeNull();await clickText(copy.seCancel)
    expect(capture.transition).toBeNull();expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(before)
    expect(snapshotDestinations()).toEqual(original);expect(editorButtons().every(button=>!button.disabled)).toBe(true)
  })
  it('acknowledges only after the committed state has been persisted',async()=>{
    await mount();const c=confirmation(),persist=vi.spyOn(playerDataRepository,'saveSealState')
    c.saved.mockImplementation((before,after)=>{
      expect(before[selected[0].id].quantity).toBe(2000);expect(capture.props!.sealStates).toBe(after)
      expect(states()).toEqual(after);expect(persist).toHaveBeenCalledWith(after);return true
    })
    await act(async()=>{capture.props!.addRecommendation(selected[0].id,1,c)})
    expect(c.prepare).toHaveBeenCalledOnce();expect(c.saved).toHaveBeenCalledOnce()
    expect(c.failed).not.toHaveBeenCalled();expect(persist).toHaveBeenCalledTimes(1)
  })
  it('prepare false does not write and is explicitly settled as failure',async()=>{
    await mount();const c=confirmation();c.prepare.mockReturnValue(false)
    const before=localStorage.getItem('ladmo-seal-state-v2'),persist=vi.spyOn(playerDataRepository,'saveSealState')
    await act(async()=>{capture.props!.addRecommendation(selected[0].id,1,c)})
    expect(c.failed).toHaveBeenCalledOnce();expect(c.saved).not.toHaveBeenCalled()
    expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(before);expect(persist).not.toHaveBeenCalled()
  })
  it('rejects a concurrent commit without overwriting the external record',async()=>{
    await mount();const c=confirmation(),originalProps=capture.props!
    const unrelated=seals.find(seal=>!selected.some(item=>item.id===seal.id))!
    c.prepare.mockImplementation(()=>{originalProps.addRecommendation(unrelated.id,1);return true})
    const persist=vi.spyOn(playerDataRepository,'saveSealState')
    await act(async()=>{originalProps.addRecommendation(selected[0].id,1,c)})
    expect(states()[selected[0].id].quantity).toBe(2000);expect(states()[unrelated.id].quantity).toBe(1)
    expect(c.saved).not.toHaveBeenCalled();expect(c.failed).toHaveBeenCalledOnce();expect(persist).toHaveBeenCalledTimes(1)
  })
  it('sealSaveAttempt does not persist again when the map is unchanged',async()=>{
    await mount();const c=confirmation(),persist=vi.spyOn(playerDataRepository,'saveSealState'),before=capture.props!.sealStates
    // Artificial callback exercises settlement; the real UI does not offer zero acquisition.
    await act(async()=>{capture.props!.addRecommendation(selected[0].id,0,c)})
    expect(capture.props!.sealStates).toBe(before);expect(persist).not.toHaveBeenCalled()
    expect(c.saved).toHaveBeenCalledExactlyOnceWith(before,before);expect(c.failed).not.toHaveBeenCalled()
  })
  it('saved false is settled once without retrying persistence',async()=>{
    await mount();const c=confirmation();c.saved.mockReturnValue(false)
    const persist=vi.spyOn(playerDataRepository,'saveSealState')
    await act(async()=>{capture.props!.addRecommendation(selected[0].id,1,c)})
    expect(c.saved).toHaveBeenCalledOnce();expect(c.failed).toHaveBeenCalledOnce()
    expect(persist).toHaveBeenCalledTimes(1);expect(states()[selected[0].id].quantity).toBe(2001)
  })
  it('a persistence exception never acknowledges the save',async()=>{
    await mount();const c=confirmation(),before=localStorage.getItem('ladmo-seal-state-v2')
    const failure=new Error('Test storage unavailable'),boundary=vi.spyOn(TestBoundary,'getDerivedStateFromError')
    vi.spyOn(console,'error').mockImplementation(()=>{})
    const persist=vi.spyOn(playerDataRepository,'saveSealState').mockImplementationOnce(()=>{throw failure})
    await act(async()=>{capture.props!.addRecommendation(selected[0].id,1,c)})
    expect(boundary).toHaveBeenCalledWith(failure);expect(persist).toHaveBeenCalledTimes(1)
    expect(c.saved).not.toHaveBeenCalled();expect(c.failed).toHaveBeenCalledOnce()
    expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(before)
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Test storage unavailable')
  })
  it('does not let an old confirmation invalidate a subsequently calculated route',async()=>{
    await mount();const optimize=vi.spyOn(engine,'optimizeGoal');await calculate();await click(registerButtons()[0])
    const old=capture.transition!;expect(old).not.toBeNull();await clickText(copy.ppCalculateSeal)
    const newDestinations=snapshotDestinations();expect(newDestinations).toHaveLength(1)
    await act(async()=>{old.confirmation.failed();expect(old.confirmation.saved(old.before,old.after)).toBe(false)})
    expect(snapshotDestinations()).toEqual(newDestinations);expect(editorButtons()[0].disabled).toBe(false)
    expect(optimize).toHaveBeenCalledTimes(2)
  })
  it('preserves the route through both own registrations in StrictMode',async()=>{
    await mount(true);const optimize=vi.spyOn(engine,'optimizeGoal'),persist=vi.spyOn(playerDataRepository,'saveSealState')
    await calculate();const original=snapshotDestinations();await click(registerButtons()[0])
    expect(editorButtons()[1].disabled).toBe(false);await click(registerButtons()[1])
    expect(snapshotDestinations()).toEqual(original);expect(registerButtons().every(button=>button.disabled)).toBe(true)
    expect(optimize).toHaveBeenCalledTimes(1);expect(persist).toHaveBeenCalledTimes(2)
  })
  it('blocks an external change even when it does not change the bonus',async()=>{
    await mount();const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const bonus=goalTotals(states(),{}).seals.HT
    await act(async()=>{capture.props!.addRecommendation(selected[0].id,1)})
    expect(goalTotals(states(),{}).seals.HT).toBe(bonus)
    expect(registerButtons().every(button=>button.disabled)).toBe(true)
    expect(editorButtons().every(button=>button.disabled)).toBe(true);expect(optimize).toHaveBeenCalledTimes(1)
  })
  it('preserves free planning and sequential acquisition without session callbacks',async()=>{
    await mount();await select('#planning-goal','');await select('#progression-objective','HT')
    const path=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.getAttribute('aria-pressed')!==null&&button.textContent?.startsWith('Seal Master'))!
    if(path.getAttribute('aria-pressed')!=='true')await click(path)
    await input('#seal-target',String(desiredGain));const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const original=snapshotDestinations();await click(registerButtons()[0])
    expect(registerButtons()[1].disabled).toBe(false);expect(editorButtons()[1].disabled).toBe(true)
    await click(registerButtons()[1]);original.forEach(item=>expect(states()[item.id].quantity).toBe(item.total))
    expect(capture.transition).toBeNull();expect(optimize).toHaveBeenCalledTimes(1)
  })
  it('preserves contextual editing in free planning before and after a save',async()=>{
    await mount();await select('#planning-goal','');await select('#progression-objective','HT')
    const path=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.getAttribute('aria-pressed')!==null&&button.textContent?.startsWith('Seal Master'))!
    if(path.getAttribute('aria-pressed')!=='true')await click(path)
    await input('#seal-target',String(desiredGain));const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const original=snapshotDestinations(),before=localStorage.getItem('ladmo-seal-state-v2')
    await click(editorButtons()[0]);expect(host.querySelector<HTMLInputElement>('[role="dialog"] input')!.value).toBe(String(original[0].total))
    await input('[role="dialog"] input','2001');await clickText(copy.seReview);await clickText(copy.seCancel)
    expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(before);expect(snapshotDestinations()).toEqual(original)
    expect(editorButtons()[0].disabled).toBe(false);expect(capture.transition).toBeNull()
    await click(editorButtons()[0]);await input('[role="dialog"] input','2001');await clickText(copy.seReview);await clickText(copy.seConfirm)
    expect(states()[original[0].id].quantity).toBe(2001);expect(snapshotDestinations()).toEqual(original)
    expect(editorButtons().every(button=>button.disabled)).toBe(true);expect(registerButtons()[1].disabled).toBe(false)
    expect(capture.transition).toBeNull();expect(optimize).toHaveBeenCalledTimes(1)
    await clickText(copy.ppCalculateSeal);expect(editorButtons().every(button=>!button.disabled)).toBe(true)
    expect(optimize).toHaveBeenCalledTimes(2)
  })
})

describe('incompatible contexts do not reuse a snapshot',()=>{
  async function standalone(){
    await mount();const props={...capture.props!}
    await act(async()=>root.unmount());root=createRoot(host)
    await act(async()=>root.render(<GoalPlanner {...props}/>));await clickText(copy.ppCalculateSeal)
    expect(registerButtons()).toHaveLength(2);return props
  }
  it.each(['attribute','target'] as const)('discards a route when %s changes',async field=>{
    const props=await standalone(),optimize=vi.spyOn(engine,'optimizeGoal')
    const changed:PlannerProps=field==='attribute'?{...props,attribute:'AT'}:{...props,goalTarget:props.goalTarget!+1}
    await act(async()=>root.render(<GoalPlanner {...changed}/>))
    expect(host.querySelectorAll('.plan-row')).toHaveLength(0);expect(optimize).not.toHaveBeenCalled()
  })
  it.each(['draft','strategy','budget'] as const)('discards a route when %s changes',async field=>{
    const props=await standalone();await select('#seal-strategy','ticketLimit');await input('#seal-budget','999999999');await clickText(copy.ppCalculateSeal)
    expect(registerButtons()).toHaveLength(2);const optimize=vi.spyOn(engine,'optimizeGoal')
    if(field==='draft')await input('#seal-target','77')
    else if(field==='strategy')await select('#seal-strategy','cheap')
    else await input('#seal-budget','999')
    expect(host.querySelectorAll('.plan-row')).toHaveLength(0);expect(optimize).not.toHaveBeenCalled()
    expect(props.goalDraft).toBe(String(desiredGain))
  })
  it('rejects an unlisted ID, a second changed record and a changed exclusion',async()=>{
    await standalone();await click(editorButtons()[0]);const props={...capture.props!}
    let current:SealRouteConfirmation|null=null
    await act(async()=>root.render(<GoalPlanner {...props} editSeal={(_id,_destination,confirmation)=>{current=confirmation??null}}/>))
    await click(editorButtons()[0]);expect(current).not.toBeNull()
    const before=props.sealStates,id=selected[0].id,unrelated=seals.find(seal=>!selected.some(item=>item.id===seal.id))!
    const wrongId=addRecommendedQuantity(before,unrelated.id,1),exclusion=updateSealState(before,id,{doNotRecommend:true})
    const secondChanged=updateSealState(addRecommendedQuantity(before,id,1),selected[1].id,{quantity:2001})
    expect(current!.prepare(before,wrongId)).toBe(false);expect(current!.prepare(before,exclusion)).toBe(false)
    expect(current!.prepare(before,secondChanged)).toBe(false)
  })
})
