import { describe, expect, it } from 'vitest'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { levelsFor, valueFor } from './calculations'
import { summarizeMyTamer } from './myTamer'
import type { DUnitProgress } from './dUnit'

const state = (quantity = 0, hasSeal = false, doNotRecommend = false) => ({ quantity, hasSeal, doNotRecommend })
const mark = (count: number, index = 0) => ({ [dUnitSets[index].id]: Object.fromEntries(dUnitSets[index].conditions.slice(0, count).map(c => [c.id, true])) })

describe('Meu Tamer derived progress', () => {
  it('counts owned catalogue IDs, including zero-quantity ownership, but not exclusions or stale IDs', () => {
    const result = summarizeMyTamer({ [seals[0].id]: state(0, true), [seals[1].id]: state(1), [seals[2].id]: state(0, false, true), obsolete: state(3000, true) }, {})
    expect(result.seals.owned).toBe(2)
    expect(result.seals.total).toBe(seals.length)
  })
  it('does not credit any bonus for ownership with quantity zero and offers the real first stage', () => {
    const result = summarizeMyTamer({ [seals[0].id]: state(0, true) }, {})
    expect(Object.values(result.seals.bonuses).every(value => value === 0)).toBe(true)
    const next = result.seals.next[0], first = levelsFor(seals[0])[0]
    expect(next.current).toBeNull()
    expect(next.remaining).toBe(first.threshold)
    expect(next.gain).toBe(valueFor(seals[0], first.id))
  })
  it('uses actual thresholds for bonuses, Master and next-stage gain', () => {
    const seal = seals[0], levels = levelsFor(seal)
    const result = summarizeMyTamer({ [seal.id]: state(levels[1].threshold + 1) }, {})
    expect(result.seals.bonuses[seal.attribute]).toBe(valueFor(seal, levels[1].id))
    expect(result.seals.next[0].remaining).toBe(levels[2].threshold - levels[1].threshold - 1)
    expect(result.seals.next[0].gain).toBe(valueFor(seal, levels[2].id) - valueFor(seal, levels[1].id))
    const mastered = summarizeMyTamer({ [seal.id]: state(levels[5].threshold) }, {})
    expect(mastered.seals.master).toBe(1)
    expect(mastered.seals.next).toEqual([])
  })
  it('respects exclusions without removing their recorded bonuses or collection', () => {
    const result = summarizeMyTamer({ [seals[0].id]: state(50, true, true) }, {})
    expect(result.seals.owned).toBe(1)
    expect(result.seals.next).toEqual([])
    expect(result.seals.bonuses[seals[0].attribute]).toBeGreaterThan(0)
  })
  it('limits next Seals to three, sorts remaining quantities and breaks ties by catalogue order', () => {
    const fixtures = seals.slice(0, 5)
    const states = Object.fromEntries([...fixtures].reverse().map((seal, index) => [seal.id, state(levelsFor(seal)[1].threshold - (index === 0 ? 1 : 2))]))
    const next = summarizeMyTamer(states, {}).seals.next
    expect(next.map(item => item.seal.id)).toEqual([fixtures[4].id, fixtures[0].id, fixtures[1].id])
    expect(next.map(item => item.remaining)).toEqual([1, 2, 2])
  })
  it('counts only explicit valid conditions, distinguishing complete, partial and untouched sets', () => {
    const progress = { ...mark(4), ...mark(1, 1), invalid: { invalid: true }, [dUnitSets[2].id]: { invalid: true, [dUnitSets[2].conditions[0].id]: false } }
    const result = summarizeMyTamer({}, progress).dUnit
    expect(result.completed).toBe(5)
    expect(result.completeSets).toBe(1)
    expect(result.startedSets).toBe(1)
    expect(result.totalSets).toBe(dUnitSets.length)
    expect(result.totalConditions).toBe(dUnitSets.reduce((sum, set) => sum + set.conditions.length, 0))
    expect(result.next).toEqual([])
  })
  it('offers exactly one remaining condition, limits to three, and retains catalogue order', () => {
    const progress = Object.assign({}, mark(4), mark(3, 4), mark(3, 3), mark(3, 2), mark(3, 1))
    const next = summarizeMyTamer({}, progress).dUnit.next
    expect(next.map(item => item.set.id)).toEqual(dUnitSets.slice(1, 4).map(set => set.id))
    expect(next.every(item => item.condition.id === item.set.conditions[3].id)).toBe(true)
  })
  it('aggregates only completed bonuses and preserves attribute, qualifier and unit keys', () => {
    const progress: DUnitProgress = {}
    const expected: Record<string, number> = {}
    for (const set of dUnitSets) for (const condition of set.conditions) {
      const bonus = condition.bonus
      const key = `${bonus.attribute ?? ''}|${bonus.qualifier ?? ''}|${bonus.unit ?? ''}`
      if (key in expected) continue
      expected[key] = bonus.value ?? 0
      progress[set.id] = { ...progress[set.id], [condition.id]: true }
    }
    expect(summarizeMyTamer({}, progress).dUnit.bonuses).toEqual(expected)
    const single = dUnitSets[0].conditions[0].bonus
    expect(summarizeMyTamer({}, mark(1)).dUnit.bonuses).toEqual({ [`${single.attribute ?? ''}|${single.qualifier ?? ''}|${single.unit ?? ''}`]: single.value ?? 0 })
  })
  it('has no false progress or next steps for empty/configuration-only data', () => {
    for (const states of [{}, { [seals[0].id]: state(0, false, true) }]) {
      const result = summarizeMyTamer(states, {})
      expect(result.hasProgress).toBe(false)
      expect(result.seals.next).toEqual([])
      expect(result.dUnit.next).toEqual([])
    }
  })
  it('recomputes independently after changed or cleared state without mutating inputs', () => {
    const states = { [seals[0].id]: state(50, true) }, progress = mark(3)
    const before = JSON.stringify({ states, progress })
    expect(summarizeMyTamer(states, progress).hasProgress).toBe(true)
    expect(summarizeMyTamer({}, {}).hasProgress).toBe(false)
    expect(JSON.stringify({ states, progress })).toBe(before)
  })
})
