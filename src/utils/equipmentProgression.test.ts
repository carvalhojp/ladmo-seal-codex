import { describe, expect, it } from 'vitest'
import { equipmentDungeons } from '../data/equipment'
import { calculateLoaderProgression, calculateProgression, formatTera, parseTera } from './equipmentProgression'

const byId = (id: string) => equipmentDungeons.find(dungeon => dungeon.id === id)!
const recipe = (id: string, index = 0) => byId(id).recipes![index]

describe('equipment progression calculations', () => {
  it('calculates normal recipes, owned materials, and non-negative deficits', () => {
    const result = calculateProgression({ recipes:[recipe('chimairamon')], ownedMaterials:{ 'Aura Maligna de Chimairamon': 40 }, ownedMoney: parseTera('100T') })
    expect(result.materials).toEqual([{ name:'Aura Maligna de Chimairamon', required:125, owned:40, missing:85 }])
    expect(result.money).toEqual({ required:parseTera('250T'), owned:parseTera('100T'), missing:parseTera('150T') })
    const complete = calculateProgression({ recipes:[recipe('chimairamon')], ownedMaterials:{ 'Aura Maligna de Chimairamon': 200 }, ownedMoney: parseTera('300T') })
    expect(complete.materials[0].missing).toBe(0)
    expect(complete.money.missing).toBe(0)
    expect(complete.weeks.weeks).toBe(0)
  })

  it('uses quest plus weekly rewards in the first week for Dark Web, Nightmare, and Eosmon', () => {
    ;(['dark-web', 'nightmare', 'eosmon'] as const).forEach(id => {
      const dungeon = byId(id)
      const result = calculateProgression({ recipes:[recipe(id)], weekly:dungeon.weekly, prerequisite:dungeon.prerequisite, questCompleted:false })
      const material = result.materials[0]
      expect(result.includesQuest).toBe(true)
      expect(result.weeks.firstWeek[material.name]).toBe((dungeon.weekly!.materials![0].amount as unknown as number) * 0 + Number(dungeon.weekly!.materials![0].amount) + Number(dungeon.prerequisite!.materials![0].amount))
      expect(result.money.required).toBe(parseTera(recipe(id).money) + parseTera(dungeon.prerequisite!.money))
    })
    const darkWeb = byId('dark-web')
    const completedQuest = calculateProgression({ recipes:[recipe('dark-web')], weekly:darkWeb.weekly, prerequisite:darkWeb.prerequisite, questCompleted:true })
    expect(completedQuest.weeks.firstWeek['Dados de Kuramon']).toBe(15)
    expect(completedQuest.money.required).toBe(parseTera('200T'))
  })

  it('uses owned materials before estimating weeks and leaves Tera outside the time estimate', () => {
    const darkWeb = byId('dark-web')
    const result = calculateProgression({ recipes:[recipe('dark-web')], ownedMaterials:{ 'Dados de Kuramon':100 }, ownedMoney:0, weekly:darkWeb.weekly, prerequisite:darkWeb.prerequisite, questCompleted:false })
    expect(result.materials[0].missing).toBe(25)
    expect(result.weeks.weeks).toBe(1)
    expect(result.money.missing).toBe(parseTera('205T'))
  })

  it('multiplies MDG per-part costs and estimates from its real weekly reward', () => {
    const mdg = byId('mdg')
    ;([1,3,6] as const).forEach(quantity => {
      const result = calculateProgression({ recipes:[mdg.perPartCraft!.recipe], multiplier:quantity, weekly:mdg.weekly })
      expect(result.materials[0].required).toBe(25 * quantity)
      expect(result.money.required).toBe(parseTera('10T') * quantity)
    })
    expect(calculateProgression({ recipes:[mdg.perPartCraft!.recipe], multiplier:3, weekly:mdg.weekly }).weeks.weeks).toBe(2)
  })

  it('sums the real Loader steps and rejects an invalid direction', () => {
    const sdg = byId('sdg')
    expect(calculateLoaderProgression(sdg.progression!, 5, 10)).toHaveLength(5)
    expect(calculateLoaderProgression(sdg.progression!, 6, 8)).toHaveLength(2)
    expect(calculateLoaderProgression(sdg.progression!, 10, 'complete')).toHaveLength(1)
    expect(calculateLoaderProgression(sdg.progression!, 5, 5)).toBeNull()
    const steps = calculateLoaderProgression(sdg.progression!, 5, 10)!
    const result = calculateProgression({ recipes:steps, ownedMaterials:{ 'Peças de DigiCode':100 }, weekly:sdg.weekly })
    expect(result.materials[0].required).toBe(412)
    expect(result.materials[0].missing).toBe(312)
    expect(result.weeks.weeks).toBe(8)
  })

  it('uses exact integer T/M/B currency formatting', () => {
    expect(formatTera(parseTera('0'))).toBe('0')
    expect(formatTera(parseTera('80'))).toBe('80T')
    expect(formatTera(parseTera('90'))).toBe('90T')
    expect(formatTera(parseTera('100'))).toBe('100T')
    expect(parseTera('16T 500M')).toBe(16_500_000)
    expect(formatTera(parseTera('28T 749M 600B'))).toBe('28T 749M 600B')
  })

  it('treats a bare Tera input as T while preserving the actual craft cost', () => {
    const result = calculateProgression({ recipes:[recipe('dark-web', 2)], ownedMoney:parseTera('80') })
    expect(formatTera(result.money.required)).toBe('90T')
    expect(formatTera(result.money.owned)).toBe('80T')
    expect(formatTera(result.money.missing)).toBe('10T')
  })

  it('does not invent a weekly rate for secondary Arena materials or RNG progressions', () => {
    const arena = byId('arena-hard')
    const result = calculateProgression({ recipes:[recipe('arena-hard')], weekly:arena.weekly })
    expect(result.weeks.weeks).toBeNull()
    expect(result.weeks.unknownMaterials).toEqual(['Emblemas do Escalador [Evento]'])
    expect(byId('eosmon').notes).toHaveLength(1)
  })
})
