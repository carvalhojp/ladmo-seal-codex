import type { DUnitAuditStatus, DUnitRankSource } from './dUnitRankAudit'

/**
 * Research layer for portrait identities already approved by the player.
 * It is intentionally not a source of planner cost: only a confirmed
 * evolutionLineId may become reusable player work in a later audit.
 */
export type DUnitPortraitProgressionAudit = {
  setId: string
  portraitIndex: number
  digimonId: string
  evolutionLineId?: string
  baseDigimonId?: string
  previousDigimonId?: string
  alternativeEvolutionIds?: readonly string[]
  relationship?: 'base' | 'same_line' | 'alternative' | 'independent'
  alternativeEvolution?: boolean
  evolutionStatus: DUnitAuditStatus
  rankStatus: DUnitAuditStatus
  obtainmentStatus: DUnitAuditStatus
  availability: 'current_confirmed' | 'historical_only' | 'external_version_only' | 'unknown'
  obtainmentMethod?: string
  unlockStatus: DUnitAuditStatus
  unlockRequirement?: string
  sources: readonly DUnitRankSource[]
  note: string
}

const official = (url: string, title: string, publishedAt: string, context: string): DUnitRankSource => ({ url, title, publishedAt, accessedAt: '2026-09-20', sourceType: 'official', context })

const incubator153 = official(
  'https://ptladmo.gameking.com/News/EventView.aspx?cpage=2&idx=153',
  'Calendário de caixas de incubação Lv.4~5', '2025-04-03',
  'A notícia LADMO lista caixas de incubação para Tentomon, Lopmon, Guilmon [ChaosGallantmon] e Goburimon. É disponibilidade histórica, não confirmação de disponibilidade atual, de linha ou de desbloqueio.',
)
const guilmon126 = official(
  'https://ptladmo.gameking.com/News/EventView.aspx?idx=126&page=1',
  'Notas de Atualização em 22.08.2024', '2024-08-22',
  'A atualização LADMO documenta a linha normal Guilmon → Growlmon → WarGrowlmon → Gallantmon e o item Super Fusão: Híbrida para Gallantmon Modo Crimson (Shin). Ela não comprova que os retratos de ChaosGallantmon/Megidramon são a mesma linha jogável.',
)
const goblimon151 = official(
  'https://ptladmo.gameking.com/News/EventView.aspx?idx=151',
  'Atualização LADMO — tabela de monstros', '2025-03-20',
  'A tabela registra Goblimon e Ogremon como monstros de mapa. Ela não documenta a obtenção de DigiEgg, disponibilidade de mercenário ou desbloqueios.',
)

const unknown = (setId: string, portraitIndex: number, digimonId: string): DUnitPortraitProgressionAudit => ({
  setId, portraitIndex, digimonId, evolutionStatus: 'unknown', rankStatus: 'unknown', obtainmentStatus: 'unknown', availability: 'unknown', unlockStatus: 'unknown', sources: [],
  note: 'Identidade visual foi aprovada manualmente; linha LADMO, rank, obtenção e desbloqueio ainda não têm evidência auditada.',
})

/** Player-confirmed line relations are usable for work sharing, never for cost. */
const confirmedLine = (entry: DUnitPortraitProgressionAudit, relationship: NonNullable<DUnitPortraitProgressionAudit['relationship']>, evolutionLineId: string, baseDigimonId: string, previousDigimonId?: string, alternativeEvolution = false): DUnitPortraitProgressionAudit => ({
  ...entry, relationship, evolutionLineId, baseDigimonId,
  ...(previousDigimonId ? { previousDigimonId } : {}),
  ...(alternativeEvolution ? { alternativeEvolution: true } : {}),
  evolutionStatus: 'confirmed',
  note: `${entry.note} Relação de linha jogável confirmada manualmente em dunit-evolution-lines-manual-confirmation.json (2026-09-20); não confirma obtenção, rank, custo ou desbloqueio.`,
})

export const dUnitPortraitProgressionAudit: readonly DUnitPortraitProgressionAudit[] = [
  confirmedLine({ ...unknown('dunit-34', 1, 'tentomon'), obtainmentStatus: 'probable', availability: 'historical_only', obtainmentMethod: 'Caixa de incubação Lv.4~5 (evento histórico)', sources: [incubator153], note: 'A caixa histórica do LADMO confirma a presença de Tentomon no período da notícia, mas não sua disponibilidade atual.' }, 'base', 'tentomon-line', 'tentomon'),
  confirmedLine(unknown('dunit-34', 2, 'kabuterimon'), 'same_line', 'tentomon-line', 'tentomon', 'tentomon'),
  confirmedLine(unknown('dunit-34', 3, 'megakabuterimon'), 'same_line', 'tentomon-line', 'tentomon', 'kabuterimon'),
  confirmedLine(unknown('dunit-34', 4, 'herculeskabuterimon'), 'same_line', 'tentomon-line', 'tentomon', 'megakabuterimon'),
  confirmedLine(unknown('dunit-34', 5, 'tyrantkabuterimon'), 'same_line', 'tentomon-line', 'tentomon', 'herculeskabuterimon'),
  confirmedLine({ ...unknown('dunit-41', 1, 'guilmon-chaosgallantmon'), obtainmentStatus: 'probable', availability: 'historical_only', obtainmentMethod: 'Caixa de incubação Lv.4~5 (evento histórico)', sources: [incubator153], note: 'A notícia confirma a caixa histórica de Guilmon [ChaosGallantmon], sem confirmar disponibilidade atual, rank ou custos.' }, 'base', 'guilmon-line', 'guilmon-chaosgallantmon'),
  confirmedLine({ ...unknown('dunit-41', 2, 'growlmon'), sources: [guilmon126], note: 'A fonte LADMO documenta apenas a linha normal de Guilmon; a relação desta variante foi confirmada manualmente.' }, 'same_line', 'guilmon-line', 'guilmon-chaosgallantmon', 'guilmon-chaosgallantmon'),
  confirmedLine({ ...unknown('dunit-41', 3, 'wargrowlmon'), sources: [guilmon126], note: 'A fonte LADMO documenta apenas a linha normal de Guilmon; a relação desta variante foi confirmada manualmente.' }, 'same_line', 'guilmon-line', 'guilmon-chaosgallantmon', 'growlmon'),
  confirmedLine(unknown('dunit-41', 4, 'chaosgallantmon'), 'same_line', 'guilmon-line', 'guilmon-chaosgallantmon', 'wargrowlmon'),
  confirmedLine(unknown('dunit-41', 5, 'megidramon'), 'same_line', 'guilmon-line', 'guilmon-chaosgallantmon', 'chaosgallantmon'),
  confirmedLine({ ...unknown('dunit-96', 1, 'lopmon'), obtainmentStatus: 'probable', availability: 'historical_only', obtainmentMethod: 'Caixa de incubação Lv.4~5 (evento histórico)', sources: [incubator153], note: 'A caixa histórica LADMO confirma Lopmon no período publicado; não confirma disponibilidade atual, rank ou custos.' }, 'base', 'lopmon-line', 'lopmon'),
  confirmedLine(unknown('dunit-96', 2, 'wendigomon'), 'same_line', 'lopmon-line', 'lopmon', 'lopmon'),
  confirmedLine(unknown('dunit-96', 3, 'antylamon'), 'same_line', 'lopmon-line', 'lopmon', 'wendigomon'),
  confirmedLine(unknown('dunit-96', 4, 'cherubimon-virus'), 'same_line', 'lopmon-line', 'lopmon', 'antylamon'),
  confirmedLine(unknown('dunit-96', 5, 'turuiemon'), 'same_line', 'lopmon-line', 'lopmon', 'lopmon', true),
  confirmedLine(unknown('dunit-96', 6, 'antylamon-deva'), 'alternative', 'lopmon-line', 'lopmon', 'turuiemon', true),
  confirmedLine(unknown('dunit-96', 7, 'cherubimon-white'), 'alternative', 'lopmon-line', 'lopmon', 'antylamon-deva', true),
  confirmedLine({ ...unknown('dunit-159', 1, 'goburimon'), obtainmentStatus: 'probable', availability: 'historical_only', obtainmentMethod: 'Caixa de incubação Lv.4~5 (evento histórico)', sources: [incubator153], note: 'Nome exibido é Goblimon, mantendo o ID legado goburimon. A caixa é evidência histórica, não de obtenção atual.' }, 'base', 'goblimon-line', 'goburimon'),
  confirmedLine({ ...unknown('dunit-159', 2, 'ogremon'), sources: [goblimon151], note: 'A fonte LADMO documenta Ogremon como monstro de mapa, não como obtenção do mercenário.' }, 'same_line', 'goblimon-line', 'goburimon', 'goburimon'),
  confirmedLine(unknown('dunit-159', 3, 'etemon'), 'same_line', 'goblimon-line', 'goburimon', 'ogremon'),
  confirmedLine(unknown('dunit-159', 4, 'metaletemon'), 'same_line', 'goblimon-line', 'goburimon', 'etemon'),
  confirmedLine(unknown('dunit-159', 5, 'kingetemon'), 'same_line', 'goblimon-line', 'goburimon', 'metaletemon'),
]

export const progressionAuditForDUnitPortrait = (setId: string, portraitIndex: number) => dUnitPortraitProgressionAudit.find(entry => entry.setId === setId && entry.portraitIndex === portraitIndex)
export const progressionAuditForDigimon = (digimonId: string) => dUnitPortraitProgressionAudit.filter(entry => entry.digimonId === digimonId)
/** Only direct LADMO line confirmation may be consumed by future work-sharing logic. */
export const confirmedProgressionLines = () => dUnitPortraitProgressionAudit.filter(entry => entry.evolutionStatus === 'confirmed' && entry.evolutionLineId)
