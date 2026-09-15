export interface UpdateEntry { date: string; category: 'new'; changes: string[] }
export const updates: UpdateEntry[] = [
  { date:'15/09/2026', category:'new', changes:['updateFive','updateSix','updateSeven','updateEight'] },
  { date:'13/09/2026', category:'new', changes:['updateOne','updateTwo','updateThree','updateFour'] },
]
