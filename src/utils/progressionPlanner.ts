import type { Attribute } from '../types'
import { dUnitSets } from '../data/dUnitAudit'
import { bonusKey, type DUnitBonusKey } from './dUnit'
import { isPercent } from './calculations'

export const mainProgressionAttributes = ['AT','HT','CT','HP','DS','DE','BL','EV'] as const
export const otherProgressionAttributes = ['EXP','SCD','Dano habilidade','Dano de atributo básico'] as const
export type ProgressionObjective = typeof mainProgressionAttributes[number] | typeof otherProgressionAttributes[number]
export type ProgressionSystem = 'seals' | 'dunit'
export const progressionSystems = (objective: string): ProgressionSystem[] => mainProgressionAttributes.some(attribute=>attribute===objective) ? ['seals','dunit'] : otherProgressionAttributes.some(attribute=>attribute===objective) ? ['dunit'] : []
export const progressionUnit = (objective: ProgressionObjective, system: ProgressionSystem): 'absolute'|'percent' => system==='seals' ? (isPercent(objective as Attribute)?'percent':'absolute') : mainProgressionAttributes.some(attribute=>attribute===objective)?'absolute':'percent'

/** Keeps original bonus keys intact, including the separate skill categories. */
export const progressionDUnitOptions = (objective: ProgressionObjective) => [...new Map(dUnitSets.flatMap(set=>set.conditions).filter(condition=>condition.confirmed && condition.bonus.value!==null && (condition.bonus.attribute===objective || objective==='Dano habilidade'&&condition.bonus.attribute==='Ataque habilidade')).map(condition=>[bonusKey(condition),{key:bonusKey(condition),qualifier:condition.bonus.qualifier??'',unit:condition.bonus.unit}])).values()]
export const progressionSubtypeLabelKey = (qualifier:string) => ({Data:'ppData',Unknown:'ppUnknown',Vaccine:'ppVaccine',Virus:'ppVirus','Aço':'ppSteel','Água':'ppWater','Básico':'ppBasic','Elétrico':'ppElectric','Escuridão':'ppDark','Fogo':'ppFire','Gelo':'ppIce','Luz':'ppLight','Madeira':'ppWood','Terra':'ppEarth','Vento':'ppWind'} as Record<string,string>)[qualifier]
export const progressionObjectiveLabelKey = (objective:ProgressionObjective) => objective==='Dano habilidade'?'ppSkill':objective==='Dano de atributo básico'?'ppBasicDamage':undefined
export const progressionBonusKey = (objective:ProgressionObjective):DUnitBonusKey|undefined => objective==='Dano habilidade'?undefined:progressionDUnitOptions(objective)[0]?.key

export type ParsedProgressionTarget = {ok:true;value:number}|{ok:false;error:'ppPositive'|'ppInteger'|'ppDecimal'}
/** Parse decimal digits before conversion, so 0.01 Seal percent is exactly 1. */
export function parseProgressionTarget(draft:string,unit:'absolute'|'percent',system:ProgressionSystem):ParsedProgressionTarget {
  const text=draft.trim()
  if(unit==='absolute'){
    if(!/^\d+$/.test(text))return {ok:false,error:'ppInteger'}
    const value=Number(text)
    return Number.isSafeInteger(value)&&value>0?{ok:true,value}:{ok:false,error:'ppPositive'}
  }
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(text))return {ok:false,error:'ppDecimal'}
  const [whole,fraction='']=text.replace(',','.').split('.')
  const hundredths=Number(whole)*100+Number(fraction.padEnd(2,'0'))
  return Number.isSafeInteger(hundredths)&&hundredths>0?{ok:true,value:system==='seals'?hundredths:hundredths/100}:{ok:false,error:'ppPositive'}
}
export const parseProgressionBudget = (draft:string):number|null => /^\d+$/.test(draft.trim())&&Number.isSafeInteger(Number(draft))?Number(draft):null
export const plannerResultIsCurrent = (result:{source:unknown;draft:string}|null,source:unknown,draft:string) => Boolean(result&&result.source===source&&result.draft===draft)
export const progressionText = (template:string,values:Record<string,string|number>) => template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''))
