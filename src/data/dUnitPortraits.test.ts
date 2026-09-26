import { describe, expect, it } from 'vitest'
import { dUnitSets } from './dUnitAudit'
import { dUnitPortraits, portraitsForDUnitSet } from './dUnitPortraits'

const allPortraitPaths = Object.values(dUnitPortraits).flat()
const fileNameFromUrl = (url: string) => decodeURIComponent(url.split('/').slice(-1)[0] ?? '')

describe('D-Unit portraits', () => {
  it('keeps the four visually approved proof crops mapped and unchanged in count', () => {
    expect(portraitsForDUnitSet('dunit-251')).toHaveLength(1)
    expect(portraitsForDUnitSet('dunit-188')).toHaveLength(5)
    expect(portraitsForDUnitSet('dunit-230')).toHaveLength(13)
    expect(portraitsForDUnitSet('dunit-253')).toHaveLength(15)
  })

  it('maps every audited set by its stable id, including the backtick source collisions', () => {
    const auditedIds = dUnitSets.map(set => set.id).sort()
    expect(Object.keys(dUnitPortraits).sort()).toEqual(auditedIds)
    expect(dUnitPortraits['dunit-275']).not.toEqual(dUnitPortraits['dunit-275-source-backtick'])
    expect(dUnitPortraits['dunit-276']).not.toEqual(dUnitPortraits['dunit-276-source-backtick'])
    expect(dUnitPortraits['dunit-185-source-backtick']).toHaveLength(4)
    expect(dUnitPortraits['dunit-213-source-backtick']).toHaveLength(21)
  })

  it('uses non-empty ordered arrays with no accidental duplicate asset path', () => {
    expect(Object.values(dUnitPortraits).every(portraits => portraits.length > 0)).toBe(true)
    expect(new Set(allPortraitPaths).size).toBe(allPortraitPaths.length)
    for (const [setId, portraits] of Object.entries(dUnitPortraits)) {
      expect(portraits.map(fileNameFromUrl)).toEqual(
        portraits.map((_, index) => `${setId}-${String(index + 1).padStart(2, '0')}.png`),
      )
    }
  })

  it('references only generated portrait PNG paths, never complete source screenshots', () => {
    for (const path of allPortraitPaths) {
      expect(path).toContain('/portraits/')
      expect(fileNameFromUrl(path)).toMatch(/^dunit-[a-z0-9-]+-\d{2}\.png$/)
    }
  })
})
