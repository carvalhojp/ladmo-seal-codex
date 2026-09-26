import { describe, expect, it } from 'vitest'
import { identitiesForDUnitSet } from './dUnitPortraitIdentityAudit'

describe('D-Unit portrait identity audit — EXP routes', () => {
  it.each([
    ['dunit-34', ['tentomon', 'kabuterimon', 'megakabuterimon', 'herculeskabuterimon', 'tyrantkabuterimon']],
    ['dunit-41', ['guilmon-chaosgallantmon', 'growlmon', 'wargrowlmon', 'chaosgallantmon', 'megidramon']],
    ['dunit-96', ['lopmon', 'wendigomon', 'antylamon', 'cherubimon-virus', 'turuiemon', 'antylamon-deva', 'cherubimon-white']],
    ['dunit-159', ['goburimon', 'ogremon', 'etemon', 'metaletemon', 'kingetemon']],
  ])('uses the user-approved ordered visual identities for %s', (setId, digimonIds) => {
    const identities = identitiesForDUnitSet(setId)
    expect(identities.map(identity => identity.digimonId)).toEqual(digimonIds)
    expect(identities.map(identity => identity.portraitIndex)).toEqual(digimonIds.map((_, index) => index + 1))
    expect(identities.every(identity => identity.identityStatus === 'confirmed')).toBe(true)
    expect(identities.every(identity => identity.evolutionStatus === 'unknown' && identity.rankStatus === 'unknown' && identity.unlockStatus === 'unknown')).toBe(true)
  })

  it('keeps the established Goburimon storage id while honoring the manual Goblimon display correction', () => {
    expect(identitiesForDUnitSet('dunit-159')[0]).toMatchObject({ digimonId: 'goburimon', canonicalName: 'Goblimon' })
  })
})
