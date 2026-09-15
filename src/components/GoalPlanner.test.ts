import { describe, expect, it } from 'vitest'
import { seals } from '../data/seals'
import { addRecommendedQuantity, getSealState } from '../utils/sealState'
import { createGoalPlanSnapshot } from './GoalPlanner'

const devimon = seals.find(seal => seal.name === 'Devimon')!
const patamon = seals.find(seal => seal.name === 'Patamon')!
const onlyDevimon = (quantity: number) => Object.fromEntries(seals.map(seal => [seal.id, {
  quantity: seal.id === devimon.id ? quantity : 0,
  doNotRecommend: seal.id !== devimon.id,
}]))

describe('Goal Planner route snapshots', () => {
  it('keeps a generated route stable after its first recommendation is added to real progress', () => {
    const progress = { [devimon.id]: { quantity: 0 }, [patamon.id]: { quantity: 0 } }
    const snapshot = createGoalPlanSnapshot('AT', 100, 'cheap', progress)!
    const first = snapshot.recommendations[0]
    const states = addRecommendedQuantity({}, first.seal.id, first.additionalSeals)

    expect(snapshot.recommendations[0]).toEqual(first)
    expect(getSealState(states, first.seal.id).quantity).toBe(first.additionalSeals)
    expect(getSealState(states, patamon.id).quantity).toBe(0)
  })

  it('creates a fresh route from updated real progress only when requested again', () => {
    const initial = createGoalPlanSnapshot('AT', 40, 'cheap', onlyDevimon(0))!
    const first = initial.recommendations[0]
    const states = addRecommendedQuantity({}, devimon.id, first.additionalSeals)
    const recalculated = createGoalPlanSnapshot('AT', 40, 'cheap', onlyDevimon(getSealState(states, devimon.id).quantity))!

    expect(initial.recommendations[0].additionalSeals).toBe(first.additionalSeals)
    expect(recalculated.recommendations[0].additionalSeals).toBeGreaterThan(first.additionalSeals)
  })

  it('continues to offer only the additional progression needed after an existing rank', () => {
    const snapshot = createGoalPlanSnapshot('AT', 40, 'cheap', onlyDevimon(500))!
    expect(snapshot.recommendations[0].additionalSeals).toBe(500)
  })
})
