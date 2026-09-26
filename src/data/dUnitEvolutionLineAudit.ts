import type { DUnitDigimonCostTier } from './dUnitCostMetadata'
import { dUnitDigimonRankAudit, dUnitRankSources, type DUnitAuditStatus, type DUnitRankSource } from './dUnitRankAudit'

/** Canonical, source-backed evolution-line audit kept separate from D-Unit conditions. */
export type DUnitEvolutionLineAudit = {
  evolutionLineId: string
  digimonIds: readonly string[]
  status: 'confirmed'
  sources: readonly DUnitRankSource[]
  note: string
}

export type DUnitSetEvolutionLineProfile = {
  setId: string
  evolutionLineIds: readonly string[]
  /** null means that neither the number nor identity of missing lines is safe to infer. */
  unknownLineCount: number | null
  confidence: DUnitAuditStatus
  note: string
}

export const dUnitEvolutionLineAudit: readonly DUnitEvolutionLineAudit[] = [
  {
    evolutionLineId: 'alphamon-ouryuken-supremacy-line', digimonIds: ['alphamon-ouryuken-supremacy'], status: 'confirmed',
    sources: [dUnitRankSources.alphamonSupremacy],
    note: 'Official LADMO evolution tree identifies the Dorumon [Raptordramon] / Ryudamon Jogress path through [Supremacia] Alphamon: Ouryuken.',
  },
  {
    evolutionLineId: 'omegamon-x-supremacy-line', digimonIds: ['omegamon-x-supremacy'], status: 'confirmed',
    sources: [dUnitRankSources.omegamonSupremacy],
    note: 'Official LADMO evolution tree identifies the Agumon / Gabumon Resistance Jogress path through Omegamon X [Supremacia].',
  },
  {
    evolutionLineId: 'quantumon-line', digimonIds: ['quantumon'], status: 'confirmed',
    sources: [dUnitRankSources.quantumon],
    note: 'Official LADMO source identifies Quantumon as a single Mega evolution entry.',
  },
] as const

/** Pilot profiles; unknown is explicit and keeps the engine on its conservative legacy access estimate. */
export const dUnitSetEvolutionLineProfiles: readonly DUnitSetEvolutionLineProfile[] = [
  { setId: 'dunit-273', evolutionLineIds: ['alphamon-ouryuken-supremacy-line', 'omegamon-x-supremacy-line'], unknownLineCount: 0, confidence: 'confirmed', note: 'Both required paths are confirmed.' },
  { setId: 'dunit-251', evolutionLineIds: ['quantumon-line'], unknownLineCount: 0, confidence: 'confirmed', note: 'Single confirmed path.' },
  { setId: 'dunit-260', evolutionLineIds: ['alphamon-ouryuken-supremacy-line'], unknownLineCount: null, confidence: 'probable', note: 'The confirmed Supremacy Alphamon path is shared; the remaining Omegamon path has no line audit in this pilot.' },
  { setId: 'dunit-34', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'Tentomon composition/lines await direct official evidence.' },
  { setId: 'dunit-37', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'Kunemon composition/lines await direct official evidence.' },
  { setId: 'dunit-148', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'Ghost Game composition/lines await direct official evidence.' },
  { setId: 'dunit-201', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'OMEGA : VI composition/lines await direct official evidence.' },
  { setId: 'dunit-220', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'Legião dos Anjos composition/lines await direct official evidence.' },
  { setId: 'dunit-247', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'Eosmon (Adulto) composition/lines await direct official evidence.' },
  { setId: 'dunit-267', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: '4 Grandes Dragões Poder Divino composition/lines await direct official evidence.' },
  { setId: 'dunit-271', evolutionLineIds: [], unknownLineCount: null, confidence: 'unknown', note: 'Fim da aventura composition/lines await direct official evidence.' },
] as const

export const evolutionLineForDigimon = (digimonId: string) => dUnitEvolutionLineAudit.find(line => line.digimonIds.includes(digimonId))
export const evolutionLineProfileForSet = (setId: string, profiles = dUnitSetEvolutionLineProfiles) => profiles.find(profile => profile.setId === setId)
export const evolutionLineTier = (lineId: string): DUnitDigimonCostTier => {
  const line = dUnitEvolutionLineAudit.find(entry => entry.evolutionLineId === lineId)
  const tiers = line?.digimonIds.map(id => dUnitDigimonRankAudit.find(entry => entry.digimonId === id)?.costTier ?? 'unknown') ?? []
  const order: DUnitDigimonCostTier[] = ['basic', 'intermediate', 'advanced', 'sss', 'sss_plus', 'u']
  return tiers.sort((left, right) => order.indexOf(right) - order.indexOf(left))[0] ?? 'unknown'
}
