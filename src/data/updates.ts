export interface UpdateEntry { date: string; category: 'new'; changes: string[]; titleKey?: string }
export const updates: UpdateEntry[] = [
  { date:'07/10/2026', category:'new', titleKey:'navigationUpdateTitle', changes:['navigationUpdateOne','navigationUpdateTwo','navigationUpdateThree'] },
  { date:'07/10/2026', category:'new', titleKey:'epUpdateTitle', changes:['epUpdateOne','epUpdateTwo','epUpdateThree','epUpdateFour'] },
  { date:'07/10/2026', category:'new', titleKey:'tgUpdateTitle', changes:['tgUpdateOne','tgUpdateTwo','tgUpdateThree','tgUpdateFour','tgUpdateFive','tgUpdateSix'] },
  { date:'06/10/2026', category:'new', titleKey:'ppUpdateTitle', changes:['ppUpdateOne','ppUpdateTwo','ppUpdateThree','ppUpdateFour','ppUpdateFive','ppUpdateSix','ppUpdateSeven'] },
  { date:'05/10/2026', category:'new', titleKey:'tamerUpdateTitle', changes:['tamerUpdateOne','tamerUpdateTwo','tamerUpdateThree'] },
  { date:'04/10/2026', category:'new', titleKey:'equipmentUpdateTitle', changes:['updateTwentyTwo','updateTwentyThree','updateTwentyFour','updateTwentyFive','updateTwentySix','updateTwentySeven','updateTwentyEight','updateTwentyNine','updateThirty'] },
  { date:'26/09/2026', category:'new', titleKey:'dunitV1UpdateTitle', changes:['updateEighteen','updateNineteen','updateTwenty','updateTwentyOne'] },
  { date:'18/09/2026', category:'new', changes:['updateThirteen','updateFourteen','updateFifteen','updateSixteen','updateSeventeen'] },
  { date:'16/09/2026', category:'new', changes:['updateNine','updateTen','updateEleven','updateTwelve'] },
  { date:'15/09/2026', category:'new', changes:['updateFive','updateSix','updateSeven','updateEight'] },
  { date:'13/09/2026', category:'new', changes:['updateOne','updateTwo','updateThree','updateFour'] },
]
export const navigationUpdateCopy = {
  pt: {
    navigationUpdateTitle: 'Navegação — Voltar e Avançar',
    navigationUpdateOne: 'Use os botões Voltar e Avançar do navegador para retornar entre páginas e subabas do Codex.',
    navigationUpdateTwo: 'Atalhos Alt + setas e botões laterais do mouse também são compatíveis. Recarregar a página com F5 mantém o destino atual.',
    navigationUpdateThree: 'Os atalhos Planejar e Ver conjunto continuam levando ao destino correto e agora participam do histórico de navegação.',
  },
  en: {
    navigationUpdateTitle: 'Navigation — Back and Forward',
    navigationUpdateOne: 'Use your browser’s Back and Forward buttons to move between Codex pages and subtabs.',
    navigationUpdateTwo: 'Alt + arrow shortcuts and mouse side buttons are supported too. Refreshing with F5 keeps your current destination.',
    navigationUpdateThree: 'Plan and View set still open the correct destination and now participate in navigation history.',
  },
  es: {
    navigationUpdateTitle: 'Navegación — Atrás y Adelante',
    navigationUpdateOne: 'Usa los botones Atrás y Adelante del navegador para recorrer las páginas y subpestañas del Codex.',
    navigationUpdateTwo: 'También funcionan los atajos Alt + flechas y los botones laterales del ratón. Al recargar con F5 se mantiene el destino actual.',
    navigationUpdateThree: 'Planificar y Ver conjunto siguen abriendo el destino correcto y ahora forman parte del historial de navegación.',
  },
  ko: {
    navigationUpdateTitle: '탐색 — 뒤로 및 앞으로',
    navigationUpdateOne: '브라우저의 뒤로 및 앞으로 버튼으로 Codex 페이지와 하위 탭 사이를 이동할 수 있습니다.',
    navigationUpdateTwo: 'Alt + 방향키와 마우스 측면 버튼도 지원합니다. F5로 새로고침해도 현재 페이지와 하위 탭이 유지됩니다.',
    navigationUpdateThree: '계획하기와 세트 보기 기능은 기존 목적지로 이동하며, 이제 탐색 기록에도 반영됩니다.',
  },
} as const
