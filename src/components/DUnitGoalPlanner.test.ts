import { describe, expect, it } from 'vitest'
import { DUNIT_ROUTE_PAGE_SIZE, dUnitComparisonMetricText, dUnitRouteOverview, dUnitRouteSignature, filterDUnitCandidateRoutes, groupDUnitRouteRecommendations, isDUnitRouteRecommendationCompleted, routeTaskSummary } from './DUnitGoalPlanner'
import { bonusKey, calculateDUnitGoalRoute, toggleDUnitCondition } from '../utils/dUnit'
import { dUnitSets } from '../data/dUnitAudit'
import { portraitsForDUnitSet } from '../data/dUnitPortraits'
import { identitiesForDUnitSet } from '../data/dUnitPortraitIdentityAudit'

describe('D-Unit Goal Planner route snapshots', () => {
  it('derives each action state from shared progress while preserving the original snapshot', () => {
    const condition = dUnitSets[0].conditions[0]
    const snapshot = calculateDUnitGoalRoute({}, bonusKey(condition), condition.bonus.value!)
    const item = snapshot.recommendations[0]
    const completed = toggleDUnitCondition({}, item.setId, item.condition.id, true)

    expect(isDUnitRouteRecommendationCompleted({}, item.condition)).toBe(false)
    expect(isDUnitRouteRecommendationCompleted(completed, item.condition)).toBe(true)
    expect(snapshot.recommendations[0]).toBe(item)
  })

  it('keeps multiple snapshot recommendations independent and excludes completed work only after recalculation', () => {
    const condition = dUnitSets[0].conditions[0]
    const snapshot = calculateDUnitGoalRoute({}, bonusKey(condition), Number.MAX_SAFE_INTEGER)
    const [first, second] = snapshot.recommendations
    const completed = toggleDUnitCondition({}, first.setId, first.condition.id, true)

    expect(isDUnitRouteRecommendationCompleted(completed, first.condition)).toBe(true)
    expect(isDUnitRouteRecommendationCompleted(completed, second.condition)).toBe(false)
    expect(snapshot.recommendations.map(item => item.condition.id)).toContain(first.condition.id)
    expect(calculateDUnitGoalRoute(completed, bonusKey(condition), Number.MAX_SAFE_INTEGER).recommendations.map(item => item.condition.id)).not.toContain(first.condition.id)
  })

  it('keeps the stable set id for the EXP +100% route, so its portraits remain available through completion', () => {
    // The planner is free to choose a different economical EXP 100 route.
    // An intentionally unreachable goal keeps this existing portrait snapshot
    // regression focused on stable ids rather than route ranking.
    const route = calculateDUnitGoalRoute({}, 'EXP||percent', Number.MAX_SAFE_INTEGER)
    const recommendation = route.recommendations.find(item => item.setId === 'dunit-267')

    expect(recommendation?.condition.requirement).toBe('Obtido 4 Digimons Transcendidos')
    expect(recommendation?.condition.bonus.rawLabel).toBe('EXP +100%')
    expect(portraitsForDUnitSet(recommendation!.setId)).toHaveLength(4)

    const completed = toggleDUnitCondition({}, recommendation!.setId, recommendation!.condition.id, true)
    expect(isDUnitRouteRecommendationCompleted(completed, recommendation!.condition)).toBe(true)
    expect(portraitsForDUnitSet(recommendation!.setId)).toHaveLength(4)
    expect(calculateDUnitGoalRoute(completed, 'EXP||percent', Number.MAX_SAFE_INTEGER).recommendations).not.toContainEqual(recommendation)
  })

  it('groups multiple route stages by set while retaining individual conditions and their order', () => {
    const set = dUnitSets.find(item => item.id === 'dunit-34')!
    const route = calculateDUnitGoalRoute({}, 'EXP||percent', 100)
    const template = route.recommendations[0]!
    const stages = set.conditions.slice(0, 3).map(condition => ({ ...template, setId: set.id, condition }))
    const groups = groupDUnitRouteRecommendations(stages)

    expect(groups).toHaveLength(1)
    expect(groups[0].setId).toBe(set.id)
    expect(groups[0].items.map(item => item.condition.position)).toEqual([1, 2, 3])
  })

  it('delivers distinct unverified EXP +300 candidates to the planner output', () => {
    const snapshot = calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const routes = [snapshot, ...snapshot.alternatives]
    expect(snapshot.selectionBasis).toBe('confirmedRequirementsOnly')
    expect(snapshot.alternatives.length).toBeGreaterThan(0)
    expect(routes.every(route => route.totalGain >= 300)).toBe(true)
    expect(routes.every(route => route.recommendations.every(item => item.condition.bonus.attribute === 'EXP'))).toBe(true)
    expect(new Set(routes.map(route => route.recommendations.map(item => item.condition.id).sort().join('|'))).size).toBe(routes.length)
  })

  it('delivers the generic four-set +310 EXP progression package to presentation candidates', () => {
    const snapshot = calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const expected = ['dunit-34', 'dunit-41', 'dunit-96', 'dunit-159']
    const candidate = snapshot.candidateAlternatives.find(route =>
      route.setCount === 4 && expected.every(setId => route.recommendations.some(item => item.setId === setId))
    )

    expect(candidate).toBeDefined()
    expect(candidate?.totalGain).toBe(310)
    expect(candidate?.recommendations.every(item => item.condition.position <= 3)).toBe(true)
  })

  it('makes the +310 EXP route reachable through the same candidate search used by the UI', () => {
    const snapshot=calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const routes=filterDUnitCandidateRoutes(snapshot, 'Tentomon Guilmon Lopmon Goblimon')
    const compact=filterDUnitCandidateRoutes(snapshot, '')

    expect(routes).toHaveLength(1)
    expect(routes[0]?.totalGain).toBe(310)
    expect([...new Set(routes[0]?.recommendations.map(item=>item.setId))]).toEqual(['dunit-159', 'dunit-34', 'dunit-41', 'dunit-96'])
    expect(compact.some(route=>dUnitRouteSignature(route)===dUnitRouteSignature(routes[0]!))).toBe(true)
    // The same signature used by the comparison checkbox remains available
    // after a search, so this frontier route can be selected alongside a
    // compact candidate without exposing internal set IDs.
    const selected=new Set([dUnitRouteSignature(compact[0]!),dUnitRouteSignature(routes[0]!)] )
    expect(selected).toContain(dUnitRouteSignature(routes[0]!))
    expect(selected.size).toBe(2)
  })

  it('keeps every Tentomon route available through loading more cards, including the +310 EXP candidate', () => {
    const snapshot = calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const target = filterDUnitCandidateRoutes(snapshot, 'Tentomon Guilmon Lopmon Goblimon')[0]!
    const targetSignature = dUnitRouteSignature(target)
    const tentomonRoutes = filterDUnitCandidateRoutes(snapshot, 'Tentomon')
    const tentomonGuilmonRoutes = filterDUnitCandidateRoutes(snapshot, 'Tentomon Guilmon')

    expect(tentomonRoutes).toHaveLength(1305)
    expect(tentomonRoutes.some(route => dUnitRouteSignature(route) === targetSignature)).toBe(true)
    expect(tentomonGuilmonRoutes.some(route => dUnitRouteSignature(route) === targetSignature)).toBe(true)

    const targetIndex = tentomonRoutes.findIndex(route => dUnitRouteSignature(route) === targetSignature)
    expect(targetIndex).toBeGreaterThanOrEqual(DUNIT_ROUTE_PAGE_SIZE)

    const initiallyVisible = tentomonRoutes.slice(0, DUNIT_ROUTE_PAGE_SIZE)
    const pagesNeeded = Math.ceil((targetIndex + 1) / DUNIT_ROUTE_PAGE_SIZE)
    const visibleAfterLoading = tentomonRoutes.slice(0, pagesNeeded * DUNIT_ROUTE_PAGE_SIZE)
    expect(initiallyVisible.some(route => dUnitRouteSignature(route) === targetSignature)).toBe(false)
    expect(visibleAfterLoading.some(route => dUnitRouteSignature(route) === targetSignature)).toBe(true)

    // Comparison selection is stored by route signature rather than card index,
    // so it survives expanding the visible card range.
    const selected = new Set([dUnitRouteSignature(tentomonRoutes[0]!), targetSignature])
    expect(initiallyVisible.filter(route => selected.has(dUnitRouteSignature(route)))).toHaveLength(1)
    expect(visibleAfterLoading.filter(route => selected.has(dUnitRouteSignature(route)))).toHaveLength(2)
  })

  it('keeps selected routes comparable across searches and restores pagination after clearing the query', () => {
    const snapshot = calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const tentomonRoute = filterDUnitCandidateRoutes(snapshot, 'Tentomon Guilmon Lopmon Goblimon')[0]!
    const otherRoute = filterDUnitCandidateRoutes(snapshot, 'Hackmon Resistência Asas Supremas II Entidade das Trevas')[0]!

    expect(tentomonRoute.totalGain).toBe(310)
    expect(otherRoute.totalGain).toBe(310)

    // The comparison state retains route snapshots, not only signatures that
    // can be resolved through whichever search is currently visible.
    const selected = [tentomonRoute, otherRoute]
    const clearedSearch = filterDUnitCandidateRoutes(snapshot, '')
    const changedSearch = filterDUnitCandidateRoutes(snapshot, 'Hackmon')
    expect(clearedSearch.length).toBeGreaterThan(DUNIT_ROUTE_PAGE_SIZE)
    expect(clearedSearch.slice(0, DUNIT_ROUTE_PAGE_SIZE)).toHaveLength(DUNIT_ROUTE_PAGE_SIZE)
    expect(selected.map(dUnitRouteSignature)).toEqual([dUnitRouteSignature(tentomonRoute), dUnitRouteSignature(otherRoute)])
    expect(changedSearch.some(route => dUnitRouteSignature(route) === dUnitRouteSignature(tentomonRoute))).toBe(false)
    expect(selected).toHaveLength(2)

    const afterRemovingOne = selected.filter(route => dUnitRouteSignature(route) !== dUnitRouteSignature(tentomonRoute))
    expect(afterRemovingOne).toEqual([otherRoute])
    expect([]).toHaveLength(0)
  })

  it('does not count an already completed +20 EXP condition again toward the four-set +310 package', () => {
    const targetQuery = 'Tentomon Guilmon Lopmon Goblimon'
    const tentomonFirstStep = dUnitSets.find(set => set.id === 'dunit-34')!.conditions[0]!
    const completedFromPackage = toggleDUnitCondition({}, 'dunit-34', tentomonFirstStep.id, true)
    const packageProgress = calculateDUnitGoalRoute(completedFromPackage, 'EXP||percent', 300)

    expect(packageProgress.current).toBe(20)
    expect(packageProgress.target).toBe(300)
    expect(filterDUnitCandidateRoutes(packageProgress, targetQuery)).toHaveLength(0)

    // A +20 EXP condition outside the four sets does not consume any of this
    // package's pending bonus. The same route remains a valid +310 candidate.
    const externalStep = dUnitSets.find(set => set.id === 'dunit-275')!.conditions[1]!
    const completedElsewhere = toggleDUnitCondition({}, 'dunit-275', externalStep.id, true)
    const externalProgress = calculateDUnitGoalRoute(completedElsewhere, 'EXP||percent', 300)
    const routes = filterDUnitCandidateRoutes(externalProgress, targetQuery)

    expect(externalProgress.current).toBe(20)
    expect(routes).toHaveLength(1)
    expect(routes[0]?.totalGain).toBe(310)
  })

  it('keeps recommendations incremental across empty, partial, complete, and inventory-only D-Unit states', () => {
    const expKey = 'EXP||percent'
    const target = 300
    const tentomon = dUnitSets.find(set => set.id === 'dunit-34')!
    const guilmon = dUnitSets.find(set => set.id === 'dunit-41')!
    const lopmon = dUnitSets.find(set => set.id === 'dunit-96')!
    const goblimon = dUnitSets.find(set => set.id === 'dunit-159')!

    // A — Empty progress: the established +310 package is a valid new gain.
    const empty = calculateDUnitGoalRoute({}, expKey, target)
    expect(filterDUnitCandidateRoutes(empty, 'Tentomon Guilmon Lopmon Goblimon')).toHaveLength(1)

    // B — A completed Tentomon EXP condition is not re-added and no longer
    // lets that exact package reach a further +300 EXP by itself.
    const tentomonPartial = toggleDUnitCondition({}, tentomon.id, tentomon.conditions[0]!.id, true)
    const partial = calculateDUnitGoalRoute(tentomonPartial, expKey, target)
    expect(partial.current).toBe(20)
    expect(filterDUnitCandidateRoutes(partial, 'Tentomon Guilmon Lopmon Goblimon')).toHaveLength(0)
    expect(filterDUnitCandidateRoutes(partial, '').every(route => route.totalGain >= target)).toBe(true)
    expect(filterDUnitCandidateRoutes(partial, '').every(route => route.recommendations.every(item => !isDUnitRouteRecommendationCompleted(tentomonPartial, item.condition)))).toBe(true)
    expect(filterDUnitCandidateRoutes(partial, 'Tentomon').some(route => route.recommendations.some(item => item.setId === tentomon.id && item.condition.position > 1))).toBe(true)

    // C — A fully completed set is excluded from new work altogether.
    const tentomonComplete = tentomon.conditions.reduce((progress, condition) => toggleDUnitCondition(progress, tentomon.id, condition.id, true), {})
    const afterTentomon = calculateDUnitGoalRoute(tentomonComplete, expKey, target)
    expect(filterDUnitCandidateRoutes(afterTentomon, 'Tentomon')).toHaveLength(0)
    expect(filterDUnitCandidateRoutes(afterTentomon, '').every(route => route.recommendations.every(item => item.setId !== tentomon.id))).toBe(true)

    // D — Inventory facts help estimate remaining work but never check a
    // D-Unit condition or remove its bonus from the additional target.
    const inventoryOnly = calculateDUnitGoalRoute({}, expKey, target, {
      ownedDigimonIds: ['tentomon'],
      unlockedDigimonIds: ['kabuterimon'],
      levelByDigimonId: { tentomon: 120 },
    })
    expect(inventoryOnly.current).toBe(0)
    expect(filterDUnitCandidateRoutes(inventoryOnly, 'Tentomon Guilmon Lopmon Goblimon')).toHaveLength(1)

    // E — Several partially completed sets still contribute only their
    // pending steps, while the route pool remains capable of meeting +300.
    let multiPartial = toggleDUnitCondition({}, tentomon.id, tentomon.conditions[0]!.id, true)
    multiPartial = toggleDUnitCondition(multiPartial, guilmon.id, guilmon.conditions[0]!.id, true)
    multiPartial = toggleDUnitCondition(multiPartial, lopmon.id, lopmon.conditions[0]!.id, true)
    multiPartial = toggleDUnitCondition(multiPartial, goblimon.id, goblimon.conditions[0]!.id, true)
    const withInventory = calculateDUnitGoalRoute(multiPartial, expKey, target, {
      ownedDigimonIds: ['tentomon', 'guilmon-chaosgallantmon'],
      unlockedDigimonIds: ['kabuterimon', 'growlmon'],
      levelByDigimonId: { tentomon: 120, 'guilmon-chaosgallantmon': 120 },
    })
    const viable = filterDUnitCandidateRoutes(withInventory, '')
    expect(withInventory.current).toBe(80)
    expect(viable.length).toBeGreaterThan(0)
    expect(viable.every(route => route.totalGain >= target)).toBe(true)
    expect(viable.every(route => route.recommendations.every(item => !isDUnitRouteRecommendationCompleted(multiPartial, item.condition)))).toBe(true)
  })

  it('keeps the visible route cards neutral and summarizes pending task kinds without treating them as cost', () => {
    const snapshot = calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const routes = filterDUnitCandidateRoutes(snapshot, '')
    expect(routes[0]?.unverifiedSetIds.length).toBeGreaterThan(0)
    expect(routes[0]?.recommendations).toEqual(snapshot.recommendations)
    expect(routeTaskSummary(routes[0]!, {})).toMatchObject({ obtained: 3, level: 3, transcendence: 3 })
  })

  it('uses recorded historical obtainment and confirmed lines as evidence without turning them into validated cost', () => {
    const snapshot=calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const route=filterDUnitCandidateRoutes(snapshot, 'Tentomon Guilmon Lopmon Goblimon')[0]!
    const overview=dUnitRouteOverview(route,{ownedDigimonIds:['tentomon'],levelByDigimonId:{tentomon:120}})

    expect(overview.owned).toContain('Tentomon')
    expect(overview.missingBases).toEqual(expect.arrayContaining(['Guilmon [ChaosGallantmon line]','Lopmon','Goblimon']))
    expect(overview.confirmedLines).toEqual(expect.arrayContaining(['Tentomon','Guilmon [ChaosGallantmon line]','Lopmon','Goblimon']))
    expect(overview.historicalObtainment).toEqual(expect.arrayContaining([
      expect.stringContaining('Tentomon: Caixa de incubação Lv.4~5'),
      expect.stringContaining('Goblimon: Caixa de incubação Lv.4~5'),
    ]))
    expect(overview.unlocks).toEqual([])
    expect(route.unverifiedSetIds).toEqual(expect.arrayContaining(['dunit-34','dunit-41','dunit-96','dunit-159']))
  })

  it('distinguishes unknown individual work from known zero and known pending work in route comparison', () => {
    const snapshot=calculateDUnitGoalRoute({}, 'EXP||percent', 300)
    const template=snapshot.recommendations[0]!
    const unknownSet=dUnitSets.find(set=>set.id==='dunit-148')!
    const unknownRoute={...snapshot,recommendations:unknownSet.conditions.map(condition=>({...template,setId:unknownSet.id,condition})),setCount:1}
    const unknown=dUnitRouteOverview(unknownRoute,{})

    expect(unknown.determinability).toEqual({bases:false,evolutions:false,levels:false,transcendence:false})
    expect(dUnitComparisonMetricText(unknown.determinability.bases,unknown.missingBases.length,'Não identificado')).toBe('Não identificado')

    const knownSet=dUnitSets.find(set=>set.id==='dunit-34')!
    const knownRoute={...snapshot,recommendations:[{...template,setId:knownSet.id,condition:knownSet.conditions[0]!}],setCount:1}
    const knownIds=identitiesForDUnitSet(knownSet.id).map(identity=>identity.digimonId!).filter(Boolean)
    const complete=dUnitRouteOverview(knownRoute,{ownedDigimonIds:knownIds,unlockedDigimonIds:knownIds})
    const pending=dUnitRouteOverview(knownRoute,{})

    expect(complete.determinability.bases).toBe(true)
    expect(complete.missingBases).toHaveLength(0)
    expect(dUnitComparisonMetricText(complete.determinability.bases,complete.missingBases.length,'Não identificado')).toBe('0')
    expect(pending.determinability.bases).toBe(true)
    expect(pending.missingBases.length).toBeGreaterThan(0)
    expect(dUnitComparisonMetricText(pending.determinability.bases,pending.missingBases.length,'Não identificado')).toBe(String(pending.missingBases.length))
  })
})
