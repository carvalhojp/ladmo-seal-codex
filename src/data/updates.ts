export interface UpdateEntry { date: string; category: 'new'; changes: string[]; titleKey?: string }
export const updates: UpdateEntry[] = [
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
