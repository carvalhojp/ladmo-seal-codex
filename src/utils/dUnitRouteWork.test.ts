import { describe, expect, it } from 'vitest'
import type { DUnitCondition } from '../data/dUnitAudit'
import { compareDUnitRouteWork, describeDUnitRouteWork, type DUnitRouteWork } from './dUnitRouteWork'

const condition=(id:string,requirement:string):DUnitCondition=>({id,position:1,requirement,digimonNames:[],bonus:{rawLabel:'AT +1',attribute:'AT',value:1,unit:'absolute',confirmed:true},confirmed:true,evidence:''})
const work=(setId:string, requirement:string, members:string[], complete=true):DUnitRouteWork=>({setId,condition:condition(`${setId}-condition-1`,requirement),kind:requirement.startsWith('Nível')?'level':requirement.includes('Transcendidos')?'transcendence':'obtained',completeIdentity:complete,memberIds:members,memberNames:members,owned:[],ownedNames:[],missingOwned:0,missingOwnedIds:[],missingOwnedNames:[],missingEvolution:[],missingEvolutionIds:[],missingTranscendence:0,missingTranscendenceIds:[],missingTranscendenceNames:[]})

describe('audited D-Unit route work',()=>{
  it('only confirms reuse for the same audited form, never for equal text alone',()=>{
    expect(compareDUnitRouteWork([work('a','Obtido 3 Digimons',['same'])],[work('b','Obtido 3 Digimons',['same'])]).confirmedShared).toEqual(['same'])
    const different=compareDUnitRouteWork([work('a','Obtido 3 Digimons',['a','b','c'])],[work('b','Obtido 3 Digimons',['d','e','f'])])
    expect(different.confirmedShared).toEqual([])
    expect(different.similarButDifferent).toEqual(['Obtido 3 Digimons'])
  })
  it('keeps matching text unknown while either portrait composition is pending',()=>{
    const result=compareDUnitRouteWork([work('a','Nível Total dos Digimons 330',[],false)],[work('b','Nível Total dos Digimons 330',[],false)])
    expect(result.confirmedShared).toEqual([])
    expect(result.unknownSharing).toEqual(['Nível Total dos Digimons 330'])
  })
  it('uses individual form levels for a collective total without inferring equal levels',()=>{
    const result=describeDUnitRouteWork('fixture',condition('fixture-condition-1','Nível Total dos Digimons 330'),{levelByDigimonId:{a:150,b:70,c:40}},{complete:true,members:[
      {setId:'fixture',portraitIndex:1,digimonId:'a',canonicalName:'A',identityStatus:'confirmed',evolutionStatus:'unknown',rankStatus:'unknown',obtainmentStatus:'unknown',unlockStatus:'unknown',sources:[],note:''},
      {setId:'fixture',portraitIndex:2,digimonId:'b',canonicalName:'B',identityStatus:'confirmed',evolutionStatus:'unknown',rankStatus:'unknown',obtainmentStatus:'unknown',unlockStatus:'unknown',sources:[],note:''},
      {setId:'fixture',portraitIndex:3,digimonId:'c',canonicalName:'C',identityStatus:'confirmed',evolutionStatus:'unknown',rankStatus:'unknown',obtainmentStatus:'unknown',unlockStatus:'unknown',sources:[],note:''},
    ]})
    expect(result.levelRemaining).toBe(70)
  })
  it('uses the confirmed Tentomon line without treating individual evolution unlocks as automatic',()=>{
    const set=describeDUnitRouteWork('dunit-34',condition('dunit-34-condition-2','Nível Total dos Digimons 550'),{
      ownedDigimonIds:['tentomon'], levelByDigimonId:{tentomon:150,kabuterimon:100,megakabuterimon:50}, transcendedDigimonIds:['tentomon'],
    })
    expect(set.completeIdentity).toBe(true)
    expect(set.memberIds).toEqual(['tentomon','kabuterimon','megakabuterimon','herculeskabuterimon','tyrantkabuterimon'])
    expect(set.levelRemaining).toBe(250)
    expect(set.missingEvolution).toEqual(['Kabuterimon','MegaKabuterimon','HerculesKabuterimon','TyrantKabuterimon'])
  })
  it('removes only the individually unlocked forms while base ownership opens the shared acquisition line',()=>{
    const set=describeDUnitRouteWork('dunit-34',condition('dunit-34-condition-1','Obtido 5 Digimons'),{
      ownedDigimonIds:['tentomon'], unlockedEvolutionLineIds:['tentomon-line'], unlockedDigimonIds:['kabuterimon'],
    })
    expect(set.missingOwned).toBe(4)
    expect(set.missingEvolution).toEqual(['MegaKabuterimon','HerculesKabuterimon','TyrantKabuterimon'])
  })
  it('credits an owned Tentomon without completing its five-form requirement or auto-unlocking evolutions',()=>{
    const set=describeDUnitRouteWork('dunit-34',condition('dunit-34-condition-1','Obtido 5 Digimons'),{
      ownedDigimonIds:['tentomon'], levelByDigimonId:{tentomon:120},
    })
    expect(set.ownedNames).toEqual(['Tentomon'])
    expect(set.missingOwned).toBe(4)
    expect(set.missingOwnedNames).not.toContain('Tentomon')
    expect(set.missingEvolution).toEqual(['Kabuterimon','MegaKabuterimon','HerculesKabuterimon','TyrantKabuterimon'])
  })
  it('reports only outstanding shared forms, while preserving shared completed inventory credit separately',()=>{
    const player={ownedDigimonIds:['tentomon'],levelByDigimonId:{tentomon:120}}
    const obtained=condition('dunit-34-condition-1','Obtido 5 Digimons')
    const transcended=condition('dunit-34-condition-3','Obtido 5 Digimons Transcendidos')
    const left=[describeDUnitRouteWork('dunit-34',obtained,player),describeDUnitRouteWork('dunit-34',transcended,player)]
    const compared=compareDUnitRouteWork(left,left)
    expect(left[0]?.ownedNames).toEqual(['Tentomon'])
    expect(compared.remainingShared).toEqual(['HerculesKabuterimon','Kabuterimon','MegaKabuterimon','Tentomon','TyrantKabuterimon'])
    expect(compared.remainingOnlyLeft).toEqual([])
    expect(compared.remainingOnlyRight).toEqual([])
  })
})
