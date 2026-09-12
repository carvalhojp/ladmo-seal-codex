import { describe, expect, it } from 'vitest'
import { seals } from '../data/seals'
import { calculateAttributeTotals } from './dashboard'

const seal = (name: string, attribute: string) => {
  const found = seals.find(item => item.name === name && item.attribute === attribute)
  if (!found) throw new Error(`Missing fixture: ${name} / ${attribute}`)
  return found
}

describe('Dashboard attribute totals', () => {
  const guilmon = seal('Guilmon', 'AT')
  const gaomon = seal('Gaomon', 'HP')
  const lucemon = seal('Lucemon', 'CT')

  it('credits Guilmon only to AT', () => {
    const totals = calculateAttributeTotals([{ sealId: guilmon.id, quantity: 3000 }], seals)
    expect(totals).toEqual({ AT: 150, HP: 0, DS: 0, DE: 0, HT: 0, CT: 0, BL: 0, EV: 0 })
  })
  it('accumulates Gaomon only in HP without altering Guilmon AT', () => {
    const totals = calculateAttributeTotals([{ sealId: guilmon.id, quantity: 3000 }, { sealId: gaomon.id, quantity: 3000 }], seals)
    expect(totals).toEqual({ AT: 150, HP: 150, DS: 0, DE: 0, HT: 0, CT: 0, BL: 0, EV: 0 })
  })
  it('accumulates Lucemon only in CT', () => {
    const totals = calculateAttributeTotals([{ sealId: guilmon.id, quantity: 3000 }, { sealId: gaomon.id, quantity: 3000 }, { sealId: lucemon.id, quantity: 3000 }], seals)
    expect(totals).toEqual({ AT: 150, HP: 150, DS: 0, DE: 0, HT: 0, CT: 100, BL: 0, EV: 0 })
  })
})
