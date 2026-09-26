import { describe, expect, it } from 'vitest'
import { dUnitCostMetadata, metadataForDUnitSet } from './dUnitCostMetadata'
import { dUnitDigimonRankAudit, dUnitPilotSetRankAudit, isOperationalPilotSet, operationalPilotSets, rankAuditByCanonicalName, rankAuditByDigimonId } from './dUnitRankAudit'

describe('D-Unit rank/a11y audit pilot', () => {
  it('uses unique canonical IDs and keeps variants separate', () => {
    expect(new Set(dUnitDigimonRankAudit.map(entry => entry.digimonId)).size).toBe(dUnitDigimonRankAudit.length)
    expect(rankAuditByDigimonId('alphamon-ouryuken-supremacy')?.variant).toBe('Supremacy')
    expect(rankAuditByDigimonId('omegamon-x-supremacy')?.variant).toBe('Supremacy')
    expect(rankAuditByCanonicalName('Alphamon: Ouryuken', 'Supremacy')).toBe(rankAuditByDigimonId('alphamon-ouryuken-supremacy'))
  })

  it('requires official dated sources for every confirmed rank claim', () => {
    for (const entry of dUnitDigimonRankAudit) {
      expect(entry.identityStatus).toBe('confirmed')
      expect(entry.rankStatus).toBe('confirmed')
      expect(entry.sources.length).toBeGreaterThan(0)
      expect(entry.sources.every(source => source.sourceType === 'official' && /^https:\/\//.test(source.url) && /^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt) && source.context.length > 0)).toBe(true)
    }
  })

  it('keeps incomplete pilot sets operationally unknown', () => {
    const operationalIds = new Set(operationalPilotSets().map(set => set.setId))
    for (const set of dUnitPilotSetRankAudit.filter(set => set.compositionStatus !== 'confirmed' || set.rankStatus !== 'confirmed')) {
      expect(operationalIds.has(set.setId)).toBe(false)
      expect(metadataForDUnitSet(set.setId)).toEqual([])
    }
  })

  it('never operationalizes a probable composition or rank', () => {
    const confirmed = dUnitPilotSetRankAudit.find(set => set.setId === 'dunit-273')!
    expect(isOperationalPilotSet({ ...confirmed, compositionStatus: 'probable', rankStatus: 'unknown' })).toBe(false)
  })

  it('exposes only complete confirmed sets to the engine', () => {
    expect(metadataForDUnitSet('dunit-273').map(entry => entry.digimonId)).toEqual(['alphamon-ouryuken-supremacy', 'omegamon-x-supremacy'])
    expect(metadataForDUnitSet('dunit-273').every(entry => entry.tier === 'u' && entry.source.includes('gameking.com'))).toBe(true)
    expect(metadataForDUnitSet('dunit-251')).toHaveLength(1)
    expect(dUnitCostMetadata.every(entry => entry.confirmed)).toBe(true)
  })
})
