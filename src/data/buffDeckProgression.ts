import mainAdventureImage from '../assets/buff-decks/main-adventure.png'
import finalExplosionWingsImage from '../assets/buff-decks/final-explosion-wings.png'
import legendaryKnightsImage from '../assets/buff-decks/legendary-knights-vaccine.png'
import d5DigixrossImage from '../assets/buff-decks/d5-digixross-mega.png'
import divineLanceImage from '../assets/buff-decks/divine-lance-light-sword.png'
import futureKingImage from '../assets/buff-decks/future-digimon-king.png'
import purificationRitualImage from '../assets/buff-decks/corrupted-purification-ritual.png'
import demonEndImage from '../assets/buff-decks/demon-of-the-end.png'

export type BuffDeckStage = 'start' | 'intermediate' | 'rankU'

export interface BuffDeckEffect {
  id: string
  permanent: boolean
  condition?: 'normalAttackChance30' | 'normalAttack3' | 'normalAttackChance20'
  duration?: 'seconds7' | 'seconds10'
}

export interface BuffDeck {
  id: string
  stage: BuffDeckStage
  image: string
  effects: BuffDeckEffect[]
  rank?: 'SSS' | 'U'
  associatedDigimon?: string[]
  requirements?: string[]
}

export const buffDecks: BuffDeck[] = [
  {
    id: 'mainAdventure',
    stage: 'start',
    image: mainAdventureImage,
    effects: [{ id: 'attackSpeed8', permanent: true }],
  },
  {
    id: 'finalExplosionWings',
    stage: 'start',
    image: finalExplosionWingsImage,
    effects: [{ id: 'attackSpeed15', permanent: true }],
  },
  {
    id: 'legendaryKnightsVaccine',
    stage: 'intermediate',
    image: legendaryKnightsImage,
    rank: 'SSS',
    effects: [
      { id: 'attackSpeed15', permanent: true },
      { id: 'health15', permanent: true },
      { id: 'attack20', permanent: false, condition: 'normalAttackChance30', duration: 'seconds7' },
    ],
  },
  {
    id: 'd5DigixrossMega',
    stage: 'intermediate',
    image: d5DigixrossImage,
    requirements: ['d5DigixrossMegaRequirements'],
    effects: [
      { id: 'skillDamage15', permanent: true },
      { id: 'criticalDamage100', permanent: false, condition: 'normalAttack3', duration: 'seconds10' },
      { id: 'attackSpeed15', permanent: true },
    ],
  },
  {
    id: 'divineLanceLightSword',
    stage: 'rankU',
    image: divineLanceImage,
    rank: 'U',
    associatedDigimon: ['Gallantmon Crimson Mode Awakening'],
    effects: [
      { id: 'attackSpeed20', permanent: true },
      { id: 'skillDamage80', permanent: true },
      { id: 'skillDamage50', permanent: false, condition: 'normalAttackChance20', duration: 'seconds10' },
    ],
  },
  {
    id: 'futureDigimonKing',
    stage: 'rankU',
    image: futureKingImage,
    rank: 'U',
    associatedDigimon: ['Shoutmon X7 Superior Mode', 'Shoutmon X7 SM'],
    effects: [
      { id: 'attackSpeed18', permanent: true },
      { id: 'skillDamage70', permanent: true },
      { id: 'health40', permanent: true },
    ],
  },
  {
    id: 'corruptedPurificationRitual',
    stage: 'rankU',
    image: purificationRitualImage,
    rank: 'U',
    associatedDigimon: ['Kuzuhamon Miko Mode'],
    effects: [
      { id: 'attackSpeed18', permanent: true },
      { id: 'health40', permanent: true },
      { id: 'attributeDamage5', permanent: true },
    ],
  },
  {
    id: 'demonOfTheEnd',
    stage: 'rankU',
    image: demonEndImage,
    rank: 'U',
    associatedDigimon: ['DoneDevimon'],
    effects: [
      { id: 'attackSpeed18', permanent: true },
      { id: 'skillDamage100', permanent: true },
      { id: 'criticalDamage100', permanent: true },
    ],
  },
]

export const buffDecksByStage = (stage: BuffDeckStage) => buffDecks.filter(deck => deck.stage === stage)
