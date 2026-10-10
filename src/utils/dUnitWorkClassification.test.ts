import { describe, expect, it } from 'vitest'
import { dUnitSets, type DUnitCondition } from '../data/dUnitAudit'
import { progressionAuditForDUnitPortrait } from '../data/dUnitPortraitProgressionAudit'
import { knownMembersForDUnitSet } from './dUnitRouteWork'
import type { DUnitInventory, DUnitProgress } from './dUnit'
import { classifyDUnitConditionWork, classifyDUnitSetWork, classifyDUnitSharedWork, compareDUnitWorkMetrics } from './dUnitWorkClassification'

const tentomon = dUnitSets.find(set => set.id === 'dunit-34')!
const members = knownMembersForDUnitSet(tentomon.id)
const ids = members.members.map(member => member.digimonId!)
const condition = (requirement: string, position = 1): DUnitCondition => ({
  ...tentomon.conditions[position - 1], requirement,
})
const fullInventory = (): DUnitInventory => Object.fromEntries(ids.map(id => [id, {
  owned: true, level: 0, evolutionUnlocked: false, transcended: false,
}]))
const classify = (requirement: string, inventory: DUnitInventory = {}, progress: DUnitProgress = {}) =>
  classifyDUnitConditionWork(tentomon.id, condition(requirement), progress, inventory, 'snapshot')

describe('D-Unit recorded work classification', () => {
  it('counts explicit conditions without completing them from inventory', () => {
    const progress = { [tentomon.id]: { [tentomon.conditions[0].id]: true } }
    const result = classifyDUnitSetWork(tentomon, progress, fullInventory(), 'snapshot')
    expect(result.completedConditions.value).toBe(1)
    expect(result.pendingConditions.value).toBe(3)
    expect(result.economicCost).toMatchObject({ availability: 'costUnvalidated', value: null })
  })

  it('keeps missing inventory and partially recorded ownership indeterminate', () => {
    const absent = classify('Obtido 5 Digimons')
    expect(absent.metrics.registeredOwned).toMatchObject({ availability: 'notRecorded', value: null })
    expect(absent.metrics.remainingOwnership).toMatchObject({ availability: 'notRecorded', value: null })
    const partial = classify('Obtido 5 Digimons', { tentomon: { owned: true, level: 120 } })
    expect(partial.metrics.registeredOwned.value).toBe(1)
    expect(partial.metrics.remainingOwnership.value).toBeNull()
    expect(partial.metrics.remainingEvolutions.availability).toBe('notRecorded')
    expect(compareDUnitWorkMetrics(absent.metrics.remainingOwnership, partial.metrics.remainingOwnership).outcome).toBe('inconclusive')
  })

  it('reuses collective levels without assigning equal per-form targets', () => {
    const inventory = fullInventory()
    inventory.tentomon.level = 150
    inventory.kabuterimon.level = 70
    inventory.megakabuterimon.level = 40
    const result = classify('Nível Total dos Digimons 330', inventory)
    expect(result.metrics.registeredLevels.value).toBe(260)
    expect(result.metrics.remainingLevels.value).toBe(70)
    delete inventory.tyrantkabuterimon.level
    const partial = classify('Nível Total dos Digimons 330', inventory)
    expect(partial.metrics.registeredLevels.value).toBe(260)
    expect(partial.metrics.remainingLevels).toMatchObject({ availability: 'notRecorded', value: null })
  })

  it('keeps explicitly registered zero different from missing or invalid levels', () => {
    expect(classify('Nível Total dos Digimons 330', fullInventory()).metrics.registeredLevels.value).toBe(0)
    expect(classify('Nível Total dos Digimons 330').metrics.registeredLevels.value).toBeNull()
    const inventory = fullInventory()
    inventory.tentomon.level = NaN
    expect(classify('Nível Total dos Digimons 330', inventory).metrics.remainingLevels.value).toBeNull()
  })

  it('reports zero remaining only with sufficient evidence, not as condition completion', () => {
    const result = classify('Obtido 5 Digimons', fullInventory())
    expect(result.metrics.remainingOwnership).toMatchObject({ availability: 'known', value: 0 })
    expect(result.completed).toBe(false)
    const inventory = fullInventory()
    inventory.tentomon.level = 330
    expect(classify('Nível Total dos Digimons 330', inventory).metrics.remainingLevels.value).toBe(0)
  })

  it('retains confirmed manual lines and individual unlocks separately', () => {
    const inventory = fullInventory()
    const result = classify('Obtido 5 Digimons', inventory)
    expect(result.confirmedLineIds).toEqual(['tentomon-line'])
    expect(result.metrics.remainingEvolutions.value).toBe(4)
    expect(result.metrics.unlockRequirements.availability).toBe('unknown')
    inventory.kabuterimon.evolutionUnlocked = true
    expect(classify('Obtido 5 Digimons', inventory).metrics.remainingEvolutions.value).toBe(3)
    const lopmon = dUnitSets.find(set => set.id === 'dunit-96')!
    const branch = classifyDUnitConditionWork(lopmon.id, lopmon.conditions[0], {}, {}, 'snapshot')
    expect(branch.confirmedLineIds).toEqual(['lopmon-line'])
    expect(progressionAuditForDUnitPortrait(lopmon.id, 5)?.alternativeEvolution).toBe(true)
  })

  it('uses registered transcendence and does not infer missing fields', () => {
    const inventory = fullInventory()
    inventory.tentomon.transcended = true
    expect(classify('Obtido 5 Digimons Transcendidos', inventory).metrics.remainingTranscendence.value).toBe(4)
    expect(classify('Obtido 5 Digimons Transcendidos', inventory).metrics.registeredTranscendence.value).toBe(1)
    delete inventory.kabuterimon.transcended
    expect(classify('Obtido 5 Digimons Transcendidos', inventory).metrics.remainingTranscendence.availability).toBe('notRecorded')
  })

  it('does not promote unknown identity or missing manual relations to zero', () => {
    const ghost = dUnitSets.find(set => set.id === 'dunit-148')!
    const unknown = classifyDUnitConditionWork(ghost.id, ghost.conditions[0], {}, {}, 'snapshot')
    expect(unknown.metrics.remainingOwnership).toMatchObject({ availability: 'unknown', uncertainty: 'identityUnknown', value: null })
    const fixture = { ...condition('Obtido 5 Digimons'), id: 'fixture-condition-1' }
    const withoutRelations = classifyDUnitConditionWork('fixture', fixture, {}, fullInventory(), 'snapshot', members)
    expect(withoutRelations.metrics.remainingEvolutions).toMatchObject({ availability: 'unknown', uncertainty: 'relationUnconfirmed', value: null })
  })

  it('preserves completion independently without inferring inventory or unlocks', () => {
    const result = classify('Obtido 5 Digimons', {}, { [tentomon.id]: { [tentomon.conditions[0].id]: true } })
    expect(result.metrics.remainingOwnership.value).toBe(0)
    expect(result.metrics.registeredOwned.value).toBeNull()
    expect(result.metrics.remainingEvolutions.value).toBeNull()
  })

  it('does not trust the legacy count for subset requirements', () => {
    const result = classify('Obtido 3 Digimons', fullInventory())
    expect(result.metrics.remainingOwnership).toMatchObject({ availability: 'unknown', uncertainty: 'unsupportedRequirement', value: null })
  })

  it('recognizes sharing by audited form IDs across sets, never text alone', () => {
    const inventory = fullInventory()
    inventory.kabuterimon.owned = false
    const left = classify('Obtido 5 Digimons', inventory)
    const right = classifyDUnitConditionWork('fixture', { ...condition('Obtido 5 Digimons'), id: 'fixture-condition-1' }, {}, inventory, 'snapshot', members)
    expect(classifyDUnitSharedWork(left, right)).toMatchObject({ availability: 'known', value: 1 })
    const otherMembers = { complete: true, members: members.members.map((member, index) => ({ ...member, digimonId: `other-${index}` })) }
    const otherInventory = Object.fromEntries(otherMembers.members.map(member => [member.digimonId, { owned: false }]))
    const different = classifyDUnitConditionWork('other', { ...condition('Obtido 5 Digimons'), id: 'other-condition-1' }, {}, otherInventory, 'snapshot', otherMembers)
    expect(classifyDUnitSharedWork(left, different).value).toBe(0)
    expect(classifyDUnitSharedWork(left, classify('Obtido 5 Digimons')).value).toBeNull()
    expect(classifyDUnitSharedWork(left, { ...right, contextKey: 'other' }).value).toBeNull()
  })

  it('does not claim quantified collective level sharing or mix work dimensions', () => {
    const inventory = fullInventory()
    const level = classify('Nível Total dos Digimons 330', inventory)
    expect(classifyDUnitSharedWork(level, level)).toMatchObject({ availability: 'unknown', uncertainty: 'collectiveSharingUnknown', value: null })
    expect(compareDUnitWorkMetrics(level.metrics.remainingLevels, classify('Obtido 5 Digimons', inventory).metrics.remainingOwnership).outcome).toBe('inconclusive')
  })

  it('does not mutate inventory, progress or the audited composition', () => {
    const inventory = fullInventory(), progress: DUnitProgress = {}
    const before = JSON.stringify([inventory, progress, tentomon, members])
    classifyDUnitSetWork(tentomon, progress, inventory, 'snapshot')
    expect(JSON.stringify([inventory, progress, tentomon, members])).toBe(before)
  })
})
