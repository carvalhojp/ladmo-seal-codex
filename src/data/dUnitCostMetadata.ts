import { operationalPilotSets, rankAuditByDigimonId, type DUnitAuditStatus } from './dUnitRankAudit'
import { evolutionLineForDigimon } from './dUnitEvolutionLineAudit'

/** Optional, auditable enrichment for D-Unit cost estimates. */
export type DUnitDigimonCostTier = 'basic' | 'intermediate' | 'advanced' | 'sss' | 'sss_plus' | 'u' | 'unknown'

export type DUnitCostMetadata = {
  setId: string
  digimonId: string
  evolutionLineId?: string
  portraitIndex?: number
  digimonName?: string
  tier: Exclude<DUnitDigimonCostTier, 'unknown'>
  confirmed: true
  source: string
  /** Filled only with direct, source-backed acquisition evidence. */
  obtainmentMethod?: string
  unlockRequirement?: string
  /** A rank alone is not an obtainment-cost proof. */
  obtainmentStatus?: DUnitAuditStatus
  obtainmentNote?: string
}

/**
 * Confirmed entries only.  Pending/probable research deliberately remains
 * absent here so it cannot alter accessibility, ordering, or route cost.
 */
export const dUnitCostMetadata: readonly DUnitCostMetadata[] = operationalPilotSets().flatMap(set => set.digimonIds.map(digimonId => {
  const rank = rankAuditByDigimonId(digimonId)!
  return {
    setId: set.setId,
    digimonId,
    evolutionLineId: evolutionLineForDigimon(digimonId)?.evolutionLineId,
    digimonName: `${rank.canonicalName}${rank.variant ? ` [${rank.variant}]` : ''}`,
    tier: rank.costTier as Exclude<DUnitDigimonCostTier, 'unknown'>,
    confirmed: true,
    source: rank.sources[0]!.url,
    obtainmentStatus: 'unknown',
    obtainmentNote: 'A composição, identidade e rank são confirmados; a disponibilidade e o custo de obtenção ainda não possuem auditoria própria.',
  }
}))

export const metadataForDUnitSet = (setId: string, metadata = dUnitCostMetadata) =>
  metadata.filter(entry => entry.setId === setId && entry.confirmed)

/**
 * Cost ordering is allowed only when every audited member has direct evidence
 * for how it is obtained. Missing evidence remains visible as uncertainty;
 * it is never translated into a made-up rarity weight.
 */
export const hasValidatedObtainmentCost = (setId: string, metadata = dUnitCostMetadata) => {
  const entries = metadataForDUnitSet(setId, metadata)
  return entries.length > 0 && entries.every(entry => (entry.obtainmentStatus ?? 'confirmed') === 'confirmed')
}
