import { useRef, useState } from 'react'
import { CircleHelp, Coins, Sparkles, Ticket } from 'lucide-react'
import { seals } from '../data/seals'
import type { Attribute } from '../types'
import { formatValue } from '../utils/calculations'
import { optimizeGoal, optimizeGoalWithTicketLimit, type GoalPlan, type GoalStrategy, type SealProgressInput, type TicketBudgetResult } from '../utils/goalOptimizer'
import { getSealState } from '../utils/sealState'
import { NumericInput } from './NumericInput'
import { PageHead } from './PageHead'
import { localizedSealName } from '../data/localizedSealNames'
import type { Lang } from '../App'
import tipMascotUrl from '../assets/gabumon-tip.png'

const attributes: Attribute[] = ['AT','HP','DS','DE','HT','CT','BL','EV']
export const goalPlannerRegistrationTab = 'codex'

/** Produces a display-only route from the real state at the instant the user requests it. */
export function createGoalPlanSnapshot(attribute: Attribute, goal: number, mode: GoalStrategy, progressById: Record<string, SealProgressInput>): GoalPlan | null {
  return optimizeGoal(attribute, goal, seals, progressById, mode)
}

type PlannerStrategy = GoalStrategy | 'ticketLimit'
interface DisplaySnapshot extends TicketBudgetResult { attribute: Attribute; goal: number; ticketBudget?: number }

export function GoalPlanner({ t, lang, state, go, addRecommendation, ticketBudget: initialTicketBudget }: {
  t: any
  lang: Lang
  state: (id: string) => ReturnType<typeof getSealState>
  go: (tab: any) => void
  addRecommendation: (sealId: string, additionalQuantity: number) => void
  ticketBudget?: number
}) {
  const [attribute, setAttribute] = useState<Attribute>('AT')
  const [goal, setGoal] = useState(1000)
  const [mode, setMode] = useState<PlannerStrategy>('cheap')
  const [ticketBudget, setTicketBudget] = useState(() => Math.max(0, Math.trunc(initialTicketBudget ?? 0)))
  const [snapshot, setSnapshot] = useState<DisplaySnapshot | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)
  const [addedSealIds, setAddedSealIds] = useState<Set<string>>(() => new Set())
  const pendingAdditions = useRef(new Set<string>())

  const calculate = () => {
    const progressById = Object.fromEntries(seals.map(seal => {
      const current = state(seal.id)
      return [seal.id, { quantity: current.quantity, doNotRecommend: current.doNotRecommend }]
    }))
    const budgetResult = mode === 'ticketLimit'
      ? optimizeGoalWithTicketLimit(attribute, goal, seals, progressById, ticketBudget)
      : { plan: createGoalPlanSnapshot(attribute, goal, mode, progressById), bestWithinBudget: null, additionalTicketsNeeded: null }
    setSnapshot({ ...budgetResult, attribute, goal, ticketBudget: mode === 'ticketLimit' ? ticketBudget : undefined })
    setHasCalculated(true)
    setAddedSealIds(new Set())
    pendingAdditions.current.clear()
  }

  const add = (sealId: string, additionalQuantity: number) => {
    if (addedSealIds.has(sealId) || pendingAdditions.current.has(sealId)) return
    pendingAdditions.current.add(sealId)
    addRecommendation(sealId, additionalQuantity)
    setAddedSealIds(previous => new Set(previous).add(sealId))
  }

  return <>
    <PageHead eyebrow={t.goalEyebrow} title={t.goalTitle} text={t.goalText}/>
    <section className="goal-tip"><img src={tipMascotUrl}/><div>{t.goalTip}<button className="quiet" onClick={() => go(goalPlannerRegistrationTab)}>{t.goToMine}</button></div></section>
    <section className="planner">
      <div className="control-panel">
        <label>{t.target}<select value={attribute} onChange={e => setAttribute(e.target.value as Attribute)}>{attributes.map(a => <option key={a}>{a}</option>)}</select></label>
        <label>{t.goalFor} {attribute}<NumericInput value={goal} min={1} onValue={setGoal}/></label>
        <label>{t.strategy}<select value={mode} onChange={e => setMode(e.target.value as PlannerStrategy)}><option value="cheap">{t.cheapestTickets}</option><option value="openers">{t.fewerOpeners}</option><option value="value">{t.bestValue}</option><option value="ticketLimit">{t.ticketLimitStrategy}</option></select></label>
        {mode === 'ticketLimit' && <label>{t.availableTickets}<NumericInput value={ticketBudget} min={0} onValue={setTicketBudget}/></label>}
        <button className="primary calculate-route" onClick={calculate}>{t.calculate}</button>
        <p><CircleHelp size={16}/>{t.incrementalHint}</p>
      </div>
      <div className="plan-output">
        <span className="eyebrow">{t.suggestedRoute}</span>
        {!hasCalculated ? <div className="empty">{t.calculateRouteHint}</div> : snapshot?.plan ? <>
          <h2>{formatValue(snapshot.plan.totalBonus, snapshot.attribute)} <small>{t.ofGoal} {formatValue(snapshot.goal, snapshot.attribute)}</small></h2>
          <div className="plan-stats"><span><Ticket/> {snapshot.plan.totalTickets} {t.tickets}</span><span><Coins/> {snapshot.plan.totalAdditionalSeals} {t.newSeals}</span><span><Sparkles/> {snapshot.plan.totalOpeners} {t.openers}</span></div>
          {snapshot.ticketBudget !== undefined && <div className="plan-stats budget-stats"><span>{t.ticketsAvailable}: {snapshot.ticketBudget}</span><span>{t.ticketsUsed}: {snapshot.plan.totalTickets}</span><span>{t.ticketsRemaining}: {snapshot.ticketBudget - snapshot.plan.totalTickets}</span></div>}
          {snapshot.plan.recommendations.map(item => {
            const added = addedSealIds.has(item.seal.id)
            return <div className="plan-row" key={item.seal.id}>
              <span className={'attr ' + item.seal.attribute}>{item.seal.attribute}</span>
              <div><b>{localizedSealName(item.seal, lang)}</b><small>{item.levelLabel} · {t.current}: {item.finalQuantity - item.additionalSeals} · {t.destination}: {item.finalQuantity.toLocaleString()} · {t.needed}: {item.additionalSeals.toLocaleString()} · {t.gain} {formatValue(item.bonusGain, item.seal.attribute)}</small></div>
              <strong>{item.tickets} <small>{t.tickets} · {item.openers} OP</small></strong>
              <button className="quiet recommendation-add" disabled={added} onClick={() => add(item.seal.id, item.additionalSeals)}>{added ? t.recommendationAdded : t.addRecommended}</button>
            </div>
          })}
        </> : snapshot?.ticketBudget !== undefined ? <div className="empty"><p>{t.noTicketBudgetPlan}</p>{snapshot.bestWithinBudget && <p>{t.bestGainWithinBudget}: <b>{formatValue(snapshot.bestWithinBudget.totalBonus, snapshot.attribute)}</b></p>}{snapshot.additionalTicketsNeeded !== null && <p>{t.additionalTicketsNeeded}: <b>{snapshot.additionalTicketsNeeded}</b></p>}</div> : <div className="empty">{t.noGoalPlan}</div>}
      </div>
    </section>
  </>
}
