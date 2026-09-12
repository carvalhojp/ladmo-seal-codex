import type { Attribute, ProgressionThresholds, Seal } from '../types'
import { defaultProgression } from '../types'

/** Explicit, data-layer-only progression exceptions. No seal records are created here. */
const alternate: ProgressionThresholds = { normal: 1, bronze: 30, silver: 150, gold: 300, platinum: 500, master: 700 }
const overrides: ReadonlyArray<{ name: string; attribute: Attribute; progression: ProgressionThresholds }> = [
  { name: 'Lucemon', attribute: 'CT', progression: alternate },
  { name: 'Reppamon', attribute: 'EV', progression: alternate },
  { name: 'Labramon', attribute: 'DE', progression: alternate },
]

export const progressionForIdentity = (name: string, attribute: Attribute): ProgressionThresholds =>
  overrides.find(item => item.name === name && item.attribute === attribute)?.progression ?? defaultProgression

export const progressionForSeal = (seal: Seal): ProgressionThresholds =>
  seal.progression ?? progressionForIdentity(seal.name, seal.attribute)
