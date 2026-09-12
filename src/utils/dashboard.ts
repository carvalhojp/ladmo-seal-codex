import type { Attribute, OwnedSeal, Seal } from '../types'
import { levelFor, valueFor } from './calculations'

export type AttributeTotals = Record<Attribute, number>

export const emptyAttributeTotals = (): AttributeTotals => ({ AT: 0, HP: 0, DS: 0, DE: 0, HT: 0, CT: 0, BL: 0, EV: 0 })

/** Adds each owned seal only to the accumulator matching its own attribute. */
export function calculateAttributeTotals(owned: OwnedSeal[], sealData: Seal[]): AttributeTotals {
  const result = emptyAttributeTotals()
  const byId = new Map(sealData.map(seal => [seal.id, seal]))
  for (const item of owned) {
    const seal = byId.get(item.sealId)
    if (!seal) continue
    const level = levelFor(item.quantity, seal)
    if (level) result[seal.attribute] += valueFor(seal, level.id)
  }
  return result
}
