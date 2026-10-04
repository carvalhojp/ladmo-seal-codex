import { describe, expect, it } from 'vitest'
import { dUnitSets } from '../data/dUnitAudit'
import { dUnitAttackSkillAttribute, dUnitCodexAttributes, dUnitSkillDamageAttribute, dUnitSkillDamageSubtypes, filterDUnitCodexSets, matchesDUnitAttribute } from './dUnitFilters'

const allSkillDamageSets = dUnitSets.filter(set => set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute))
const allAttackSkillSets = dUnitSets.filter(set => set.conditions.some(condition => condition.bonus.attribute === dUnitAttackSkillAttribute))
const allGroupedSkillDamageSets = dUnitSets.filter(set => set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute || condition.bonus.attribute === dUnitAttackSkillAttribute))

describe('D-Unit skill damage filters', () => {
  it('discovers the canonical, unique subtypes from the D-Unit bonus qualifiers', () => {
    const subtypes = dUnitSkillDamageSubtypes(dUnitSets)
    expect(subtypes).toEqual(expect.arrayContaining(['Aço', 'Água', 'Básico', 'Data', 'Elétrico', 'Escuridão', 'Fogo', 'Gelo', 'Luz', 'Madeira', 'Terra', 'Unknown', 'Vaccine', 'Vento', 'Virus']))
    expect(subtypes).toHaveLength(15)
    expect(new Set(subtypes.map(value => value.toLocaleLowerCase())).size).toBe(subtypes.length)
  })

  it('uses Dano habilidade as a visual grouping for both skill damage attributes', () => {
    expect(filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute)).toEqual(allGroupedSkillDamageSets)
    expect(filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, '')).toEqual(allGroupedSkillDamageSets)
    expect(new Set(allGroupedSkillDamageSets.map(set => set.id)).size).toBe(allGroupedSkillDamageSets.length)
    expect(allSkillDamageSets.length).toBe(207)
    expect(allAttackSkillSets.length).toBe(118)
    expect(allGroupedSkillDamageSets.length).toBe(269)
  })

  it.each(['Fogo', 'Escuridão'])('filters only sets with Dano habilidade %s', subtype => {
    const sets = filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, subtype)
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every(set => set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute && condition.bonus.qualifier === subtype))).toBe(true)
  })

  it.each(['Virus', 'Vaccine', 'Data', 'Unknown'])('filters %s through the Ataque habilidade source category', subtype => {
    const sets = filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, subtype)
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every(set => set.conditions.some(condition => condition.bonus.attribute === dUnitAttackSkillAttribute && condition.bonus.qualifier === subtype))).toBe(true)
  })

  it('keeps Ataque habilidade out of the primary D-Unit Codex options', () => {
    expect(dUnitCodexAttributes(dUnitSets)).not.toContain(dUnitAttackSkillAttribute)
    expect(dUnitCodexAttributes(dUnitSets)).toContain(dUnitSkillDamageAttribute)
  })

  it('does not keep a hidden skill damage subtype active after choosing another attribute', () => {
    expect(dUnitSets.filter(set => matchesDUnitAttribute(set, 'HT', 'Fogo'))).toEqual(dUnitSets.filter(set => matchesDUnitAttribute(set, 'HT')))
  })

  it('combines the text query with a skill damage subtype', () => {
    const sets = filterDUnitCodexSets(dUnitSets, 'Agumon', dUnitSkillDamageAttribute, 'Fogo')
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every(set => set.name.includes('Agumon') && set.conditions.some(condition => condition.bonus.attribute === dUnitSkillDamageAttribute && condition.bonus.qualifier === 'Fogo'))).toBe(true)
  })

  it('combines the text query with an Ataque habilidade subtype in the visual group', () => {
    const sets = filterDUnitCodexSets(dUnitSets, 'Gabumon', dUnitSkillDamageAttribute, 'Virus')
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every(set => set.name.includes('Gabumon') && set.conditions.some(condition => condition.bonus.attribute === dUnitAttackSkillAttribute && condition.bonus.qualifier === 'Virus'))).toBe(true)
  })

  it('uses canonical values that are independent from the selected interface language', () => {
    const expected = filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, 'Fogo')
    for (const _language of ['pt', 'en', 'es', 'ko']) expect(filterDUnitCodexSets(dUnitSets, '', dUnitSkillDamageAttribute, 'Fogo')).toEqual(expected)
  })
})
