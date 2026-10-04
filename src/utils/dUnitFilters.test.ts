import { describe, expect, it } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { dUnitSkillDamageAttribute, dUnitSkillDamageSubtypes, filterDUnitCodexSets, matchesDUnitAttribute } from './dUnitFilters'

const allSkillDamageSets = dUnitSets.filter(set => set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute))

describe('D-Unit skill damage filters', () => {
  it('discovers the canonical, unique subtypes from the D-Unit bonus qualifiers', () => {
    const subtypes = dUnitSkillDamageSubtypes(dUnitSets)
    expect(subtypes).toEqual(['Aço', 'Água', 'Básico', 'Elétrico', 'Escuridão', 'Fogo', 'Gelo', 'Luz', 'Madeira', 'Terra', 'Vento'])
    expect(new Set(subtypes.map(value => value.toLocaleLowerCase())).size).toBe(subtypes.length)
  })

  it('keeps the current broad behavior when all skill damage types are selected', () => {
    expect(filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute)).toEqual(allSkillDamageSets)
    expect(filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, '')).toEqual(allSkillDamageSets)
  })

  it.each(['Fogo', 'Escuridão'])('filters only sets with Dano habilidade %s', subtype => {
    const sets = filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, subtype)
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every(set => set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute && condition.bonus.qualifier === subtype))).toBe(true)
  })

  it('does not keep a hidden skill damage subtype active after choosing another attribute', () => {
    expect(dUnitSets.filter(set => matchesDUnitAttribute(set, 'HT', 'Fogo'))).toEqual(dUnitSets.filter(set => matchesDUnitAttribute(set, 'HT')))
  })

  it('combines the text query with a skill damage subtype', () => {
    const sets = filterDUnitCodexSets(dUnitSets, 'Agumon', dUnitSkillDamageAttribute, 'Fogo')
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every(set => set.name.includes('Agumon') && set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute && condition.bonus.qualifier === 'Fogo'))).toBe(true)
  })

  it('uses canonical values that are independent from the selected interface language', () => {
    const expected = filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, 'Fogo')
    for (const _language of ['pt', 'en', 'es', 'ko']) expect(filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, 'Fogo')).toEqual(expected)
  })
})
