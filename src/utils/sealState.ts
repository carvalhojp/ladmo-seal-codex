import type { OwnedSeal } from '../types'

export interface SealUserState {
  quantity: number
  hasSeal: boolean
  doNotRecommend: boolean
}

export type SealStateMap = Record<string, SealUserState>
export const sealStateKey = 'ladmo-seal-state-v2'
const emptyState = (): SealUserState => ({ quantity: 0, hasSeal: false, doNotRecommend: false })

export function getSealState(states: SealStateMap, sealId: string): SealUserState {
  return states[sealId] ?? emptyState()
}

export function updateSealState(states: SealStateMap, sealId: string, patch: Partial<SealUserState>): SealStateMap {
  const previous = getSealState(states, sealId)
  const next = { ...previous, ...patch }
  return { ...states, [sealId]: next }
}

/** Preserves legacy inventory quantities while moving to per-seal versioned state. */
export function migrateLegacyOwned(legacy: OwnedSeal[] | null): SealStateMap {
  return (legacy ?? []).reduce<SealStateMap>((states, item) => updateSealState(states, item.sealId, {
    quantity: Math.max(0, item.quantity), hasSeal: item.quantity > 0,
  }), {})
}

export function readSealStates(storage: Pick<Storage, 'getItem'>): SealStateMap {
  try {
    const current = storage.getItem(sealStateKey)
    if (current) return JSON.parse(current) as SealStateMap
    const legacy = storage.getItem('ladmo-owned')
    return migrateLegacyOwned(legacy ? JSON.parse(legacy) as OwnedSeal[] : null)
  } catch { return {} }
}

export function toOwnedSeals(states: SealStateMap): OwnedSeal[] {
  return Object.entries(states).filter(([, value]) => value.hasSeal || value.quantity > 0)
    .map(([sealId, value]) => ({ sealId, quantity: value.quantity }))
}

export const canRecommendAcquisition = (state: SealUserState) => !state.hasSeal && !state.doNotRecommend
export const canConsiderEvolution = (state: SealUserState) => state.hasSeal && !state.doNotRecommend
