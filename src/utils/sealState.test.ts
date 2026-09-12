import { describe, expect, it } from 'vitest'
import { canConsiderEvolution, canRecommendAcquisition, getSealState, migrateLegacyOwned, readSealStates, sealStateKey, updateSealState } from './sealState'

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
})
