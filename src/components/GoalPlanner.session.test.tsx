// @vitest-environment jsdom
import { act, Component, StrictMode, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { GoalPlanner, routeAcquisitionProgress, type SealRouteConfirmation } from './GoalPlanner'
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
  it('investigates free AT 1000 partial Guilmon editing and both filters without replacing the route',async()=>{
    // The manual inventory/exclusions were not supplied. Use the real catalogue
    // with every quantity at zero and no exclusions; never mock the optimizer.
    localStorage.setItem('ladmo-lang',JSON.stringify('pt'))
    localStorage.setItem('ladmo-seal-state-v2',JSON.stringify({}))
    localStorage.setItem('ladmo-tamer-goals-v1',JSON.stringify({version:1,goals:[]}))
    window.history.replaceState(null,'','#goal')
    await renderApp()
    // Select through the actual UI so the test also covers coordinator state.
    await select('#progression-objective','AT')
    const path=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.startsWith('Seal Master')&&button.hasAttribute('aria-pressed'))!
    if(path.getAttribute('aria-pressed')!=='true')await click(path)
    await input('#seal-target','1000')
    const optimize=vi.spyOn(engine,'optimizeGoal')
    await clickText(copy.ppCalculateSeal)
    expect(optimize).toHaveBeenCalledTimes(1)
    const originalPlan=optimize.mock.results[0].value as engine.GoalPlan
    expect(originalPlan).toBeTruthy()
    const original=JSON.stringify(originalPlan),destinations=snapshotDestinations()
    const guilmon=originalPlan.recommendations.find(item=>item.seal.name==='Guilmon')!
    expect(guilmon).toBeTruthy();expect(guilmon.finalQuantity).toBe(200)
    expect(guilmon.finalQuantity-guilmon.additionalSeals).toBe(0)
    console.info('AT 1000 zero-inventory diagnostic',{
      gain:originalPlan.totalBonus,seals:originalPlan.totalAdditionalSeals,
      tickets:originalPlan.totalTickets,openers:originalPlan.totalOpeners,steps:destinations.length,
    })
    const summary=()=>host.querySelector('.plan-output > .plan-stats')!.textContent
    const originalSummary=summary(),originalHeading=host.querySelector('.plan-output h2')!.textContent
    const progress=()=>host.querySelector<HTMLProgressElement>('progress[aria-label="'+copy.ppRouteQuantityProgress+'"]')!
    expect(progress().value).toBe(0)
    const plannerInput=host.querySelector('#seal-target')!
    await click(editorButtons().find(button=>button.dataset.sealId===guilmon.seal.id)!)
    await input('[role="dialog"] input','20');await clickText(copy.seReview);await clickText(copy.seConfirm)
    expect(states()[guilmon.seal.id].quantity).toBe(20)
    expect(host.querySelector('#seal-target')).toBe(plannerInput) // no remount
    expect(optimize).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(originalPlan)).toBe(original)
    expect(snapshotDestinations()).toEqual(destinations)
    expect(summary()).toBe(originalSummary);expect(host.querySelector('.plan-output h2')!.textContent).toBe(originalHeading)
    expect(progress().value).toBeCloseTo(20/originalPlan.totalAdditionalSeals*100,8)
    const guilmonRow=()=>[...host.querySelectorAll<HTMLElement>('.plan-row')].find(row=>row.querySelector<HTMLButtonElement>('[data-seal-id]')?.dataset.sealId===guilmon.seal.id)!
    expect(guilmonRow().querySelector('.recommendation-add')!.textContent).toContain('180')
    expect(host.textContent).toContain(copy.ppSealStale)
    expect(editorButtons().every(button=>!button.disabled)).toBe(true)
    for(const filter of [copy.ppOnlyPending,copy.ppAllItems,copy.ppOnlyPending,copy.ppAllItems]){
      await clickText(filter)
      expect(registerButtons()).toHaveLength(destinations.length)
      expect(guilmonRow()).toBeTruthy();expect(snapshotDestinations()).toEqual(destinations)
      expect(summary()).toBe(originalSummary);expect(optimize).toHaveBeenCalledTimes(1)
      expect(progress().value).toBeCloseTo(20/originalPlan.totalAdditionalSeals*100,8)
    }
    for(const quantity of [75,150,200,75]){
      await click(guilmonRow().querySelector<HTMLButtonElement>('[data-seal-id]')!)
      expect(host.querySelector('[role="dialog"]')!.textContent).toContain(String(states()[guilmon.seal.id].quantity))
      await input('[role="dialog"] input',String(quantity));await clickText(copy.seReview);await clickText(copy.seConfirm)
      expect(states()[guilmon.seal.id].quantity).toBe(quantity)
      expect(snapshotDestinations()).toEqual(destinations);expect(summary()).toBe(originalSummary)
      expect(JSON.stringify(originalPlan)).toBe(original)
      expect(progress().value).toBeCloseTo(quantity/originalPlan.totalAdditionalSeals*100,8)
      await clickText(copy.ppOnlyPending)
      expect(registerButtons()).toHaveLength(destinations.length-(quantity===200?1:0))
      await clickText(copy.ppAllItems)
      expect(guilmonRow().textContent).toContain(String(200-quantity))
      expect(optimize).toHaveBeenCalledTimes(1)
    }
    await clickText(copy.ppCalculateSeal)
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull()
    await clickText(copy.ppKeepRoute)
    expect(snapshotDestinations()).toEqual(destinations)
    await act(async()=>root.unmount());root=createRoot(host);await renderApp()
    expect(states()[guilmon.seal.id].quantity).toBe(75)
    expect(host.querySelector('progress[aria-label="'+copy.ppRouteQuantityProgress+'"]')).toBeNull()
  })
  it('archives and restores a completed goal through real App persistence and F5',async()=>{
    await mount();await calculate()
    await click(registerButtons()[0]);await click(registerButtons()[1])
    const t=capture.props!.t,sealsBefore=localStorage.getItem('ladmo-seal-state-v2'),dunitBefore=localStorage.getItem('ladmo-dunit-progress-v1')
    const openGoals=async()=>{
      const details=host.querySelector<HTMLDetailsElement>('section[aria-labelledby="tamer-goals-summary"] details')!
      await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'))})
    }
    await click([...host.querySelectorAll<HTMLButtonElement>('nav button')].find(button=>button.textContent===t.myTamer)!)
    await openGoals();await clickText(tamerGoalsCopy.pt.tgArchive)
    expect(JSON.parse(localStorage.getItem('ladmo-tamer-goals-v1')!).goals).toEqual([{...goal,archived:true}])
    expect(host.querySelector<HTMLDetailsElement>('details > summary')?.parentElement).toBeTruthy()
    await act(async()=>root.unmount());root=createRoot(host);await renderApp();await openGoals()
    const archive=[...host.querySelectorAll<HTMLDetailsElement>('details')].find(details=>details.querySelector('summary')?.textContent?.startsWith(tamerGoalsCopy.pt.tgArchivedGoals))!
    expect(archive).toBeTruthy();expect(archive.open).toBe(false)
    expect(archive.textContent).toContain(tamerGoalsCopy.pt.tgComplete)
    await clickText(tamerGoalsCopy.pt.tgRestore)
    expect(JSON.parse(localStorage.getItem('ladmo-tamer-goals-v1')!).goals).toEqual([{...goal,archived:false}])
    expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(sealsBefore)
    expect(localStorage.getItem('ladmo-dunit-progress-v1')).toBe(dunitBefore)
    expect(localStorage.getItem('external-test-key')).toBe('preserve')
  })
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
    expect(host.querySelector('progress[aria-label="'+copy.ppRouteQuantityProgress+'"]')).toBeNull()
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
  it('filters only the view and updates quantity progress without recalculating',async()=>{
    await mount();const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const original=snapshotDestinations(),progress=()=>host.querySelector<HTMLProgressElement>('progress[aria-label="'+copy.ppRouteQuantityProgress+'"]')!
    expect(progress().value).toBe(0)
    await click(editorButtons()[0]);await input('[role="dialog"] input','2001')
    await clickText(copy.seReview);await clickText(copy.seCancel)
    expect(progress().value).toBe(0)
    await click(editorButtons()[0]);await input('[role="dialog"] input','2001')
    await clickText(copy.seReview);await clickText(copy.seConfirm)
    expect(progress().value).toBeGreaterThan(0);expect(progress().value).toBeLessThan(100)
    expect(host.querySelector('.plan-row')!.textContent).toContain('2.001')
    await click(registerButtons()[0]);expect(progress().value).toBeGreaterThan(0)
    await clickText(copy.ppOnlyPending)
    expect(registerButtons()).toHaveLength(1)
    expect(snapshotDestinations()).toEqual([original[1]])
    await clickText(copy.ppAllItems);expect(snapshotDestinations()).toEqual(original)
    await click(registerButtons()[1]);expect(progress().value).toBe(100)
    await clickText(copy.ppOnlyPending);expect(registerButtons()).toHaveLength(0)
    expect(host.textContent).toContain(copy.ppNoPendingAcquisitions)
    await clickText(copy.ppAllItems);expect(snapshotDestinations()).toEqual(original)
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
    expect(optimize).toHaveBeenCalledTimes(1)
    await clickText(copy.ppKeepRoute)
    expect(snapshotDestinations()).toHaveLength(2)
    await clickText(copy.ppCalculateSeal)
    await click(host.querySelector<HTMLButtonElement>('[role="alertdialog"] button:last-child')!)
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
    expect(host.textContent).toContain(copy.ppSealStale)
    await clickText(copy.ppOnlyPending)
    expect(registerButtons().every(button=>button.disabled)).toBe(true)
  })
  it('preserves free planning and sequential acquisition without session callbacks',async()=>{
    await mount();await select('#planning-goal','');await select('#progression-objective','HT')
    const path=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.getAttribute('aria-pressed')!==null&&button.textContent?.startsWith('Seal Master'))!
    if(path.getAttribute('aria-pressed')!=='true')await click(path)
    await input('#seal-target',String(desiredGain));const optimize=vi.spyOn(engine,'optimizeGoal');await calculate()
    const original=snapshotDestinations();await click(registerButtons()[0])
    expect(registerButtons()[1].disabled).toBe(false);expect(editorButtons()[1].disabled).toBe(false)
    await click(registerButtons()[1]);original.forEach(item=>expect(states()[item.id].quantity).toBe(item.total))
    expect(host.querySelector<HTMLProgressElement>('progress[aria-label="'+copy.ppRouteQuantityProgress+'"]')!.value).toBe(100)
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
    expect(editorButtons().every(button=>!button.disabled)).toBe(true);expect(registerButtons()[1].disabled).toBe(false)
    expect(capture.transition).toBeNull();expect(optimize).toHaveBeenCalledTimes(1)
    const recorded=localStorage.getItem('ladmo-seal-state-v2')
    const progressBefore=host.querySelector<HTMLProgressElement>('progress')!.value
    await clickText(copy.ppCalculateSeal)
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain(copy.ppRecalculateWarning)
    expect(optimize).toHaveBeenCalledTimes(1)
    await clickText(copy.ppKeepRoute)
    expect(snapshotDestinations()).toEqual(original)
    expect(host.querySelector<HTMLProgressElement>('progress')!.value).toBe(progressBefore)
    expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(recorded)
    await clickText(copy.ppCalculateSeal)
    await click(host.querySelector<HTMLButtonElement>('[role="alertdialog"] button:last-child')!)
    expect(editorButtons().every(button=>!button.disabled)).toBe(true)
    expect(localStorage.getItem('ladmo-seal-state-v2')).toBe(recorded)
    expect(host.querySelector<HTMLProgressElement>('progress[aria-label="'+copy.ppRouteQuantityProgress+'"]')!.value).toBe(0)
    expect(optimize).toHaveBeenCalledTimes(2)
  })
})

describe('route acquisition quantities',()=>{
  it.each(['pt','en','es','ko'] as const)('provides localized route confirmation and pending explanation in %s',lang=>{
    const text=progressionPlannerCopy[lang]
    expect(text.ppKeepRoute).toBeTruthy()
    expect(text.ppAllPending).toBeTruthy()
    expect(text.ppRecalculateWarning).toBeTruthy()
    if(lang!=='pt')expect(text.ppRecalculateWarning).not.toBe(copy.ppRecalculateWarning)
  })
  const seal=selected[0]
  const plan:engine.GoalPlan={recommendations:[{seal,level:'bronze',levelLabel:'Bronze',finalQuantity:50,additionalSeals:50,bonusGain:1,tickets:1,openers:1}],totalBonus:1,totalTickets:1,totalOpeners:1,totalAdditionalSeals:50,excess:0}
  it('keeps the original total and calculates 30 remaining after registering 20',()=>{
    const result=routeAcquisitionProgress(plan,{[seal.id]:{quantity:20,hasSeal:true,doNotRecommend:false}})
    expect(result.percent).toBe(40);expect(result.completed).toBe(0)
    expect(result.items[0]).toMatchObject({initial:0,current:20,remaining:30,acquired:20})
    expect(plan.recommendations[0].finalQuantity).toBe(50)
  })
  it('caps over-target quantities and excludes pre-existing quantities from progress',()=>{
    expect(routeAcquisitionProgress(plan,{[seal.id]:{quantity:80,hasSeal:true,doNotRecommend:false}})).toMatchObject({percent:100,completed:1})
    const partial={...plan,recommendations:[{...plan.recommendations[0],additionalSeals:30}]}
    expect(routeAcquisitionProgress(partial,{[seal.id]:{quantity:10,hasSeal:true,doNotRecommend:false}}).percent).toBe(0)
    expect(routeAcquisitionProgress(partial,{[seal.id]:{quantity:35,hasSeal:true,doNotRecommend:false}}).percent).toBe(50)
  })
  it('handles empty routes and zero additional quantities without division by zero',()=>{
    expect(routeAcquisitionProgress({...plan,recommendations:[]},{})).toMatchObject({percent:0,completed:0})
    expect(routeAcquisitionProgress({...plan,recommendations:[{...plan.recommendations[0],additionalSeals:0}]},{}).percent).toBe(0)
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
