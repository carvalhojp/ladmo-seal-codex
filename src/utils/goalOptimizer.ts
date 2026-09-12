import { type Attribute, type Level, type Seal } from '../types'
import { levelFor, levelsFor, openersFor, ticketsForSeals, valueFor } from './calculations'

export type GoalStrategy = 'cheap' | 'openers' | 'value'
export interface SealProgressInput { quantity: number; doNotRecommend?: boolean }
export interface GoalRecommendation {
  seal: Seal
  level: Level
  levelLabel: string
  finalQuantity: number
  additionalSeals: number
  bonusGain: number
  tickets: number
  openers: number
}
export interface GoalPlan {
  recommendations: GoalRecommendation[]
  totalBonus: number
  totalTickets: number
  totalOpeners: number
  totalAdditionalSeals: number
  excess: number
}

export const LESS_OPENERS_WEIGHT = 0.70
export const LESS_OPENERS_TICKETS_WEIGHT = 0.30
export const VALUE_TICKETS_WEIGHT = 0.50
export const VALUE_OPENERS_WEIGHT = 0.50

const zeroPlan = (): GoalPlan => ({ recommendations: [], totalBonus: 0, totalTickets: 0, totalOpeners: 0, totalAdditionalSeals: 0, excess: 0 })
const MAX_PARTIAL_PLANS_PER_GAIN = 32

export function buildProgressOptions(seal: Seal, progress: SealProgressInput = { quantity: 0 }): GoalRecommendation[] {
  if (progress.doNotRecommend) return []
  const currentQuantity = Math.max(0, progress.quantity)
  const currentLevel = levelFor(currentQuantity, seal)
  const currentValue = currentLevel ? valueFor(seal, currentLevel.id) : 0
  return levelsFor(seal).map(level => ({ quantity: level.threshold, level })).filter(state => state.quantity > currentQuantity).map(({ quantity, level }) => {
    const additionalSeals = quantity - currentQuantity
    return {
      seal,
      level: level.id,
      levelLabel: level.label,
      finalQuantity: quantity,
      additionalSeals,
      bonusGain: valueFor(seal, level.id) - currentValue,
      tickets: ticketsForSeals(seal, additionalSeals),
      openers: openersFor(additionalSeals),
    }
  })
}

function append(plan: GoalPlan, option?: GoalRecommendation): GoalPlan {
  if (!option) return plan
  return {
    recommendations: [...plan.recommendations, option],
    totalBonus: plan.totalBonus + option.bonusGain,
    totalTickets: plan.totalTickets + option.tickets,
    totalOpeners: plan.totalOpeners + option.openers,
    totalAdditionalSeals: plan.totalAdditionalSeals + option.additionalSeals,
    excess: 0,
  }
}

/** A partial plan dominates another only if it gives at least as much gain for no more resources. */
function dominatesPartial(a: GoalPlan, b: GoalPlan): boolean {
  return a.totalBonus >= b.totalBonus && a.totalTickets <= b.totalTickets && a.totalOpeners <= b.totalOpeners && a.totalAdditionalSeals <= b.totalAdditionalSeals &&
    (a.totalBonus > b.totalBonus || a.totalTickets < b.totalTickets || a.totalOpeners < b.totalOpeners || a.totalAdditionalSeals < b.totalAdditionalSeals)
}

function prunePartial(plans: GoalPlan[]): GoalPlan[] {
  // Equal gain plans only need their resource Pareto set. This keeps the DP bounded
  // to useful rank combinations rather than every possible acquisition history.
  const byGain = new Map<number, GoalPlan[]>()
  for (const plan of plans) {
    const bucket = byGain.get(plan.totalBonus) ?? []
    if (!bucket.some(other => other.totalTickets <= plan.totalTickets && other.totalOpeners <= plan.totalOpeners && other.totalAdditionalSeals <= plan.totalAdditionalSeals)) {
      byGain.set(plan.totalBonus, bucket.filter(other => !(plan.totalTickets <= other.totalTickets && plan.totalOpeners <= other.totalOpeners && plan.totalAdditionalSeals <= other.totalAdditionalSeals)).concat(plan))
    }
  }
  return [...byGain.values()].flatMap(bucket => {
    const ordered = [...bucket].sort((a, b) =>
      a.totalTickets - b.totalTickets || a.totalOpeners - b.totalOpeners || a.totalAdditionalSeals - b.totalAdditionalSeals ||
      (a.totalTickets + a.totalOpeners) - (b.totalTickets + b.totalOpeners))
    // Keep a small set of nondominated resource trade-offs for each exact gain.
    // The DP remains combinatorial, but cannot retain equivalent histories forever.
    return ordered.slice(0, MAX_PARTIAL_PLANS_PER_GAIN)
  })
}

/** For plans that already meet the target, only resource usage decides Pareto membership. */
export function isDominatedPlan(plan: GoalPlan, plans: GoalPlan[]): boolean {
  return plans.some(other => other !== plan && other.totalTickets <= plan.totalTickets && other.totalOpeners <= plan.totalOpeners &&
    (other.totalTickets < plan.totalTickets || other.totalOpeners < plan.totalOpeners))
}

export function finalParetoFrontier(plans: GoalPlan[], target: number): GoalPlan[] {
  const byResources = new Map<string, GoalPlan>()
  for (const plan of plans.filter(item => item.totalBonus >= target)) {
    const candidate = { ...plan, excess: plan.totalBonus - target }
    const key = `${candidate.totalTickets}/${candidate.totalOpeners}`
    const existing = byResources.get(key)
    if (!existing || candidate.excess < existing.excess) byResources.set(key, candidate)
  }
  // Tickets are ordered first; the remaining 2D Pareto check is sufficient.
  const frontier: GoalPlan[] = []
  for (const candidate of [...byResources.values()].sort((a, b) => a.totalTickets - b.totalTickets || a.totalOpeners - b.totalOpeners || a.excess - b.excess)) {
    if (frontier.some(other => other.totalOpeners <= candidate.totalOpeners)) continue
    for (let index = frontier.length - 1; index >= 0; index--) {
      const other = frontier[index]
      if (candidate.totalTickets === other.totalTickets && candidate.totalOpeners <= other.totalOpeners) frontier.splice(index, 1)
    }
    frontier.push(candidate)
  }
  return frontier
}

const safeRatio = (value: number, minimum: number) => minimum === 0 ? (value === 0 ? 1 : Number.POSITIVE_INFINITY) : value / minimum
const compareCheap = (a: GoalPlan, b: GoalPlan) => a.totalTickets - b.totalTickets || a.totalOpeners - b.totalOpeners || a.excess - b.excess || a.totalAdditionalSeals - b.totalAdditionalSeals
const compareOpeners = (a: GoalPlan, b: GoalPlan, tMin: number, oMin: number) =>
  LESS_OPENERS_WEIGHT * safeRatio(a.totalOpeners, oMin) + LESS_OPENERS_TICKETS_WEIGHT * safeRatio(a.totalTickets, tMin) -
  (LESS_OPENERS_WEIGHT * safeRatio(b.totalOpeners, oMin) + LESS_OPENERS_TICKETS_WEIGHT * safeRatio(b.totalTickets, tMin)) ||
  a.totalOpeners - b.totalOpeners || a.totalTickets - b.totalTickets || a.excess - b.excess || a.totalAdditionalSeals - b.totalAdditionalSeals
const compareValue = (a: GoalPlan, b: GoalPlan, tMin: number, oMin: number) =>
  VALUE_TICKETS_WEIGHT * safeRatio(a.totalTickets, tMin) + VALUE_OPENERS_WEIGHT * safeRatio(a.totalOpeners, oMin) -
  (VALUE_TICKETS_WEIGHT * safeRatio(b.totalTickets, tMin) + VALUE_OPENERS_WEIGHT * safeRatio(b.totalOpeners, oMin)) ||
  a.totalTickets - b.totalTickets || a.totalOpeners - b.totalOpeners || a.excess - b.excess || a.totalAdditionalSeals - b.totalAdditionalSeals

/** Exact multiple-choice DP for the primary "least Tickets" strategy. */
function optimizeLeastTickets(attribute: Attribute, target: number, seals: Seal[], progressById: Record<string, SealProgressInput>): GoalPlan | null {
  let states = new Map<number, GoalPlan>([[0, zeroPlan()]])
  for (const seal of seals.filter(item => item.attribute === attribute && !progressById[item.id]?.doNotRecommend)) {
    const options = buildProgressOptions(seal, progressById[seal.id])
    const next = new Map(states)
    for (const plan of states.values()) for (const option of options) {
      const candidate = append(plan, option)
      const existing = next.get(candidate.totalBonus)
      if (!existing || compareCheap({ ...candidate, excess: Math.max(0, candidate.totalBonus - target) }, { ...existing, excess: Math.max(0, existing.totalBonus - target) }) < 0) next.set(candidate.totalBonus, candidate)
    }
    states = next
  }
  const valid = [...states.values()].filter(plan => plan.totalBonus >= target).map(plan => ({ ...plan, excess: plan.totalBonus - target }))
  return valid.sort(compareCheap)[0] ?? null
}

export function optimizeGoal(attribute: Attribute, target: number, seals: Seal[], progressById: Record<string, SealProgressInput>, strategy: GoalStrategy): GoalPlan | null {
  if (target <= 0) return zeroPlan()
  if (strategy === 'cheap') return optimizeLeastTickets(attribute, target, seals, progressById)
  const candidates = seals.filter(seal => seal.attribute === attribute && !progressById[seal.id]?.doNotRecommend)
  let frontier = [zeroPlan()]
  let completed: GoalPlan[] = []
  for (const seal of candidates) {
    const options = buildProgressOptions(seal, progressById[seal.id])
    const expanded = frontier.flatMap(plan => [plan, ...options.map(option => append(plan, option))])
    completed = finalParetoFrontier(completed.concat(expanded.filter(plan => plan.totalBonus >= target)), target)
    frontier = prunePartial(expanded.filter(plan => plan.totalBonus < target))
  }
  const final = finalParetoFrontier(completed, target)
  if (!final.length) return null
  const tMin = Math.min(...final.map(plan => plan.totalTickets))
  const oMin = Math.min(...final.map(plan => plan.totalOpeners))
  const sorted = [...final].sort((a, b) => strategy === 'openers' ? compareOpeners(a, b, tMin, oMin) : compareValue(a, b, tMin, oMin))
  return sorted[0]
}
