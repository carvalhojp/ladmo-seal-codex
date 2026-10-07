import type { Attribute } from '../types'
import { seals } from '../data/seals'
import { dUnitSets } from '../data/dUnitAudit'
import { calculateAttributeTotals } from './dashboard'
import { toOwnedSeals, type SealStateMap } from './sealState'
import { aggregateDUnitBonuses, isDUnitConditionCompleted, type DUnitBonusKey, type DUnitProgress } from './dUnit'
import { mainProgressionAttributes, otherProgressionAttributes, progressionDUnitOptions, progressionUnit, type ProgressionObjective } from './progressionPlanner'

export const tamerGoalsKey = 'ladmo-tamer-goals-v1'
export type GoalMetric = { system: 'seals'; attribute: Attribute } | { system: 'dunit'; bonusKey: DUnitBonusKey }
export type TamerGoal = { id: string } & ({ type: 'attribute'; metric: GoalMetric; baseline: number; desiredGain: number } | { type: 'dunit-set'; setId: string })
export interface TamerGoalsState { version: 1; goals: TamerGoal[] }
export type GoalsLoad = { state: TamerGoalsState; error?: 'invalid' | 'version' | 'storage' }
export const emptyTamerGoals = (): TamerGoalsState => ({ version: 1, goals: [] })
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const bonusKeyShape = (value: unknown): value is DUnitBonusKey => typeof value === 'string' && value.length <= 200 && /^[^|\u0000-\u001f]+\|[^|\u0000-\u001f]*\|(absolute|percent)$/.test(value)

/** Validate structure; keep well-formed references whose catalog entry is unavailable. */
export function validateTamerGoals(raw: unknown): TamerGoalsState | null {
  if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.goals) || raw.goals.length > 3) return null
  const ids = new Set<string>(), goals: TamerGoal[] = []
  for (const goal of raw.goals) {
    if (!object(goal) || typeof goal.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(goal.id) || ids.has(goal.id)) return null
    ids.add(goal.id)
    if (goal.type === 'dunit-set') {
      if (typeof goal.setId !== 'string' || !/^dunit-[1-9]\d*$/.test(goal.setId)) return null
      goals.push({ id: goal.id, type: 'dunit-set', setId: goal.setId })
    } else if (goal.type === 'attribute') {
      if (!object(goal.metric) || !number(goal.baseline) || !number(goal.desiredGain) || goal.desiredGain <= 0 || goal.baseline + goal.desiredGain > Number.MAX_SAFE_INTEGER) return null
      let metric: GoalMetric
      if (goal.metric.system === 'seals' && mainProgressionAttributes.includes(goal.metric.attribute as Attribute)) metric = { system: 'seals', attribute: goal.metric.attribute as Attribute }
      else if (goal.metric.system === 'dunit' && bonusKeyShape(goal.metric.bonusKey)) metric = { system: 'dunit', bonusKey: goal.metric.bonusKey }
      else return null
      const unit = metric.system === 'seals' ? progressionUnit(metric.attribute, 'seals') : metric.bonusKey.split('|')[2]
      if ((metric.system === 'seals' || unit === 'absolute') && !Number.isSafeInteger(goal.desiredGain)) return null
      if (metric.system === 'dunit' && unit === 'percent' && Math.abs(goal.desiredGain * 100 - Math.round(goal.desiredGain * 100)) > 0.000001) return null
      goals.push({ id: goal.id, type: 'attribute', metric, baseline: goal.baseline, desiredGain: goal.desiredGain })
    } else return null
  }
  return { version: 1, goals }
}

export function readTamerGoals(storage: Pick<Storage, 'getItem'>): GoalsLoad {
  try {
    const text = storage.getItem(tamerGoalsKey)
    if (text === null) return { state: emptyTamerGoals() }
    let raw: unknown
    try { raw = JSON.parse(text) } catch { return { state: emptyTamerGoals(), error: 'invalid' } }
    if (object(raw) && raw.version !== 1) return { state: emptyTamerGoals(), error: 'version' }
    const state = validateTamerGoals(raw)
    return state ? { state } : { state: emptyTamerGoals(), error: 'invalid' }
  } catch { return { state: emptyTamerGoals(), error: 'storage' } }
}

export function newTamerGoalId(existing: TamerGoal[], cryptoApi: Pick<Crypto, 'randomUUID' | 'getRandomValues'> = globalThis.crypto): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    let id: string
    if (typeof cryptoApi?.randomUUID === 'function') id = cryptoApi.randomUUID()
    else {
      if (!cryptoApi?.getRandomValues) throw new Error('Secure ID generation unavailable')
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128
      id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    if (!existing.some(goal => goal.id === id)) return id
  }
  throw new Error('Goal ID collision')
}

const dUnitMetricInfo = new Map([...mainProgressionAttributes, ...otherProgressionAttributes].flatMap(objective => progressionDUnitOptions(objective).map(option => [option.key, { objective, unit: option.unit, qualifier: option.qualifier }] as const)))
export function goalMetricInfo(metric: GoalMetric) {
  if (metric.system === 'seals') return { objective: metric.attribute as ProgressionObjective, unit: progressionUnit(metric.attribute, 'seals'), qualifier: '' }
  return dUnitMetricInfo.get(metric.bonusKey) ?? null
}
export const goalDisplayValue = (metric: GoalMetric, value: number) => metric.system === 'seals' && goalMetricInfo(metric)?.unit === 'percent' ? value / 100 : value
export const goalTotals = (states: SealStateMap, progress: DUnitProgress) => ({ seals: calculateAttributeTotals(toOwnedSeals(states), seals), dunit: aggregateDUnitBonuses(progress) })
export const currentGoalBonus = (metric: GoalMetric, totals: ReturnType<typeof goalTotals>) => metric.system === 'seals' ? totals.seals[metric.attribute] : totals.dunit[metric.bonusKey] ?? 0
export function deriveTamerGoal(goal: TamerGoal, totals: ReturnType<typeof goalTotals>, progress: DUnitProgress) {
  if (goal.type === 'attribute') {
    if (!goalMetricInfo(goal.metric)) return null
    const current = currentGoalBonus(goal.metric, totals)
    return { current, total: goal.desiredGain, done: Math.min(goal.desiredGain, Math.max(0, current - goal.baseline)), remaining: Math.max(0, goal.baseline + goal.desiredGain - current), complete: current >= goal.baseline + goal.desiredGain }
  }
  const set = dUnitSets.find(set => set.id === goal.setId)
  if (!set || !set.conditions.length) return null
  const done = set.conditions.filter(condition => isDUnitConditionCompleted(progress, condition)).length
  return { current: done, total: set.conditions.length, done, remaining: set.conditions.length - done, complete: done === set.conditions.length }
}
export interface GoalPlannerIntent { id: string; objective: ProgressionObjective; system: 'seals' | 'dunit'; bonusKey?: DUnitBonusKey; draft: string }
export function goalPlannerIntent(goal: TamerGoal, totals: ReturnType<typeof goalTotals>, progress: DUnitProgress): GoalPlannerIntent | null {
  const derived = deriveTamerGoal(goal, totals, progress)
  if (goal.type !== 'attribute' || !derived || derived.complete) return null
  const info = goalMetricInfo(goal.metric)!
  return { id: goal.id, objective: info.objective, system: goal.metric.system, ...(goal.metric.system === 'dunit' ? { bonusKey: goal.metric.bonusKey } : {}), draft: String(Number(goalDisplayValue(goal.metric, derived.remaining).toFixed(2))) }
}
