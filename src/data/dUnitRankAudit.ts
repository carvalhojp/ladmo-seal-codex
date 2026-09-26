/**
 * Source-backed pilot for D-Unit access/rank metadata.
 *
 * This is intentionally independent from dUnitAudit.ts: that file is the
 * immutable transcription of in-game D-Unit conditions and does not assert a
 * canonical Digimon identity for every condition.  An entry here becomes
 * operational only when both the set composition and every required rank are
 * confirmed by primary sources.
 */
export type DUnitRankTier = 'basic' | 'intermediate' | 'advanced' | 'sss' | 'sss_plus' | 'u' | 'unknown'
export type DUnitAuditStatus = 'confirmed' | 'probable' | 'unknown'

export type DUnitRankSource = {
  url: string
  title: string
  publishedAt: string
  accessedAt: string
  sourceType: 'official'
  context: string
}

export type DUnitDigimonRankAudit = {
  digimonId: string
  canonicalName: string
  variant: string
  identityStatus: 'confirmed'
  rankStatus: DUnitAuditStatus
  officialRank: 'U' | null
  costTier: DUnitRankTier
  sources: readonly DUnitRankSource[]
}

export type DUnitPilotSetRankAudit = {
  setId: string
  setName: string
  requiredDigimonCount: number
  digimonIds: readonly string[]
  compositionStatus: DUnitAuditStatus
  rankStatus: DUnitAuditStatus
  note: string
}

const accessedAt = '2026-09-17'

export const dUnitRankSources = {
  alphamonSupremacy: {
    url: 'https://ptladmo.gameking.com/News/EventView.aspx?idx=163',
    title: 'Notas de Atualização 12.06.2025',
    publishedAt: '2025-06-12',
    accessedAt,
    sourceType: 'official' as const,
    context: 'A atualização identifica [Supremacia] Alphamon: Ouryuken, informa Rank U e lista a composição do D-Unit Capítulo 1: Reencontro.',
  },
  omegamonSupremacy: {
    url: 'https://ptladmo.gameking.com/News/EventView.aspx?idx=204',
    title: 'Nota de Atualização 17.03.2026',
    publishedAt: '2026-03-17',
    accessedAt,
    sourceType: 'official' as const,
    context: 'A atualização identifica Omegamon X [Supremacia] como Rank U e lista Reencontro: Supremacia com ele e [Supremacia] Alphamon Ouryuken.',
  },
  quantumon: {
    url: 'https://ptladmo.gameking.com/News/EventView.aspx?idx=214',
    title: 'Nota de Atualização 21.05.2026',
    publishedAt: '2026-05-21',
    accessedAt,
    sourceType: 'official' as const,
    context: 'A atualização identifica Quantumon como Rank U e inclui o grupo D-Unit Quantumon, composto apenas por Quantumon.',
  },
} satisfies Record<string, DUnitRankSource>

/** Canonical records: variants deliberately receive distinct immutable IDs. */
export const dUnitDigimonRankAudit: readonly DUnitDigimonRankAudit[] = [
  {
    digimonId: 'alphamon-ouryuken-supremacy', canonicalName: 'Alphamon: Ouryuken', variant: 'Supremacy',
    identityStatus: 'confirmed', rankStatus: 'confirmed', officialRank: 'U', costTier: 'u', sources: [dUnitRankSources.alphamonSupremacy],
  },
  {
    digimonId: 'omegamon-x-supremacy', canonicalName: 'Omegamon X', variant: 'Supremacy',
    identityStatus: 'confirmed', rankStatus: 'confirmed', officialRank: 'U', costTier: 'u', sources: [dUnitRankSources.omegamonSupremacy],
  },
  {
    digimonId: 'quantumon', canonicalName: 'Quantumon', variant: '',
    identityStatus: 'confirmed', rankStatus: 'confirmed', officialRank: 'U', costTier: 'u', sources: [dUnitRankSources.quantumon],
  },
] as const

/**
 * Pilot scope. Empty identities are an explicit unknown, never a guess based
 * on a portrait, set title, lore, or an equivalent Digimon in another game.
 */
export const dUnitPilotSetRankAudit: readonly DUnitPilotSetRankAudit[] = [
  { setId: 'dunit-273', setName: 'Reencontro: Supremacia', requiredDigimonCount: 2, digimonIds: ['alphamon-ouryuken-supremacy', 'omegamon-x-supremacy'], compositionStatus: 'confirmed', rankStatus: 'confirmed', note: 'Both members and their U ranks are confirmed by official LADMO patch notes.' },
  { setId: 'dunit-34', setName: 'Tentomon', requiredDigimonCount: 5, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-148', setName: 'Ghost Game', requiredDigimonCount: 3, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-220', setName: 'Legião dos Anjos', requiredDigimonCount: 4, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-201', setName: 'OMEGA : VI', requiredDigimonCount: 2, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-267', setName: '4 Grandes Dragões Poder Divino', requiredDigimonCount: 4, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-247', setName: 'Eosmon (Adulto)', requiredDigimonCount: 3, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-271', setName: 'Fim da aventura', requiredDigimonCount: 2, digimonIds: [], compositionStatus: 'unknown', rankStatus: 'unknown', note: 'No direct ordered composition/rank source was confirmed in this pilot.' },
  { setId: 'dunit-251', setName: 'Quantumon', requiredDigimonCount: 1, digimonIds: ['quantumon'], compositionStatus: 'confirmed', rankStatus: 'confirmed', note: 'Single-member direct verification set used to validate the operational path.' },
] as const

export const rankAuditByDigimonId = (digimonId: string) => dUnitDigimonRankAudit.find(entry => entry.digimonId === digimonId)
export const rankAuditByCanonicalName = (canonicalName: string, variant = '') => dUnitDigimonRankAudit.find(entry => entry.canonicalName === canonicalName && entry.variant === variant)

/** Only complete, source-backed sets may influence the cost engine. */
export const isOperationalPilotSet = (set: DUnitPilotSetRankAudit) => {
  if (set.compositionStatus !== 'confirmed' || set.rankStatus !== 'confirmed' || set.digimonIds.length !== set.requiredDigimonCount) return false
  return set.digimonIds.every(id => {
    const rank = rankAuditByDigimonId(id)
    return rank?.identityStatus === 'confirmed' && rank.rankStatus === 'confirmed' && rank.costTier !== 'unknown' && rank.sources.length > 0
  })
}

export const operationalPilotSets = () => dUnitPilotSetRankAudit.filter(isOperationalPilotSet)
