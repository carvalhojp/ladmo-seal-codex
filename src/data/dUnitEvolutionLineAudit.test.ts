import { describe, expect, it } from 'vitest'
import { dUnitEvolutionLineAudit, dUnitSetEvolutionLineProfiles, evolutionLineForDigimon, evolutionLineProfileForSet, evolutionLineTier } from './dUnitEvolutionLineAudit'

describe('D-Unit evolution-line audit', () => {
  it('keeps every confirmed operational line uniquely identified and sourced', () => {
    expect(new Set(dUnitEvolutionLineAudit.map(line => line.evolutionLineId)).size).toBe(dUnitEvolutionLineAudit.length)
    for (const line of dUnitEvolutionLineAudit) {
      expect(line.status).toBe('confirmed')
      expect(line.sources.length).toBeGreaterThan(0)
      expect(line.sources.every(source => source.url.startsWith('https://ptladmo.gameking.com/'))).toBe(true)
    }
  })

  it('does not collapse the confirmed Supremacy variants into one evolution line', () => {
    const alphamon = evolutionLineForDigimon('alphamon-ouryuken-supremacy')
    const omegamon = evolutionLineForDigimon('omegamon-x-supremacy')
    expect(alphamon?.evolutionLineId).not.toBe(omegamon?.evolutionLineId)
    expect(evolutionLineTier(alphamon!.evolutionLineId)).toBe('u')
    expect(evolutionLineTier(omegamon!.evolutionLineId)).toBe('u')
  })

  it('models the confirmed Reunion set as two lines while preserving unknown sets as unresolved', () => {
    const reunion = evolutionLineProfileForSet('dunit-273')!
    const tentomon = evolutionLineProfileForSet('dunit-34')!
    expect(reunion.evolutionLineIds).toHaveLength(2)
    expect(reunion.unknownLineCount).toBe(0)
    expect(tentomon.evolutionLineIds).toEqual([])
    expect(tentomon.unknownLineCount).toBeNull()
    expect(dUnitSetEvolutionLineProfiles).toContain(reunion)
  })
})
