import { describe, expect, it } from 'vitest'
import { mainProgressionAttributes, otherProgressionAttributes, parseProgressionBudget, parseProgressionTarget, progressionDUnitOptions, progressionSubtypeLabelKey, progressionSystems, progressionUnit } from './progressionPlanner'

describe('progression objective units and human input',()=>{
  it('exposes eight main objectives and four D-Unit-only objectives without equipment aliases',()=>{
    expect(mainProgressionAttributes).toEqual(['AT','HT','CT','HP','DS','DE','BL','EV'])
    expect(otherProgressionAttributes).toEqual(['EXP','SCD','Dano habilidade','Dano de atributo básico'])
    for(const objective of mainProgressionAttributes)expect(progressionSystems(objective)).toEqual(['seals','dunit'])
    for(const objective of otherProgressionAttributes)expect(progressionSystems(objective)).toEqual(['dunit'])
    for(const alias of ['ATT','AT%','DF','DC','SKILL%','AS',''])expect(progressionSystems(alias)).toEqual([])
  })
  it('keeps Seal percentages and D-Unit points distinct for CT, BL and EV',()=>{
    for(const objective of ['CT','BL','EV'] as const){
      expect(progressionUnit(objective,'seals')).toBe('percent')
      expect(progressionUnit(objective,'dunit')).toBe('absolute')
      for(const [input,value] of [['1',100],['1,25',125],['1.25',125],['0,01',1]] as const)expect(parseProgressionTarget(input,progressionUnit(objective,'seals'),'seals')).toEqual({ok:true,value})
    }
  })
  it('does not multiply D-Unit percentages by 100',()=>{
    for(const objective of otherProgressionAttributes){
      expect(progressionUnit(objective,'dunit')).toBe('percent')
      expect(parseProgressionTarget('1,25','percent','dunit')).toEqual({ok:true,value:1.25})
      expect(parseProgressionTarget('1.25','percent','dunit')).toEqual({ok:true,value:1.25})
    }
    expect(parseProgressionTarget('500','absolute','seals')).toEqual({ok:true,value:500})
  })
  it.each(['','0','-1','1,25','1.25','NaN','Infinity','1e3','1.000','1,000','1 000','9007199254740992'])('rejects invalid absolute target %s',input=>expect(parseProgressionTarget(input,'absolute','dunit').ok).toBe(false))
  it.each(['','0','-1','1.234','1,234','1e3','NaN','Infinity','1.000,00','1 000','9007199254740992'])('rejects invalid percent target %s',input=>expect(parseProgressionTarget(input,'percent','seals').ok).toBe(false))
  it('requires 15 canonical skill types and no aggregate all-types goal',()=>{
    const options=progressionDUnitOptions('Dano habilidade')
    expect(options).toHaveLength(15)
    expect(new Set(options.map(option=>option.qualifier))).toEqual(new Set(['Aço','Água','Básico','Elétrico','Escuridão','Fogo','Gelo','Luz','Madeira','Terra','Vento','Data','Unknown','Vaccine','Virus']))
    expect(options.every(option=>progressionSubtypeLabelKey(option.qualifier)&&option.key.endsWith('|percent'))).toBe(true)
  })
  it('accepts a non-negative integer simulation budget only',()=>{
    expect(parseProgressionBudget('0')).toBe(0)
    expect(parseProgressionBudget('500')).toBe(500)
    for(const value of ['','-1','1.25','1e3'])expect(parseProgressionBudget(value)).toBeNull()
  })
})
