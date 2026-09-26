import { describe, expect, it } from 'vitest'
import { dUnitPortraitProgressionAudit, confirmedProgressionLines, progressionAuditForDUnitPortrait } from './dUnitPortraitProgressionAudit'

describe('D-Unit portrait progression audit', () => {
  it('keeps one independent progression record for every manually approved EXP-route portrait', () => {
    expect(dUnitPortraitProgressionAudit).toHaveLength(22)
    expect(new Set(dUnitPortraitProgressionAudit.map(entry => `${entry.setId}:${entry.portraitIndex}`)).size).toBe(22)
  })

  it('records historical base availability without promoting it to current LADMO acquisition', () => {
    for (const [setId, index] of [['dunit-34', 1], ['dunit-41', 1], ['dunit-96', 1], ['dunit-159', 1]] as const) {
      expect(progressionAuditForDUnitPortrait(setId, index)).toMatchObject({ obtainmentStatus: 'probable', availability: 'historical_only', unlockStatus: 'unknown' })
    }
  })

  it('integrates the manually confirmed shared lines, including the Tentomon Burst Mode branch', () => {
    const lines = confirmedProgressionLines()
    expect(lines).toHaveLength(22)
    expect(lines.filter(entry => entry.evolutionLineId === 'tentomon-line')).toHaveLength(5)
    expect(lines.filter(entry => entry.evolutionLineId === 'guilmon-line')).toHaveLength(5)
    expect(lines.filter(entry => entry.evolutionLineId === 'lopmon-line')).toHaveLength(7)
    expect(lines.filter(entry => entry.evolutionLineId === 'goblimon-line')).toHaveLength(5)
    expect(progressionAuditForDUnitPortrait('dunit-34', 5)).toMatchObject({
      relationship: 'same_line', evolutionLineId: 'tentomon-line', baseDigimonId: 'tentomon', previousDigimonId: 'herculeskabuterimon', unlockStatus: 'unknown',
    })
  })

  it('preserves manual branches without treating them as separate lines or unlock costs', () => {
    expect(progressionAuditForDUnitPortrait('dunit-96', 5)).toMatchObject({
      relationship: 'same_line', evolutionLineId: 'lopmon-line', baseDigimonId: 'lopmon', previousDigimonId: 'lopmon', alternativeEvolution: true, unlockStatus: 'unknown',
    })
    expect(progressionAuditForDUnitPortrait('dunit-96', 6)).toMatchObject({ relationship: 'alternative', alternativeEvolution: true })
  })
})
