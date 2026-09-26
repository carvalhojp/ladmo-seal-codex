import { describe, expect, it } from 'vitest'
import { dUnitAuditSummary, dUnitSets } from './dUnitAudit'

describe('D-Unit audit structure', () => {
  it('keeps the validated 278 sets and 1,112 structural conditions', () => {
    expect(dUnitAuditSummary()).toMatchObject({ sets: 278, conditions: 1112 })
    expect(new Set(dUnitSets.map(set => set.id)).size).toBe(278)
    expect(new Set(dUnitSets.flatMap(set => set.conditions.map(condition => condition.id))).size).toBe(1112)
  })

  it('keeps four uniquely positioned conditions in every set', () => {
    for (const set of dUnitSets) expect(set.conditions.map(condition => condition.position)).toEqual([1, 2, 3, 4])
  })

  it('does not promote complements into separate sets and preserves their source files', () => {
    expect(dUnitSets.find(set => set.id === 'dunit-1')?.sourceFiles).toEqual(['1.png', '1.1.png'])
    expect(dUnitSets.some(set => set.id === 'dunit-1.1')).toBe(false)
    expect(dUnitSets.find(set => set.id === 'dunit-262')?.sourceFiles).toEqual(['262.png', '262.1.png', '262.2.png'])
  })

  it('keeps the two real filename collisions as distinct stable identities', () => {
    expect(dUnitSets.find(set => set.id === 'dunit-275')?.name).toBe('Aquele que Desceu com o Brilho')
    expect(dUnitSets.find(set => set.id === 'dunit-275-source-backtick')?.name).toBe('Dungeon Masters')
    expect(dUnitSets.find(set => set.id === 'dunit-276')?.name).toBe('O Último Reino, Sol Brilhante')
    expect(dUnitSets.find(set => set.id === 'dunit-276-source-backtick')?.name).toBe('Net Ocean')
  })

  it('preserves confirmed percentage, absolute and qualifier data without using zero for unknown values', () => {
    const corrida = dUnitSets.find(set => set.id === 'dunit-1')!
    expect(corrida.conditions[0].bonus).toMatchObject({ value: 30, unit: 'absolute' })
    expect(corrida.conditions[3].bonus).toMatchObject({ value: 1, unit: 'percent', qualifier: 'Escuridão' })
    expect(dUnitSets.flatMap(set => set.conditions).filter(condition => !condition.confirmed).every(condition => condition.bonus.value === null)).toBe(true)
  })

  it('keeps the recovered Lot 7 as 50 fully confirmed sets without changing its special records', () => {
    const lot7Ids = Array.from({ length: 52 }, (_, index) => `dunit-${index + 178}`)
      .filter(id => id !== 'dunit-185' && id !== 'dunit-213')
    const lot7Sets = dUnitSets.filter(set => lot7Ids.includes(set.id))
    const lot7Conditions = lot7Sets.flatMap(set => set.conditions)

    expect(lot7Sets).toHaveLength(50)
    expect(lot7Conditions).toHaveLength(200)
    expect(lot7Conditions.every(condition => condition.confirmed && condition.bonus.value !== null && !Number.isNaN(condition.bonus.value))).toBe(true)
    expect(dUnitAuditSummary()).toMatchObject({ sets: 278, conditions: 1112, confirmed: 1112, pending: 0 })
    expect(dUnitSets.find(set => set.id === 'dunit-204')?.conditions.map(condition => condition.requirement)).toEqual([
      'Obtido 4 Digimons',
      'Nível Total dos Digimons 440',
      'Nível Total dos Digimons 500',
      'Nível Total dos Digimons 560',
    ])
    expect(dUnitSets.find(set => set.id === 'dunit-185-source-backtick')?.name).toBe('Kotemon[Gladimon]')
    expect(dUnitSets.find(set => set.id === 'dunit-213-source-backtick')?.name).toBe('Transcendendo o Tempo, lenda começa!')
    expect(dUnitSets.find(set => set.id === 'dunit-195')?.sourceFiles).toEqual(['195.png', '195.1.png'])
    expect(dUnitSets.find(set => set.id === 'dunit-209')?.sourceFiles).toEqual(['209.png', '209.1.png'])
    expect(dUnitSets.find(set => set.id === 'dunit-210')?.sourceFiles).toEqual(['210.png', '210.1.png'])
    expect(dUnitSets.find(set => set.id === 'dunit-211')?.sourceFiles).toEqual(['211.png', '211.1.png'])
    expect(dUnitSets.find(set => set.id === 'dunit-222')?.sourceFiles).toEqual(['222.png', '222.1.png'])
    expect(dUnitSets.find(set => set.id === 'dunit-225')?.sourceFiles).toEqual(['225.png', '225.1.png'])
    expect(dUnitSets.find(set => set.id === 'dunit-228')?.sourceFiles).toEqual(['228.png', '228.1.png'])
  })

  it('closes the D-Unit audit with every condition and bonus visually confirmed', () => {
    const conditions = dUnitSets.flatMap(set => set.conditions)

    expect(dUnitAuditSummary()).toEqual({ sets: 278, conditions: 1112, confirmed: 1112, pending: 0 })
    expect(conditions.every(condition => condition.confirmed && condition.bonus.confirmed)).toBe(true)
    expect(conditions.every(condition => condition.bonus.value !== null && !Number.isNaN(condition.bonus.value))).toBe(true)
    expect(dUnitSets.find(set => set.id === 'dunit-275')?.name).toBe('Aquele que Desceu com o Brilho')
    expect(dUnitSets.find(set => set.id === 'dunit-275-source-backtick')?.name).toBe('Dungeon Masters')
    expect(dUnitSets.find(set => set.id === 'dunit-276')?.name).toBe('O Último Reino, Sol Brilhante')
    expect(dUnitSets.find(set => set.id === 'dunit-276-source-backtick')?.name).toBe('Net Ocean')
  })
})
