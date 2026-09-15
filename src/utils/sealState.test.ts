import { describe, expect, it } from 'vitest'
import { addRecommendedQuantity, canConsiderEvolution, canRecommendAcquisition, getSealState, migrateLegacyOwned, readSealStates, sealStateKey, toOwnedSeals, updateSealState } from './sealState'
import { seals } from '../data/seals'
import { calculateAttributeTotals } from './dashboard'
import { optimizeGoal } from './goalOptimizer'

describe('individual Seal state', () => {
  it('keeps different attributes independent', () => {
    const states = updateSealState({}, 'devimon-at', { quantity: 200, hasSeal: true })
    expect(getSealState(states, 'gaomon-hp')).toEqual({ quantity: 0, hasSeal: false, doNotRecommend: false })
  })
  it('keeps two seals of the same attribute independent', () => {
    const states = updateSealState({}, 'devimon-at', { doNotRecommend: true })
    expect(getSealState(states, 'guilmon-at').doNotRecommend).toBe(false)
  })
  it('does not share quantity, progress or flags between records', () => {
    let states = updateSealState({}, 'devimon-at', { quantity: 50, hasSeal: true, doNotRecommend: true })
    states = updateSealState(states, 'guilmon-at', { quantity: 200, hasSeal: true })
    expect(getSealState(states, 'devimon-at')).toEqual({ quantity: 50, hasSeal: true, doNotRecommend: true })
    expect(getSealState(states, 'guilmon-at')).toEqual({ quantity: 200, hasSeal: true, doNotRecommend: false })
  })
  it('migrates legacy owned data by stable seal id', () => {
    expect(migrateLegacyOwned([{ sealId: 'devimon-at', quantity: 50 }])).toEqual({
      'devimon-at': { quantity: 50, hasSeal: true, doNotRecommend: false },
    })
  })
  it('reads persisted v2 state without changing another seal', () => {
    const storage = { getItem: (key: string) => key === sealStateKey ? JSON.stringify({ 'devimon-at': { quantity: 1, hasSeal: true, doNotRecommend: false } }) : null }
    expect(getSealState(readSealStates(storage), 'gaomon-hp').quantity).toBe(0)
  })
  it('does not recommend an owned seal as a new acquisition, but allows its evolution', () => {
    const owned = { quantity: 50, hasSeal: true, doNotRecommend: false }
    expect(canRecommendAcquisition(owned)).toBe(false)
    expect(canConsiderEvolution(owned)).toBe(true)
  })
  it('excludes a seal marked do not recommend from acquisition and evolution', () => {
    const blocked = { quantity: 0, hasSeal: false, doNotRecommend: true }
    expect(canRecommendAcquisition(blocked)).toBe(false)
    expect(canConsiderEvolution(blocked)).toBe(false)
  })

  it('adds a recommendation by stable ID, marks it owned, and leaves other Seals untouched', () => {
    const next = addRecommendedQuantity({}, 'seal-16709', 50)
    expect(getSealState(next, 'seal-16709')).toEqual({ quantity: 50, hasSeal: true, doNotRecommend: false })
    expect(getSealState(next, 'seal-16737')).toEqual({ quantity: 0, hasSeal: false, doNotRecommend: false })
    expect(toOwnedSeals(next)).toEqual([{ sealId: 'seal-16709', quantity: 50 }])
  })

  it('adds to existing recommended progress without changing the do-not-recommend preference', () => {
    const states = { 'seal-16709': { quantity: 200, hasSeal: true, doNotRecommend: true } }
    expect(getSealState(addRecommendedQuantity(states, 'seal-16709', 300), 'seal-16709')).toEqual({ quantity: 500, hasSeal: true, doNotRecommend: true })
  })

  it('ignores a non-positive recommendation so a click cannot corrupt quantity', () => {
    const states = { 'seal-16709': { quantity: 50, hasSeal: true, doNotRecommend: false } }
    expect(addRecommendedQuantity(states, 'seal-16709', 0)).toBe(states)
    expect(addRecommendedQuantity(states, 'seal-16709', Number.NaN)).toBe(states)
  })

  it('makes an added recommendation immediately available to dashboard and Goal Planner calculations', () => {
    const devimon = seals.find(seal => seal.id === 'seal-16709')!
    const states = addRecommendedQuantity({}, devimon.id, 50)
    expect(calculateAttributeTotals(toOwnedSeals(states), seals).AT).toBeGreaterThan(0)
    const plan = optimizeGoal('AT', 40, [devimon], { [devimon.id]: { quantity: 50 } }, 'cheap')
    expect(plan?.recommendations[0].additionalSeals).toBe(150)
  })
})
