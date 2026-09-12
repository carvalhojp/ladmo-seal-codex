import { describe, expect, it } from 'vitest'
import { levels } from '../types'
import { seals } from '../data/seals'
import { buildProgressOptions, finalParetoFrontier, isDominatedPlan, optimizeGoal } from './goalOptimizer'
import { levelFor, nextLevel } from './calculations'
import { progressionForIdentity } from '../data/progressions'

const byName = (name: string, attribute: string) => {
  const seal = seals.find(item => item.name === name && item.attribute === attribute)
  if (!seal) throw new Error(`Missing seal ${name}`)
  return seal
}

describe('goal optimizer', () => {
  const gammamon = byName('Gammamon', 'HT')
  it('creates exactly one candidate for every useful rank', () => {
    const options = buildProgressOptions(gammamon)
    expect(options.map(option => option.finalQuantity)).toEqual([1, 50, 200, 500, 1000, 3000])
    expect(options.map(option => option.bonusGain)).toEqual(levels.map(level => gammamon.masterValue * level.multiplier))
  })
  it('calculates incremental rank cost from existing quantity', () => {
    const silver = buildProgressOptions(gammamon, { quantity: 50 }).find(option => option.finalQuantity === 200)!
    expect(silver.additionalSeals).toBe(150)
    expect(silver.tickets).toBe(15)
    expect(silver.openers).toBe(3)
    expect(silver.bonusGain).toBe(20)
  })
  it('uses the individual quantity already owned before pricing a new rank', () => {
    const patamon = byName('Patamon', 'AT')
    const silver = buildProgressOptions(patamon, { quantity: 100 }).find(option => option.level === 'silver')!
    expect(silver.finalQuantity).toBe(200)
    expect(silver.additionalSeals).toBe(100)
    expect(silver.bonusGain).toBe(patamon.masterValue * .2)
  })
  it('excludes do-not-recommend seals', () => {
    expect(buildProgressOptions(gammamon, { quantity: 0, doNotRecommend: true })).toEqual([])
  })
  it('does not use two ranks of the same seal', () => {
    const plan = optimizeGoal('HT', 100, [gammamon], {}, 'cheap')!
    expect(plan.recommendations).toHaveLength(1)
  })
  it('finds a HT +200 route no worse than the known 100 ticket benchmark', () => {
    const plan = optimizeGoal('HT', 200, seals, {}, 'cheap')!
    expect(plan.totalBonus).toBeGreaterThanOrEqual(200)
    expect(plan.totalTickets).toBeLessThanOrEqual(100)
    expect(plan.totalOpeners).toBeLessThanOrEqual(16)
  })
  it('finds the known HT benchmark when limited to its four seals', () => {
    const four = ['Gammamon', 'Drimogemon', 'Floramon', 'Witchmon'].map(name => byName(name, 'HT'))
    const plan = optimizeGoal('HT', 200, four, {}, 'cheap')!
    expect(plan.totalTickets).toBeLessThanOrEqual(100)
    expect(plan.totalOpeners).toBeLessThanOrEqual(16)
  })
  it('keeps the AT +1000 less-openers route rational and Pareto valid', () => {
    const plan = optimizeGoal('AT', 1000, seals, {}, 'openers')!
    expect(plan.totalBonus).toBeGreaterThanOrEqual(1000)
    expect(plan.totalTickets).toBeLessThan(900000)
    expect(plan.recommendations.every(item => item.additionalSeals > 0)).toBe(true)
    expect(isDominatedPlan(plan, finalParetoFrontier([plan], 1000))).toBe(false)
  })
  it('can meet a target exactly and retain percentage attribute precision', () => {
    const ct = byName('Lucemon', 'CT')
    const plan = optimizeGoal('CT', 10, [ct], {}, 'cheap')!
    expect(plan.totalBonus).toBe(10)
    expect(plan.recommendations[0].finalQuantity).toBe(1)
  })
  it('uses Lucemon CT alternate thresholds without changing status multipliers', () => {
    const lucemon = byName('Lucemon', 'CT')
    expect(nextLevel(1, lucemon)?.threshold).toBe(30)
    expect(levelFor(150, lucemon)?.id).toBe('silver')
    expect(buildProgressOptions(lucemon, { quantity: 30 }).find(option => option.level === 'silver')?.additionalSeals).toBe(120)
    expect(levelFor(700, lucemon)?.id).toBe('master')
  })
  it('keeps the three declared alternate progressions scoped to their exact identity', () => {
    expect(progressionForIdentity('Lucemon', 'CT').master).toBe(700)
    expect(progressionForIdentity('Reppamon', 'EV').platinum).toBe(500)
    expect(progressionForIdentity('Labramon', 'DE').gold).toBe(300)
    expect(progressionForIdentity('Guilmon', 'AT').master).toBe(3000)
  })
  it('discards a valid route dominated in both Tickets and Openers', () => {
    const better = { recommendations: [], totalBonus: 100, totalTickets: 10, totalOpeners: 2, totalAdditionalSeals: 100, excess: 0 }
    const worse = { recommendations: [], totalBonus: 100, totalTickets: 20, totalOpeners: 3, totalAdditionalSeals: 1, excess: 0 }
    expect(isDominatedPlan(worse, [better, worse])).toBe(true)
    expect(finalParetoFrontier([better, worse], 100)).toEqual([better])
  })
  it('keeps opposite Tickets/Openers trade-offs on the final Pareto frontier', () => {
    const ticketsFirst = { recommendations: [], totalBonus: 200, totalTickets: 100, totalOpeners: 16, totalAdditionalSeals: 800, excess: 0 }
    const openersFirst = { recommendations: [], totalBonus: 200, totalTickets: 2500, totalOpeners: 2, totalAdditionalSeals: 100, excess: 0 }
    expect(finalParetoFrontier([ticketsFirst, openersFirst], 200)).toHaveLength(2)
  })
})
