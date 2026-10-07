import { describe, expect, it, vi } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { seals } from '../data/seals'
import { deriveTamerGoal, emptyTamerGoals, goalDisplayValue, goalPlannerIntent, goalTotals, newTamerGoalId, readTamerGoals, tamerGoalsKey, validateTamerGoals, type TamerGoal } from './tamerGoals'
import { createLocalPlayerDataRepository } from './playerDataRepository'
import { applyLadmoSave, createLadmoSave, parseLadmoSave } from './saveBackup'
import { parseProgressionTarget } from './progressionPlanner'

const goal: TamerGoal = { id:'test-goal', type:'attribute', metric:{system:'seals',attribute:'HT'}, baseline:700, desiredGain:500 }
const state = () => ({version:1 as const,goals:[goal]})
const totals = (ht:number) => ({...goalTotals({},{}),seals:{...goalTotals({},{}).seals,HT:ht}})
const storage = (values:Record<string,string> = {}) => ({getItem:(key:string)=>values[key]??null,setItem:(key:string,value:string)=>{values[key]=value},removeItem:(key:string)=>{delete values[key]}})

describe('Tamer goals',()=>{
  it.each([[700,0,500,false],[900,200,300,false],[1300,500,0,true],[1000,300,200,false],[600,0,600,false]])('derives baseline progress at %i', (current,done,remaining,complete)=>{
    expect(deriveTamerGoal(goal,totals(current),{})).toMatchObject({done,remaining,complete})
  })
  it('keeps baseline during gain editing; remaining intent is not original gain',()=>{
    expect(deriveTamerGoal({...goal,desiredGain:600},totals(900),{})).toMatchObject({done:200,remaining:400})
    expect(goalPlannerIntent(goal,totals(900),{})).toMatchObject({system:'seals',objective:'HT',draft:'300'})
    expect(goalPlannerIntent(goal,totals(1200),{})).toBeNull()
  })
  it('does not count ownership at quantity zero as a bonus',()=>{
    const seal=seals.find(seal=>seal.attribute==='HT')!
    expect(goalTotals({[seal.id]:{quantity:0,hasSeal:true,doNotRecommend:false}},{}).seals.HT).toBe(0)
  })
  it('keeps systems and percent units separate',()=>{
    expect(parseProgressionTarget('10','percent','seals')).toEqual({ok:true,value:1000})
    expect(goalDisplayValue({system:'seals',attribute:'CT'},1000)).toBe(10)
    const dunitGoal:TamerGoal={...goal,metric:{system:'dunit',bonusKey:'EXP||percent'},baseline:20,desiredGain:300}
    const current={...totals(900),dunit:{'EXP||percent':120}}
    expect(deriveTamerGoal(dunitGoal,current,{})).toMatchObject({done:100,remaining:200})
    expect(goalPlannerIntent(dunitGoal,current,{})).toMatchObject({draft:'200',bonusKey:'EXP||percent'})
  })
  it('derives D-Unit completion and reopens when a condition is unchecked, independent of inventory',()=>{
    const set=dUnitSets[0], setGoal:TamerGoal={id:'set-goal',type:'dunit-set',setId:set.id}
    for(let count=0;count<=4;count++){
      const progress={[set.id]:Object.fromEntries(set.conditions.slice(0,count).map(condition=>[condition.id,true]))}
      expect(deriveTamerGoal(setGoal,totals(0),progress)).toMatchObject({done:count,total:4,complete:count===4})
    }
    expect(deriveTamerGoal(setGoal,totals(0),{[set.id]:{[set.conditions[0].id]:true}})).toMatchObject({complete:false})
  })
  it('preserves unavailable references without treating them as completed',()=>{
    const unknown:TamerGoal={id:'unknown',type:'dunit-set',setId:'dunit-999999'}
    expect(validateTamerGoals({version:1,goals:[unknown]})?.goals).toEqual([unknown])
    expect(deriveTamerGoal(unknown,totals(0),{})).toBeNull()
    const metric:TamerGoal={...goal,metric:{system:'dunit',bonusKey:'Future||percent'}}
    expect(validateTamerGoals({version:1,goals:[metric]})).not.toBeNull()
    expect(deriveTamerGoal(metric,totals(0),{})).toBeNull()
  })
  it('validates limit, IDs, type, metric, numeric values and strips derived fields',()=>{
    expect(validateTamerGoals({version:1,goals:[0,1,2].map(i=>({...goal,id:`g${i}`}))})).not.toBeNull()
    expect(validateTamerGoals({version:1,goals:[0,1,2,3].map(i=>({...goal,id:`g${i}`}))})).toBeNull()
    expect(validateTamerGoals({version:1,goals:[goal,goal]})).toBeNull()
    for(const patch of [{id:''},{type:'manual'},{baseline:-1},{baseline:NaN},{desiredGain:Infinity},{desiredGain:0},{metric:{system:'both'}},{metric:{system:'seals',attribute:'EXP'}},{metric:{system:'dunit',bonusKey:'EXP'}}]) expect(validateTamerGoals({version:1,goals:[{...goal,...patch}]})).toBeNull()
    expect(validateTamerGoals({version:1,goals:[{...goal,completed:true,label:'test'}]})).toEqual(state())
  })
  it('generates independent IDs with Web Crypto fallback and checks collisions',()=>{
    const cryptoApi={randomUUID:vi.fn().mockReturnValueOnce('test-goal').mockReturnValue('new-id'),getRandomValues:vi.fn()} as unknown as Crypto
    expect(newTamerGoalId([goal],cryptoApi)).toBe('new-id')
    const fallback={getRandomValues:(bytes:Uint8Array)=>bytes.fill(10)} as Crypto
    expect(newTamerGoalId([],fallback)).toMatch(/^[a-f0-9]{32}$/)
    expect(()=>newTamerGoalId([{...goal,id:'new-id'}],cryptoApi)).toThrow()
  })
  it('loads absent storage without writing; preserves corrupt and unknown-version data',()=>{
    expect(readTamerGoals(storage())).toEqual({state:emptyTamerGoals()})
    for(const raw of ['{',JSON.stringify({version:999,goals:[]})]){
      const values={[tamerGoalsKey]:raw}, repo=createLocalPlayerDataRepository(()=>storage(values))
      expect(repo.loadLocalState().goals.error).toBeTruthy()
      expect(()=>repo.saveTamerGoals(state())).toThrow()
      expect(values[tamerGoalsKey]).toBe(raw)
    }
  })
  it('persists/reloads and removes only goals; storage failures propagate',()=>{
    const values={external:'keep'}, io=storage(values), repo=createLocalPlayerDataRepository(()=>io)
    repo.saveTamerGoals(state())
    expect(createLocalPlayerDataRepository(()=>io).loadLocalState().goals.state).toEqual(state())
    repo.saveTamerGoals(emptyTamerGoals())
    expect(repo.loadLocalState().goals.state.goals).toEqual([])
    expect(values.external).toBe('keep')
    const broken=createLocalPlayerDataRepository(()=>({...io,setItem:()=>{throw Error('full')}}))
    expect(()=>broken.saveTamerGoals(state())).toThrow('full')
  })
  it('exports/restores V2 baseline and accepts V1 with explicit removal preview',()=>{
    const save=createLadmoSave({data:{seals:{},dUnitProgress:{},dUnitInventory:{},goals:state()},preferences:{language:'pt'}})
    expect(save.version).toBe(2)
    const parsed=parseLadmoSave(JSON.stringify(save))
    expect(parsed.ok&&parsed.preview.goals).toBe(1)
    const values:Record<string,string>={},io=storage(values)
    if(parsed.ok)applyLadmoSave(io,parsed.save)
    expect(readTamerGoals(io).state).toEqual(state())
    const legacy={...save,version:1,data:{seals:{},dUnitProgress:{},dUnitInventory:{}}}
    const old=parseLadmoSave(JSON.stringify(legacy))
    expect(old.ok&&old.preview.removesGoals).toBe(true)
    expect(readTamerGoals(io).state).toEqual(state()) // preview/cancel does not write
    if(old.ok)applyLadmoSave(io,old.save)
    expect(readTamerGoals(io).state).toEqual(emptyTamerGoals())
    expect(parseLadmoSave(JSON.stringify({...save,data:legacy.data})).ok).toBe(false)
  })
  it.each(['ladmo-seal-state-v2',tamerGoalsKey])('rolls back every snapshot field after failure at %s',key=>{
    const values:Record<string,string>={'ladmo-lang':'"ko"','ladmo-seal-state-v2':'old','ladmo-dunit-progress-v1':'old','ladmo-dunit-inventory-v1':'old',[tamerGoalsKey]:JSON.stringify(state())},before={...values},io=storage(values)
    let fail=true
    const broken={...io,setItem:(name:string,value:string)=>{if(name===key&&fail){fail=false;throw Error('full')}io.setItem(name,value)}}
    const save=createLadmoSave({data:{seals:{},dUnitProgress:{},dUnitInventory:{},goals:emptyTamerGoals()},preferences:{language:'pt'}})
    expect(()=>applyLadmoSave(broken,save)).toThrow('full')
    expect(values).toEqual(before)
  })
})
