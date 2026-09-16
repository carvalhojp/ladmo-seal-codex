import { describe, expect, it } from 'vitest'
import { buffDecks, buffDecksByStage } from './buffDeckProgression'
import { buffDeckCopy } from './buffDeckCopy'

describe('Buff Deck progression data', () => {
  it('contains the eight requested decks in their progression stages', () => {
    expect(buffDecks).toHaveLength(8)
    expect(buffDecksByStage('start').map(deck => deck.id)).toEqual(['mainAdventure', 'finalExplosionWings'])
    expect(buffDecksByStage('intermediate').map(deck => deck.id)).toEqual(['legendaryKnightsVaccine', 'd5DigixrossMega'])
    expect(buffDecksByStage('rankU')).toHaveLength(4)
  })

  it('keeps the official effects and conditions supplied for the decks', () => {
    const legendary = buffDecks.find(deck => deck.id === 'legendaryKnightsVaccine')!
    const d5 = buffDecks.find(deck => deck.id === 'd5DigixrossMega')!
    const divine = buffDecks.find(deck => deck.id === 'divineLanceLightSword')!
    expect(legendary.effects.map(effect => effect.id)).toEqual(['attackSpeed15', 'health15', 'attack20'])
    expect(legendary.effects[2]).toMatchObject({ condition: 'normalAttackChance30', duration: 'seconds7' })
    expect(d5.effects[1]).toMatchObject({ id: 'criticalDamage100', condition: 'normalAttack3', duration: 'seconds10' })
    expect(divine.effects[2]).toMatchObject({ id: 'skillDamage50', condition: 'normalAttackChance20', duration: 'seconds10' })
  })

  it('keeps D5 and DigiXross Mega restricted to DarknessBagramon and Shoutmon X7 at SSS+', () => {
    const d5 = buffDecks.find(deck => deck.id === 'd5DigixrossMega')!
    expect(d5.requirements).toEqual(['d5DigixrossMegaRequirements'])
    for (const language of ['pt', 'en', 'es', 'ko'] as const) {
      const requirement = buffDeckCopy[language].d5DigixrossMegaRequirements
      expect(requirement).toContain('SSS+')
      expect(requirement).toContain('DarknessBagramon')
      expect(requirement).toContain('Shoutmon X7')
    }
  })

  it('uses a supplied composition image for every deck', () => {
    expect(buffDecks.every(deck => deck.image.endsWith('.png'))).toBe(true)
  })
})

describe('Buff Deck translations', () => {
  it('provides a complete, non-empty deck page in every supported language', () => {
    const expected = Object.keys(buffDeckCopy.pt).sort()
    for (const language of ['en', 'es', 'ko'] as const) expect(Object.keys(buffDeckCopy[language]).sort()).toEqual(expected)
    for (const language of ['pt', 'en', 'es', 'ko'] as const) {
      const copy = buffDeckCopy[language]
      expect(Object.values(copy).every(Boolean)).toBe(true)
      expect(copy.normalAttackChance30).not.toContain('30 attacks')
    }
  })

  it('uses a localized title for all eight cards in every language', () => {
    const deckNameKeys = [
      'mainAdventureName', 'finalExplosionWingsName', 'legendaryKnightsVaccineName', 'd5DigixrossMegaName',
      'divineLanceLightSwordName', 'futureDigimonKingName', 'corruptedPurificationRitualName', 'demonOfTheEndName',
    ] as const
    const portugueseNames = deckNameKeys.map(key => buffDeckCopy.pt[key])
    for (const language of ['pt', 'en', 'es', 'ko'] as const) {
      const names = deckNameKeys.map(key => buffDeckCopy[language][key])
      expect(names).toHaveLength(8)
      expect(names.every(Boolean)).toBe(true)
    }
    expect(buffDeckCopy.en.mainAdventureName).not.toBe(portugueseNames[0])
    expect(buffDeckCopy.es.finalExplosionWingsName).not.toBe(portugueseNames[1])
    expect(buffDeckCopy.ko.mainAdventureName).not.toBe(portugueseNames[0])
    expect(buffDeckCopy.ko.finalExplosionWingsName).not.toBe(portugueseNames[1])
  })
})
