import { describe, expect, it } from 'vitest'
import { seals } from './seals'
import { localizedSealName, matchesLocalizedSealName } from './localizedSealNames'
import { matchesAcquisitionFilter } from './acquisitionSources'

const guilmon = seals.find(seal => seal.id === 'seal-17712')!
const renamon = seals.find(seal => seal.id === 'seal-22415')!
const fallback = seals.find(seal => seal.id === 'seal-16382')!

describe('localized Seal names', () => {
  it('uses a confirmed Korean name without changing the canonical name or ID', () => {
    expect(localizedSealName(guilmon, 'ko')).toBe('길몬')
    expect(guilmon.name).toBe('Guilmon')
    expect(guilmon.id).toBe('seal-17712')
    expect(localizedSealName(guilmon, 'pt')).toBe('Guilmon')
  })

  it('falls back safely to the canonical name when a Korean name is not confirmed', () => {
    expect(localizedSealName(fallback, 'ko')).toBe(fallback.name)
  })

  it('finds localized and canonical names while Korean is active', () => {
    expect(matchesLocalizedSealName(guilmon, '길몬', 'ko')).toBe(true)
    expect(matchesLocalizedSealName(guilmon, 'Guilmon', 'ko')).toBe(true)
    expect(matchesLocalizedSealName(renamon, '레나몬', 'ko')).toBe(true)
    expect(matchesLocalizedSealName(renamon, 'Guilmon', 'ko')).toBe(false)
  })

  it('keeps Korean search compatible with attribute and source filtering', () => {
    expect(renamon.attribute).toBe('DE')
    expect(matchesLocalizedSealName(renamon, '레나몬', 'ko')).toBe(true)
    expect(matchesAcquisitionFilter(renamon.name, 'map')).toBe(true)
    expect(matchesAcquisitionFilter(renamon.name, 'shinjuku')).toBe(true)
  })
})
