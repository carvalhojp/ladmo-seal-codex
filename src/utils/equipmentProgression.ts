import type { EquipmentDungeon, EquipmentInfo, EquipmentRecipe } from '../data/equipment'

export type MaterialAmounts = Record<string, number>
export type MoneyAmount = number
export type WeeklyQuestSelection = 'easy' | 'normal' | 'both'

const moneyUnits: Record<string, number> = { B: 1, M: 1_000, T: 1_000_000 }

export function parseQuantity(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/** Converts the game's T/M/B notation to whole B units, avoiding decimal arithmetic. */
export function parseTera(value: string | undefined): MoneyAmount {
  if (!value) return 0
  const normalized = value.trim().toUpperCase()
  // The calculator's primary input is Tera: a bare integer such as "80" means 80T.
  if (/^\d+$/.test(normalized)) return parseQuantity(normalized) * moneyUnits.T
  const matches = [...normalized.matchAll(/(\d+)\s*([TMB])/g)]
  return matches.reduce((total, [, amount, unit]) => total + parseQuantity(amount) * moneyUnits[unit], 0)
}

export function formatTera(value: MoneyAmount): string {
  let remaining = Math.max(0, Math.floor(value))
  const parts: string[] = []
  ;(['T', 'M', 'B'] as const).forEach(unit => {
    const amount = Math.floor(remaining / moneyUnits[unit])
    if (amount) parts.push(`${amount}${unit}`)
    remaining %= moneyUnits[unit]
  })
  return parts.join(' ') || '0'
}

function addMaterials(target: MaterialAmounts, materials: EquipmentRecipe['materials'] | EquipmentInfo['materials'], multiplier = 1) {
  materials?.forEach(material => {
    target[material.name] = (target[material.name] ?? 0) + parseQuantity(material.amount) * multiplier
  })
}

/** Resolves the two explicitly designated weekly-difficulty Dungeons without treating all difficulties as weekly. */
export function resolveWeeklyReward(dungeon: EquipmentDungeon | undefined, selection: WeeklyQuestSelection): EquipmentInfo | undefined {
  if (!dungeon?.weeklyDifficultyQuests) return dungeon?.weekly
  const difficulties = dungeon.difficulties ?? []
  const selected = selection === 'both' ? difficulties : difficulties.filter(item => item.weeklyQuest === selection)
  return { materials: selected.flatMap(item => item.materials ?? []) }
}

export function mergeRecipes(recipes: EquipmentRecipe[], multiplier = 1) {
  const materials: MaterialAmounts = {}
  let money = 0
  recipes.forEach(recipe => {
    addMaterials(materials, recipe.materials, multiplier)
    money += parseTera(recipe.money) * multiplier
  })
  return { materials, money }
}

export interface WeekEstimate {
  weeks: number | null
  firstWeek: MaterialAmounts
  weekly: MaterialAmounts
  unknownMaterials: string[]
}

export function calculateWeekEstimate(
  missing: MaterialAmounts,
  weekly?: EquipmentInfo,
  prerequisite?: EquipmentInfo,
  questCompleted = true,
): WeekEstimate {
  const weeklyAmounts: MaterialAmounts = {}
  const firstWeek: MaterialAmounts = {}
  addMaterials(weeklyAmounts, weekly?.materials)
  addMaterials(firstWeek, weekly?.materials)

  // A quest bonus is only safe to apply to materials that the same dungeon gives weekly.
  if (!questCompleted) prerequisite?.materials?.forEach(material => {
    if (weeklyAmounts[material.name]) firstWeek[material.name] = (firstWeek[material.name] ?? 0) + parseQuantity(material.amount)
  })

  const unknownMaterials: string[] = []
  const weeksByMaterial: number[] = []
  Object.entries(missing).forEach(([name, amount]) => {
    if (amount <= 0) return
    const perWeek = weeklyAmounts[name]
    if (!perWeek) {
      unknownMaterials.push(name)
      return
    }
    const first = firstWeek[name] ?? perWeek
    weeksByMaterial.push(amount <= first ? 1 : 1 + Math.ceil((amount - first) / perWeek))
  })

  return {
    weeks: unknownMaterials.length ? null : (weeksByMaterial.length ? Math.max(...weeksByMaterial) : 0),
    firstWeek,
    weekly: weeklyAmounts,
    unknownMaterials,
  }
}

export interface ProgressionCalculation {
  materials: Array<{ name: string; required: number; owned: number; missing: number }>
  money: { required: MoneyAmount; owned: MoneyAmount; missing: MoneyAmount }
  weeks: WeekEstimate
  includesQuest: boolean
}

export function calculateProgression({
  recipes,
  ownedMaterials = {},
  ownedMoney = 0,
  weekly,
  prerequisite,
  questCompleted = true,
  multiplier = 1,
}: {
  recipes: EquipmentRecipe[]
  ownedMaterials?: MaterialAmounts
  ownedMoney?: MoneyAmount
  weekly?: EquipmentInfo
  prerequisite?: EquipmentInfo
  questCompleted?: boolean
  multiplier?: number
}): ProgressionCalculation {
  const total = mergeRecipes(recipes, multiplier)
  const hasQuestBonus = Boolean(prerequisite?.materials?.some(material => weekly?.materials?.some(item => item.name === material.name)))
  const questMoney = hasQuestBonus && !questCompleted ? parseTera(prerequisite?.money) : 0
  const materials = Object.entries(total.materials).map(([name, required]) => {
    const owned = Math.max(0, Math.floor(ownedMaterials[name] ?? 0))
    return { name, required, owned, missing: Math.max(required - owned, 0) }
  })
  const missing = Object.fromEntries(materials.map(material => [material.name, material.missing]))
  return {
    materials,
    money: { required: total.money + questMoney, owned: Math.max(0, Math.floor(ownedMoney)), missing: Math.max(total.money + questMoney - ownedMoney, 0) },
    weeks: calculateWeekEstimate(missing, weekly, prerequisite, questCompleted || !hasQuestBonus),
    includesQuest: hasQuestBonus && !questCompleted,
  }
}

export function calculateLoaderProgression(
  progression: EquipmentRecipe[],
  currentLevel: number,
  targetLevel: number | 'complete',
) {
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel > 10 || (typeof targetLevel === 'number' && (!Number.isInteger(targetLevel) || targetLevel <= currentLevel || targetLevel > 10)) || (targetLevel === 'complete' && currentLevel >= 11)) return null
  const end = targetLevel === 'complete' ? progression.length : targetLevel
  const steps = progression.slice(currentLevel, end)
  return steps.length ? steps : null
}
