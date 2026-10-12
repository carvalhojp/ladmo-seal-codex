import { emptyTamerGoals, readTamerGoals, type TamerGoalsState } from './tamerGoals'
import { describe, expect, it } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { seals } from '../data/seals'
import { applyLadmoSave, createLadmoSave, parseLadmoSave, saveFormat, saveVersion, serializeLadmoSave } from './saveBackup'

const sealId = 'seal-16709'
const set = dUnitSets[0]
const conditionId = set.conditions[0].id
const source = () => createLadmoSave({ exportedAt:'2026-10-04T12:00:00.000Z', data:{goals:emptyTamerGoals(), seals:{[sealId]:{quantity:50,hasSeal:true,doNotRecommend:false}}, dUnitProgress:{[set.id]:{[conditionId]:true}}, dUnitInventory:{quantumon:{owned:true,level:130}} }, preferences:{language:'pt'} })
const storage = (values:Record<string,string> = {}, failKey?:string) => ({
  getItem:(key:string)=>values[key] ?? null,
  setItem:(key:string,value:string)=>{if(key===failKey)throw new Error('write failed');values[key]=value},
  removeItem:(key:string)=>{delete values[key]},
})

describe('LADMO Codex Save v1', () => {
  it('round-trips archives through Save V3 without changing its envelope or player data',()=>{
    const original=source()
    const goals:TamerGoalsState={version:1,goals:[
      {id:'archived-attribute',type:'attribute',metric:{system:'seals',attribute:'AT'},baseline:20,desiredGain:300,archived:true},
      {id:'archived-set',type:'dunit-set',setId:set.id,archived:true},
    ]}
    const save=createLadmoSave({data:{...original.data,goals},preferences:original.preferences})
    expect(save.version).toBe(3);expect(Object.keys(save).sort()).toEqual(Object.keys(original).sort())
    const parsed=parseLadmoSave(serializeLadmoSave(save));expect(parsed.ok).toBe(true)
    if(!parsed.ok)throw new Error('Save rejected')
    expect(parsed.preview.goals).toBe(2)
    const io=storage();applyLadmoSave(io,parsed.save)
    expect(readTamerGoals(io).state).toEqual(goals)
    expect(parsed.save.data.seals).toEqual(original.data.seals)
    expect(parsed.save.data.dUnitProgress).toEqual(original.data.dUnitProgress)
    for(const version of [2,3]){
      const old=parseLadmoSave(JSON.stringify({...save,version,data:{...save.data,goals:{version:1,goals:goals.goals.map(({archived,...goal})=>goal)}}}))
      expect(old.ok).toBe(true)
      if(old.ok)expect('goals' in old.save.data && old.save.data.goals.goals.every(goal=>!goal.archived)).toBe(true)
    }
  })
  it('exports only versioned player progress, inventory and language', () => {
    const save=source(), raw=JSON.parse(serializeLadmoSave(save))
    expect(raw).toMatchObject({format:saveFormat,version:saveVersion,exportedAt:'2026-10-04T12:00:00.000Z',preferences:{language:'pt'}})
    expect(raw.data).toEqual(save.data)
    expect(JSON.stringify(raw)).not.toContain('ladmo-owned')
    expect(JSON.stringify(raw)).not.toContain('ladmo-tickets')
    expect(JSON.stringify(raw)).not.toContain('ladmo-openers')
  })

  it('rejects malformed JSON, a wrong format/version, or missing required structures', () => {
    expect(parseLadmoSave('{')).toMatchObject({ok:false,error:'invalidJson'})
    expect(parseLadmoSave(JSON.stringify({...source(),format:'other'}))).toMatchObject({ok:false,error:'invalidFormat'})
    expect(parseLadmoSave(JSON.stringify({...source(),version:999}))).toMatchObject({ok:false,error:'unsupportedVersion'})
    expect(parseLadmoSave(JSON.stringify({format:saveFormat,version:1,exportedAt:'not-a-date',data:{goals:emptyTamerGoals(),},preferences:{language:'pt'}}))).toMatchObject({ok:false,error:'invalidStructure'})
  })

  it('keeps known records, drops unknown records, and reports their count', () => {
    const raw={...source(),version:2,data:{goals:emptyTamerGoals(),seals:{[sealId]:{quantity:50,hasSeal:true},unknown:{quantity:1}},dUnitProgress:{[set.id]:{[conditionId]:true,unknown:true},'dunit-unknown':{x:true}},dUnitInventory:{quantumon:{owned:true},unknown:{owned:true}}}}
    const result=parseLadmoSave(JSON.stringify(raw))
    expect(result.ok).toBe(true)
    if(result.ok){expect(result.save.data.seals[sealId]?.quantity).toBe(50);expect(result.save.data.dUnitProgress).toEqual({[set.id]:{[conditionId]:true}});expect(result.save.data.dUnitInventory).toEqual({quantumon:{owned:true,evolutionUnlocked:false,transcended:false}});expect(result.preview.ignoredRecords).toBe(4)}
  })

  it('counts owned Seals for the preview instead of every saved card state', () => {
    const states=Object.fromEntries(seals.slice(0,39).map(seal=>[seal.id,{quantity:0,hasSeal:false,doNotRecommend:false}]))
    Object.assign(states,{[seals[0].id]:{quantity:3000,hasSeal:true,doNotRecommend:false},[seals[1].id]:{quantity:3000,hasSeal:true,doNotRecommend:false},[seals[2].id]:{quantity:3000,hasSeal:true,doNotRecommend:false},[seals[3].id]:{quantity:0,hasSeal:false,doNotRecommend:true}})
    const result=parseLadmoSave(JSON.stringify({...source(),version:2,data:{goals:emptyTamerGoals(),seals:states,dUnitProgress:{[set.id]:{[conditionId]:true}},dUnitInventory:{}}}))
    expect(Object.keys(states)).toHaveLength(39)
    expect(result.ok).toBe(true)
    if(result.ok) expect(result.preview.seals).toBe(3)
  })

  it('preserves the supported historical Seal and D-Unit inventory aliases', () => {
    const raw={...source(),version:2,data:{goals:emptyTamerGoals(),seals:{'seal-22829':{quantity:75,hasSeal:true}},dUnitProgress:{},dUnitInventory:{'omegamon-x-supremacy':{owned:true}}}}
    const result=parseLadmoSave(JSON.stringify(raw))
    expect(result.ok).toBe(true)
    if(result.ok){expect(result.save.data.seals['seal-19435']).toMatchObject({quantity:75,hasSeal:true});expect(result.save.data.dUnitInventory['omegamon-resistance-supremacy']).toMatchObject({owned:true})}
  })

  it('does not write while validating and atomically replaces only Save V1 keys after confirmation', () => {
    const values:Record<string,string>={'ladmo-lang':'"en"','ladmo-seal-state-v2':'old','ladmo-dunit-progress-v1':'old','ladmo-dunit-inventory-v1':'old','ladmo-tickets':'500'}
    const result=parseLadmoSave(serializeLadmoSave(source()))
    expect(values['ladmo-seal-state-v2']).toBe('old')
    if(result.ok)applyLadmoSave(storage(values),result.save)
    expect(JSON.parse(values['ladmo-lang'])).toBe('pt')
    expect(JSON.parse(values['ladmo-seal-state-v2'])[sealId].quantity).toBe(50)
    expect(values['ladmo-tickets']).toBe('500')
  })

  it('restores the previous storage values if a write fails', () => {
    const values:Record<string,string>={'ladmo-lang':'"en"','ladmo-seal-state-v2':'old-seals','ladmo-dunit-progress-v1':'old-progress','ladmo-dunit-inventory-v1':'old-inventory'}
    expect(()=>applyLadmoSave(storage(values,'ladmo-dunit-progress-v1'),source())).toThrow('write failed')
    expect(values).toEqual({'ladmo-lang':'"en"','ladmo-seal-state-v2':'old-seals','ladmo-dunit-progress-v1':'old-progress','ladmo-dunit-inventory-v1':'old-inventory'})
  })

  it('round-trips relevant progress after later local changes', () => {
    const saved=source(), changed=createLadmoSave({data:{goals:emptyTamerGoals(),seals:{},dUnitProgress:{},dUnitInventory:{}},preferences:{language:'en'}}), values:Record<string,string>={}
    applyLadmoSave(storage(values),changed)
    const parsed=parseLadmoSave(serializeLadmoSave(saved))
    if(parsed.ok)applyLadmoSave(storage(values),parsed.save)
    expect(JSON.parse(values['ladmo-seal-state-v2'])).toEqual(saved.data.seals)
    expect(JSON.parse(values['ladmo-dunit-progress-v1'])).toEqual(saved.data.dUnitProgress)
    expect(JSON.parse(values['ladmo-dunit-inventory-v1'])).toEqual(saved.data.dUnitInventory)
    expect(JSON.parse(values['ladmo-lang'])).toBe('pt')
  })
})
