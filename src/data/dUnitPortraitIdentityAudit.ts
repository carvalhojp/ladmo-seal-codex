import { dUnitRankSources, type DUnitAuditStatus, type DUnitRankSource } from './dUnitRankAudit'

/** Identity, rank, evolution, unlock and obtainment are audited independently. */
export type DUnitPortraitIdentityAudit = {
  setId: string
  portraitIndex?: number
  digimonId?: string
  canonicalName?: string
  variant?: string
  evolutionLineId?: string
  rank?: 'U'
  identityStatus: DUnitAuditStatus
  evolutionStatus: DUnitAuditStatus
  rankStatus: DUnitAuditStatus
  obtainmentStatus: DUnitAuditStatus
  unlockStatus: DUnitAuditStatus
  sources: readonly DUnitRankSource[]
  note: string
}

const official = (url: string, title: string, context: string): DUnitRankSource => ({
  url, title, publishedAt: '2025-01-01', accessedAt: '2026-09-20', sourceType: 'official', context,
})
const identity = (setId: string, portraitIndex: number, digimonId: string, canonicalName: string, source: DUnitRankSource, variant = ''): DUnitPortraitIdentityAudit => ({
  setId, portraitIndex, digimonId, canonicalName, variant: variant || undefined,
  identityStatus: 'confirmed', evolutionStatus: 'unknown', rankStatus: 'unknown', obtainmentStatus: 'unknown', unlockStatus: 'unknown',
  sources: [source], note: 'A lista oficial ordenada confirma esta identidade e posição; linha, rank, obtenção e desbloqueio não foram inferidos.',
})

const source195 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=195', 'Nota de Atualização 15.01.2026 (Parte 1)', 'Listas oficiais ordenadas dos grupos Negamon e Destruição do Mundo Digital.')
const source160 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=160', 'Notas de Atualização 22.05.2025', 'Listas oficiais ordenadas dos grupos com Imperialdramon: Paladin Mode [Awakened].')
const source163 = dUnitRankSources.alphamonSupremacy
const source168 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=168', 'Digimon Masters — D-Unit group: Ten Warriors', 'A lista oficial ordenada de Dez Guerreiros começa com Lucemon: Satan Mode [Supremacy].')
const source172 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=172', 'Notas de Atualização 13.08.2025', 'Listas oficiais ordenadas de Última Evolução e Nosso Vínculo.')
const source184 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=184', 'Digimon Masters — D-Unit group: Wings of Sin', 'A lista oficial ordenada de Asas do Pecado começa com Lilithmon (Resistance) [Awakened].')
const source201 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=201', 'Nota de Atualização 26.02.2026', 'Listas oficiais ordenadas de Terror do Abismo, Fim da aventura e Força desconhecida.')
const source204 = dUnitRankSources.omegamonSupremacy
const source206 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=206', 'Nota de Atualização 26.03.2026', 'A lista oficial ordenada de Dungeon Masters contém DoneDevimon (Event) e Shoutmon X7: Superior Mode (Event).')
const source222 = official('https://ptladmo.gameking.com/News/EventView.aspx?idx=222', 'Nota de Atualização 16.07.2026', 'As listas oficiais ordenadas dos dois grupos começam com Apollomon.')
const source153 = official('https://ptladmo.gameking.com/News/EventView.aspx?cpage=2&idx=153', 'Calendário de caixas de incubação Lv.4~5', 'A publicação oficial LADMO lista caixas de incubação para Tentomon, Lopmon, Guilmon [ChaosGallantmon] e Goburimon; confirma disponibilidade histórica, não a composição do D-Unit nem a disponibilidade atual.')
const manualVisualReview = 'Confirmação/correção manual do usuário em dunit-exp-routes-manual-confirmation.json (2026-09-20). A decisão confirma somente a identidade visual daquela posição; linha, rank, obtenção e desbloqueio permanecem independentes e não auditados.'

export const dUnitPortraitIdentityAudit: readonly DUnitPortraitIdentityAudit[] = [
  { setId:'dunit-34', portraitIndex:1, digimonId:'tentomon', canonicalName:'Tentomon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'probable', unlockStatus:'unknown', sources:[source153], note:'O retrato 01 em D-Unit.zip/D-Unit/34.png coincide visualmente com Tentomon. A nota oficial LADMO confirma uma caixa de incubação Lv.4~5 de Tentomon, mas não documenta linha, rank, desbloqueio ou disponibilidade atual.' },
  { setId:'dunit-34', portraitIndex:2, digimonId:'kabuterimon', canonicalName:'Kabuterimon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-34', portraitIndex:3, digimonId:'megakabuterimon', canonicalName:'MegaKabuterimon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-34', portraitIndex:4, digimonId:'herculeskabuterimon', canonicalName:'HerculesKabuterimon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-34', portraitIndex:5, digimonId:'tyrantkabuterimon', canonicalName:'TyrantKabuterimon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-41', portraitIndex:1, digimonId:'guilmon-chaosgallantmon', canonicalName:'Guilmon', variant:'ChaosGallantmon line', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'probable', unlockStatus:'unknown', sources:[source153], note:'O retrato 01 em D-Unit.zip/D-Unit/41.png é visualmente identificável como Guilmon. A nota oficial LADMO lista Guilmon [ChaosGallantmon] em caixa Lv.4~5; ela não comprova as outras quatro posições, rank, linha, desbloqueio ou disponibilidade atual.' },
  { setId:'dunit-41', portraitIndex:2, digimonId:'growlmon', canonicalName:'Growlmon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-41', portraitIndex:3, digimonId:'wargrowlmon', canonicalName:'WarGrowlmon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-41', portraitIndex:4, digimonId:'chaosgallantmon', canonicalName:'ChaosGallantmon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-41', portraitIndex:5, digimonId:'megidramon', canonicalName:'Megidramon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-96', portraitIndex:1, digimonId:'lopmon', canonicalName:'Lopmon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'probable', unlockStatus:'unknown', sources:[source153], note:'O retrato 01 em D-Unit.zip/D-Unit/96.png coincide visualmente com Lopmon. A nota oficial LADMO confirma uma caixa de incubação Lv.4~5 de Lopmon, sem documentar linha, rank, desbloqueio ou disponibilidade atual.' },
  { setId:'dunit-96', portraitIndex:2, digimonId:'wendigomon', canonicalName:'Wendigomon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-96', portraitIndex:3, digimonId:'antylamon', canonicalName:'Antylamon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-96', portraitIndex:4, digimonId:'cherubimon-virus', canonicalName:'Cherubimon (Vírus)', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-96', portraitIndex:5, digimonId:'turuiemon', canonicalName:'Turuiemon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-96', portraitIndex:6, digimonId:'antylamon-deva', canonicalName:'Antylamon (Deva)', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-96', portraitIndex:7, digimonId:'cherubimon-white', canonicalName:'Cherubimon (White)', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-159', portraitIndex:1, digimonId:'goburimon', canonicalName:'Goblimon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'probable', unlockStatus:'unknown', sources:[source153], note:'O nome visível foi corrigido manualmente para Goblimon; o ID estável goburimon foi preservado para não afetar o progresso local. A nota oficial LADMO confirma uma caixa de incubação Lv.4~5, sem documentar linha, rank, desbloqueio ou disponibilidade atual.' },
  { setId:'dunit-159', portraitIndex:2, digimonId:'ogremon', canonicalName:'Ogremon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-159', portraitIndex:3, digimonId:'etemon', canonicalName:'Etemon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-159', portraitIndex:4, digimonId:'metaletemon', canonicalName:'MetalEtemon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-159', portraitIndex:5, digimonId:'kingetemon', canonicalName:'KingEtemon', identityStatus:'confirmed', evolutionStatus:'unknown', rankStatus:'unknown', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[], note:manualVisualReview },
  { setId:'dunit-251', portraitIndex:1, digimonId:'quantumon', canonicalName:'Quantumon', evolutionLineId:'quantumon-line', rank:'U', identityStatus:'confirmed', evolutionStatus:'confirmed', rankStatus:'confirmed', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[dUnitRankSources.quantumon], note:'Nota oficial LADMO confirma Quantumon, Rank U e a linha de evolução de membro único; não documenta farm, custo ou desbloqueio.' },
  { setId:'dunit-273', portraitIndex:1, digimonId:'alphamon-ouryuken-supremacy', canonicalName:'Alphamon: Ouryuken', variant:'Supremacy', evolutionLineId:'alphamon-ouryuken-supremacy-line', rank:'U', identityStatus:'confirmed', evolutionStatus:'confirmed', rankStatus:'confirmed', obtainmentStatus:'unknown', unlockStatus:'unknown', sources:[source204], note:'Lista oficial ordenada confirma posição, identidade e Rank U; custo e desbloqueio não foram auditados.' },
  identity('dunit-273', 2, 'omegamon-resistance-supremacy', 'Omegamon', source204, 'Resistance / Supremacy'),
  identity('dunit-250', 3, 'abbadomon', 'Abbadomon', source195),
  identity('dunit-258', 1, 'imperialdramon-paladin-mode-awakened', 'Imperialdramon: Paladin Mode', source160, 'Awakened'),
  identity('dunit-259', 1, 'imperialdramon-paladin-mode-awakened', 'Imperialdramon: Paladin Mode', source160, 'Awakened'),
  identity('dunit-260', 1, 'alphamon-ouryuken-supremacy', 'Alphamon: Ouryuken', source163, 'Supremacy'),
  identity('dunit-261', 1, 'alphamon-ouryuken-supremacy', 'Alphamon: Ouryuken', source163, 'Supremacy'),
  identity('dunit-262', 1, 'lucemon-satan-mode-supremacy', 'Lucemon: Satan Mode', source168, 'Supremacy'),
  identity('dunit-263', 1, 'lucemon-satan-mode-supremacy', 'Lucemon: Satan Mode', source168, 'Supremacy'),
  identity('dunit-264', 1, 'last-evolution-bonds', 'Last Evolution: Bonds', source172),
  identity('dunit-265', 1, 'last-evolution-bonds', 'Last Evolution: Bonds', source172),
  identity('dunit-268', 1, 'lilithmon-resistance-awakened', 'Lilithmon (Resistance)', source184, 'Awakened'),
  identity('dunit-269', 1, 'negamon', 'Negamon', source195),
  identity('dunit-270', 1, 'abbadomon', 'Abbadomon', source201),
  identity('dunit-270', 2, 'abbadomon-core', 'Abaddomon Core', source201),
  identity('dunit-271', 1, 'abbadomon-core', 'Abaddomon Core', source201),
  identity('dunit-272', 2, 'last-evolution-bonds', 'Last Evolution: Bonds', source201),
  identity('dunit-272', 3, 'last-evolution-bonds', 'Last Evolution: Bonds', source201),
  identity('dunit-272', 4, 'abbadomon', 'Abbadomon', source201),
  identity('dunit-274', 1, 'alphamon-ouryuken-supremacy', 'Alphamon: Ouryuken', source204, 'Supremacy'),
  identity('dunit-274', 2, 'omegamon-resistance-supremacy', 'Omegamon', source204, 'Resistance / Supremacy'),
  identity('dunit-274', 4, 'imperialdramon-paladin-mode-awakened', 'Imperialdramon: Paladin Mode', source204, 'Awakened'),
  identity('dunit-274', 5, 'bloomlordmon', 'Bloomlordmon', source204),
  identity('dunit-275', 1, 'apollomon', 'Apollomon', source222),
  identity('dunit-275-source-backtick', 3, 'donedevimon-event', 'DoneDevimon', source206, 'Event'),
  identity('dunit-275-source-backtick', 4, 'shoutmon-x7-superior-mode-event', 'Shoutmon X7: Superior Mode', source206, 'Event'),
  identity('dunit-276', 1, 'apollomon', 'Apollomon', source222),
  identity('dunit-276-source-backtick', 1, 'quantumon', 'Quantumon', dUnitRankSources.quantumon),
  identity('dunit-276-source-backtick', 2, 'bloomlordmon', 'Bloomlordmon', dUnitRankSources.quantumon),
  ...['dunit-148','dunit-164','dunit-175'].map(setId => ({ setId, identityStatus:'unknown' as const, evolutionStatus:'unknown' as const, rankStatus:'unknown' as const, obtainmentStatus:'unknown' as const, unlockStatus:'unknown' as const, sources:[] as const, note:'Identidade dos retratos, linhas, ranks, obtenção e desbloqueio aguardam validação direta.' })),
]

export const confirmedDUnitPortraitIdentities = () => dUnitPortraitIdentityAudit.filter(entry => entry.identityStatus === 'confirmed' && entry.digimonId)
export const identitiesForDUnitSet = (setId: string) => confirmedDUnitPortraitIdentities().filter(entry => entry.setId === setId)
export const pendingDUnitPortraitIdentitySets = () => [...new Set(dUnitPortraitIdentityAudit.filter(entry => entry.identityStatus !== 'confirmed').map(entry => entry.setId))]
