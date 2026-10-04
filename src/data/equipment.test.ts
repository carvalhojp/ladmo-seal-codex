import { describe, expect, it } from 'vitest'
import { equipmentDungeons, equipmentPerfectModels } from './equipment'

const byId = (id: string) => equipmentDungeons.find(item => item.id === id)!

describe('equipment V1 data', () => {
  it('registers the eight supplied dungeons and only seven boss images', () => {
    expect(equipmentDungeons).toHaveLength(8)
    expect(equipmentDungeons.filter(item => item.bossImage)).toHaveLength(7)
    expect(byId('arena-hard').bossImage).toBeUndefined()
  })
  it('keeps the supplied material rules distinct', () => {
    expect(byId('dark-web').prerequisite).toEqual({ materials:[{ name:'Dados de Kuramon', amount:'15' }], money:'5T' })
    expect(byId('dark-web').weekly).toEqual({ materials:[{ name:'Dados de Kuramon', amount:'15' }], money:'5T' })
    expect(byId('sdg').weekly?.materials?.[0]).toEqual({ name:'Peças de DigiCode', amount:'42' })
    expect(byId('mdg').perPartCraft?.recipe.note).toContain('cada parte')
    expect(byId('chimairamon').exchange?.text).toContain('1 Anel Negro pode ser trocado por 2 Aura')
    expect(byId('eosmon').reroll?.note).toContain('não é a fabricação inicial')
    expect(byId('arena-hard').prerequisite?.text).toContain('2 Emblemas')
  })
})

describe('equipment perfect models', () => {
  it('registers the five original entries plus four shared equipment groups', () => {
    expect(equipmentPerfectModels).toHaveLength(9)
    expect(equipmentPerfectModels.map(item => item.perfectModels.length)).toEqual([4,4,5,4,4,2,2,2,2])
    expect(equipmentPerfectModels.flatMap(item => item.perfectModels)).toHaveLength(29)
  })

  it('keeps each supplied roll position and does not normalize abbreviations', () => {
    const models = equipmentPerfectModels.flatMap(item => item.perfectModels)
    expect(models.every(model => model.length === 5)).toBe(true)
    expect(equipmentPerfectModels.find(item => item.id === 'luxury-kindness-earring')?.perfectModels[0]).toEqual(['AS','DC','ATT','ATT','AT%'])
    expect(equipmentPerfectModels.find(item => item.id === 'vital-bracelet-digivice')?.perfectModels[2]).toEqual(['SKILL%','DF','HT','HT','DC'])
    expect(models.flat().includes('HIT')).toBe(false)
  })

  it('keeps the supplied models in place when correcting equipment identities', () => {
    const first = equipmentPerfectModels[0]
    const second = equipmentPerfectModels[1]

    expect(first.name).toBe('Brinco Luxuoso da Bondade')
    expect(first.relatedDungeon).toBe('Chimairamon Dungeon')
    expect(first.perfectModels).toEqual([
      ['HP%','SKILL%','ATT','ATT','HT'],
      ['HP%','SKILL%','ATT','ATT','CT'],
      ['HP%','SKILL%','ATT','ATT','DC'],
      ['SKILL%','ATT','ATT','DC','DC'],
    ])
    expect(second.name).toBe('Colar Radiante do Milagre')
    expect(second.relatedDungeon).toBe('Dark Web')
    expect(second.perfectModels).toEqual([
      ['AS','DC','ATT','ATT','AT%'],
      ['AS','DC','ATT','ATT','CT'],
      ['AS','DC','ATT','ATT','HP%'],
      ['AS','ATT','ATT','CT','HP%'],
    ])
  })

  it('keeps each shared equipment group with its supplied models and no inferred dungeon', () => {
    const sharedGroups = [
      ['miraculous-digital-earring', [['ATT','ATT','DC','DC','HT'], ['ATT','ATT','DC','DC','CT']]],
      ['miraculous-digital-necklace', [['ATT','ATT','DC','AS','CT'], ['ATT','ATT','DC','AS','AT']]],
      ['miraculous-digital-ring', [['ATT','ATT','CT','CT','AT'], ['ATT','ATT','AT','AT','CT']]],
      ['miraculous-x-knight-bracelet', [['DC','DC','HT','HT','CT'], ['DC','DC','HT','HT','AT']]],
    ] as const

    sharedGroups.forEach(([id, perfectModels]) => {
      const group = equipmentPerfectModels.find(item => item.id === id)
      expect(group?.relatedDungeon).toBeUndefined()
      expect(group?.perfectModels).toEqual(perfectModels)
      expect(group?.perfectModels.every(model => model.length === 5)).toBe(true)
    })
  })
})
