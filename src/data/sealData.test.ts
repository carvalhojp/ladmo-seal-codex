import { describe, expect, it } from 'vitest'
import { seals } from './seals'
import { configuredAcquisitionNames, matchesAcquisitionFilter, sourcesForName } from './acquisitionSources'
import { migrateDuplicateDorugamon } from '../utils/sealState'

describe('corrected Seal data', () => {
  it('keeps exactly one canonical Dorugamon HT +200', () => expect(seals.filter(s => s.name === 'Dorugamon' && s.attribute === 'HT' && s.masterValue === 200)).toHaveLength(1))
  it('keeps Lanamon DS and Renamon DE without the incorrect Renamon DS record', () => {
    expect(seals.some(s => s.name === 'Lanamon' && s.attribute === 'DS' && s.masterValue === 200)).toBe(true)
    expect(seals.some(s => s.name === 'Renamon' && s.attribute === 'DE' && s.masterValue === 100)).toBe(true)
    expect(seals.some(s => s.name === 'Renamon' && s.attribute === 'DS' && s.masterValue === 200)).toBe(false)
  })
  it('migrates duplicate Dorugamon state without losing flags or the larger quantity', () => {
    expect(migrateDuplicateDorugamon({'seal-19435':{quantity:50,hasSeal:false,doNotRecommend:true},'seal-22829':{quantity:100,hasSeal:true,doNotRecommend:false}})).toEqual({'seal-19435':{quantity:100,hasSeal:true,doNotRecommend:true}})
  })
  it('configures the requested multi-source farms', () => {
    expect(sourcesForName('Renamon')).toContainEqual({type:'shinjuku',coinsPerSeal:20})
    expect(sourcesForName('Leomon')).toContainEqual({type:'map',difficult:true})
    expect(sourcesForName('Vajramon')).toContainEqual({type:'dungeon',dungeon:'Estádio'})
    expect(sourcesForName('Zhuqiaomon')).toContainEqual({type:'shinjuku',coinsPerSeal:200})
    expect(sourcesForName('Parasimon')).toContainEqual({type:'monsterCard',card:'MC7'})
    expect(sourcesForName('Etemon')).toContainEqual({type:'monsterCard',card:'MC6'})
  })
  it('keeps the complete requested Dungeon details', () => {
    const expected = {Dynasmon:'Royal Base',Beelzebumon:'Chaotic Battle',LordKnightmon:'Royal Base',Vajramon:'Estádio',Craniamon:'Royal Base',Sleipmon:'Royal Base',Baihumon:'BDG',DexDorugoramon:'Royal Base',Zhuqiaomon:'ZDG',Megidramon:'Chaotic Battle',Dexmon:'Royal Base','Ulforce V-dramon':'Royal Base'}
    Object.entries(expected).forEach(([name,dungeon]) => expect(sourcesForName(name)).toContainEqual({type:'dungeon',dungeon}))
    expect(sourcesForName('Lucemon')).toContainEqual({type:'dungeon',dungeon:'Royal Base',reward:true})
  })
  it('adds Examon to Dungeon — Royal Base without changing its Seal record', () => {
    const examon = seals.find(seal => seal.name === 'Examon')
    expect(examon).toMatchObject({ id:'seal-17773', attribute:'AT', masterValue:300, ticketCost:100, sealsReceived:1, maxSeals:3000 })
    expect(sourcesForName('Examon')).toContainEqual({ type:'dungeon', dungeon:'Royal Base' })
    expect(matchesAcquisitionFilter('Examon', 'dungeon')).toBe(true)
  })
  it('keeps every requested Shinjuku coin cost', () => {
    const expected = {Renamon:20,Goblimon:20,Guilmon:20,Impmon:20,Gazimon:20,Mushroomon:20,Elecmon:20,Floramon:20,Growmon:40,Leomon:40,Monochromon:40,Woodmon:40,Rockmon:40,Chrysalimon:40,Meramon:40,Sinduramon:50,MetalTyranomon:50,Vajramon:150,Vikaralamon:150,Zhuqiaomon:200,Beelzebumon:200,Megidramon:200}
    Object.entries(expected).forEach(([name,coinsPerSeal]) => expect(sourcesForName(name)).toContainEqual({type:'shinjuku',coinsPerSeal}))
  })
  it('preserves every source for the required multi-source Seals', () => {
    for (const name of ['Vajramon','Zhuqiaomon','Beelzebumon','Megidramon']) {
      expect(sourcesForName(name).some(source => source.type === 'dungeon')).toBe(true)
      expect(sourcesForName(name).some(source => source.type === 'shinjuku')).toBe(true)
    }
    expect(sourcesForName('Renamon')).toEqual(expect.arrayContaining([{type:'map',difficult:false},{type:'shinjuku',coinsPerSeal:20}]))
    expect(sourcesForName('Leomon')).toEqual(expect.arrayContaining([{type:'map',difficult:true},{type:'shinjuku',coinsPerSeal:40}]))
  })
  it('only configures acquisition names that exist in the supplied data', () => expect(configuredAcquisitionNames.filter(name => !seals.some(seal => seal.name === name))).toEqual([]))
  it('filters every acquisition type and keeps multi-source seals in each matching source', () => {
    expect(matchesAcquisitionFilter('Renamon', 'map')).toBe(true)
    expect(matchesAcquisitionFilter('Renamon', 'shinjuku')).toBe(true)
    expect(matchesAcquisitionFilter('Vajramon', 'dungeon')).toBe(true)
    expect(matchesAcquisitionFilter('Vajramon', 'shinjuku')).toBe(true)
    expect(matchesAcquisitionFilter('Parasimon', 'monsterCard')).toBe(true)
    expect(matchesAcquisitionFilter('Etemon', 'monsterCard')).toBe(true)
    expect(matchesAcquisitionFilter('Dynasmon', 'dungeon')).toBe(true)
    expect(matchesAcquisitionFilter('Renamon', 'all')).toBe(true)
  })
})
