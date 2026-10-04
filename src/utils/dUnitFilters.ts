import type { DUnitSet } from '../data/dUnitAudit'

export const dUnitSkillDamageAttribute = 'Dano habilidade'
export const dUnitAttackSkillAttribute = 'Ataque habilidade'
const dUnitSkillDamageGroupedAttributes = new Set([dUnitSkillDamageAttribute, dUnitAttackSkillAttribute])

export function normalizeDUnitSkillDamageSubtype(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function subtypeKey(value: string | undefined): string {
  return normalizeDUnitSkillDamageSubtype(value).toLocaleLowerCase()
}

export function dUnitSkillDamageSubtypes(sets: readonly DUnitSet[]): string[] {
  const subtypes = new Map<string, string>()
  for (const set of sets) for (const condition of set.conditions) {
    if (!dUnitSkillDamageGroupedAttributes.has(condition.bonus.attribute ?? '')) continue
    const subtype = normalizeDUnitSkillDamageSubtype(condition.bonus.qualifier)
    if (subtype) subtypes.set(subtypeKey(subtype), subtype)
  }
  return [...subtypes.values()].sort((left, right) => left.localeCompare(right))
}

export function dUnitCodexAttributes(sets: readonly DUnitSet[]): string[] {
  const attributes = sets.flatMap(set => set.conditions.map(condition => condition.bonus.attribute)).filter((attribute): attribute is string => Boolean(attribute))
  return [...new Set(attributes)].filter(attribute => attribute !== dUnitAttackSkillAttribute).sort()
}

export function matchesDUnitAttribute(set: DUnitSet, attribute: string, skillDamageSubtype = ''): boolean {
  if (!attribute) return true
  const selectedSubtype = subtypeKey(skillDamageSubtype)
  const isSkillDamageGroup = attribute === dUnitSkillDamageAttribute
  return set.conditions.some(condition => {
    const matchesAttribute = isSkillDamageGroup
      ? dUnitSkillDamageGroupedAttributes.has(condition.bonus.attribute ?? '')
      : condition.bonus.attribute === attribute
    return matchesAttribute && (!isSkillDamageGroup || !selectedSubtype || subtypeKey(condition.bonus.qualifier) === selectedSubtype)
  })
}

export function filterDUnitCodexSets(sets: readonly DUnitSet[], query: string, attribute: string, skillDamageSubtype = ''): DUnitSet[] {
  const normalizedQuery = query.toLocaleLowerCase()
  return sets.filter(set => {
    const text = [set.name, ...set.conditions.flatMap(condition => [condition.requirement, condition.bonus.rawLabel, condition.bonus.attribute, condition.bonus.qualifier])].join(' ').toLocaleLowerCase()
    return (!normalizedQuery || text.includes(normalizedQuery)) && matchesDUnitAttribute(set, attribute, skillDamageSubtype)
  })
}
