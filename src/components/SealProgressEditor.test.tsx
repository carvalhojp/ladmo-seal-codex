// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { SealProgressEditor, type SealProgressEditorProps } from './SealProgressEditor'
import { seals } from '../data/seals'
import { localizedSealName } from '../data/localizedSealNames'
import { progressionPlannerCopy } from '../data/progressionPlannerCopy'
import { maxSealsFor } from '../utils/calculations'
import { deriveTamerGoal, goalTotals, type TamerGoal } from '../utils/tamerGoals'
import { tamerGoalsCopy } from '../data/tamerGoalsCopy'
import * as sealEngine from '../utils/goalOptimizer'
import type { SealStateMap } from '../utils/sealState'

const seal = seals.find(item => item.attribute === 'HT')!
const t = { ...progressionPlannerCopy.pt, current: 'Atual', newSeals: 'Selos adicionais' }
let host: HTMLDivElement, root: Root
const props = (): SealProgressEditorProps => ({ seal, destination: 200, states: {
  [seal.id]: { quantity: 50, hasSeal: true, doNotRecommend: true },
}, t, lang: 'pt', patchState: vi.fn(), close: vi.fn(), openCodex: vi.fn() })
async function render(p: SealProgressEditorProps) {
  await act(async () => root.render(<SealProgressEditor {...p}/>))
}
const input = () => host.querySelector<HTMLInputElement>('[role="dialog"] input') ??
  host.querySelector<HTMLInputElement>('input')!
async function edit(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === label)
  if (!button) throw new Error(`Missing button: ${label}`)
  await act(async () => button.click())
}
async function submit() {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})

describe('Contextual Seal quantity editor', () => {
  it('uses the total destination and saves only after review and explicit confirmation', async () => {
    const p = props(), before = JSON.stringify(p.states)
    await render(p)
    expect(input().value).toBe('200')
    expect(host.textContent).toContain(localizedSealName(seal, 'pt'))
    await edit('125')
    expect(p.patchState).not.toHaveBeenCalled()
    await submit()
    expect(p.patchState).not.toHaveBeenCalled()
    await click(t.seConfirm)
    expect(p.patchState).toHaveBeenCalledExactlyOnceWith(seal.id, { quantity: 125, hasSeal: true })
    expect(p.close).toHaveBeenCalledOnce()
    expect(JSON.stringify(p.states)).toBe(before)
  })
  it('cancels without writes even after reviewing a decrease', async () => {
    const p = props(); await render(p); await edit('1'); await submit(); await click(t.seCancel)
    expect(p.patchState).not.toHaveBeenCalled(); expect(p.close).toHaveBeenCalledOnce()
  })
  it.each(['', '-1', '1.5', 'NaN', '1e3', 'Infinity', '3001', '9007199254740992'])('blocks invalid quantity %s, including forced submission', async value => {
    const p = props(); await render(p); await edit(value); await submit(); await submit()
    expect(input().getAttribute('aria-invalid')).toBe('true')
    expect(p.patchState).not.toHaveBeenCalled()
  })
  it.each([false, true])('preserves marked possession %s at zero and never patches exclusion', async hasSeal => {
    const p = props(); p.states[seal.id] = { quantity: 0, hasSeal, doNotRecommend: true }
    await render(p); await edit('0'); await submit(); await click(t.seConfirm)
    expect(p.patchState).toHaveBeenCalledWith(seal.id, { quantity: 0, hasSeal })
    expect(p.states[seal.id].doNotRecommend).toBe(true)
  })
  it('records possession when an absent record receives a positive total', async () => {
    const p = { ...props(), states: {} }; await render(p); await submit(); await click(t.seConfirm)
    expect(p.patchState).toHaveBeenCalledWith(seal.id, { quantity: 200, hasSeal: true })
  })
  it('blocks a changed record and requires reconciliation and another confirmation', async () => {
    const p = props(); await render(p); await edit('125'); await submit()
    const changed = { ...p, states: { [seal.id]: { quantity: 200, hasSeal: true, doNotRecommend: false } } }
    await render(changed)
    expect(host.textContent).toContain(t.seConflict)
    await submit(); expect(p.patchState).not.toHaveBeenCalled()
    await click(t.seReconcile); expect(input().value).toBe('200')
    expect(host.textContent).not.toContain(t.seConflict)
    await edit('250'); await submit(); expect(p.patchState).not.toHaveBeenCalled()
    await click(t.seConfirm)
    expect(p.patchState).toHaveBeenCalledWith(seal.id, { quantity: 250, hasSeal: true })
  })
  it('ignores unrelated changes and treats a formerly absent record as a conflict', async () => {
    const p = props(); await render(p)
    await render({ ...p, states: { ...p.states, unrelated: { quantity: 1, hasSeal: true, doNotRecommend: false } } })
    expect(host.textContent).not.toContain(t.seConflict)
    await act(async () => root.unmount()); root = createRoot(host)
    await render({ ...p, states: {} }); await render(p)
    expect(host.textContent).toContain(t.seConflict)
  })
  it('limits an excessive suggestion using the actual Seal progression exception', async () => {
    const special = seals.find(item => item.name === 'Lucemon' && item.attribute === 'CT')!
    const p = { ...props(), seal: special, destination: 3000, states: {} }
    await render(p)
    expect(input().value).toBe(String(maxSealsFor(special)))
    expect(host.textContent).toContain(t.seAdjusted)
    expect(p.patchState).not.toHaveBeenCalled()
    await edit('701'); await submit(); expect(p.patchState).not.toHaveBeenCalled()
    await edit('700'); await submit(); await click(t.seConfirm)
    expect(p.patchState).toHaveBeenCalledWith(special.id, { quantity: 700, hasSeal: true })
  })
  it('supports initial focus, Tab wrapping, Escape and the secondary Codex action without writes', async () => {
    const p = props(); await render(p)
    expect(document.activeElement).toBe(input())
    const last = [...host.querySelectorAll('button')].find(item => item.textContent === t.seOpenCodex)!
    last.focus()
    await act(async () => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
    expect(document.activeElement).toBe(input())
    await click(t.seOpenCodex); expect(p.openCodex).toHaveBeenCalledOnce()
    await act(async () => input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(p.close).toHaveBeenCalledOnce(); expect(p.patchState).not.toHaveBeenCalled()
  })
  it.each(['pt', 'en', 'es', 'ko'] as const)('renders translated editing and confirmation in %s', async lang => {
    const copy = { ...progressionPlannerCopy[lang], current: 'Current', newSeals: 'Seals' }
    await render({ ...props(), lang, t: copy })
    expect(host.textContent).toContain(copy.seTotalHelp)
    await click(copy.seReview); expect(host.textContent).toContain(copy.seConfirm)
  })
})

describe('Real App Seal editing and existing persistence', () => {
  const initialState = {
    quantity: 50, hasSeal: true, doNotRecommend: false,
  }
  const options = sealEngine.buildProgressOptions(seal, initialState)
  const partialQuantity = options[0].finalQuantity
  const goal: TamerGoal = {
    id: 'context-goal',
    type: 'attribute',
    metric: { system: 'seals', attribute: 'HT' },
    baseline: goalTotals({ [seal.id]: initialState }, {}).seals.HT,
    desiredGain: options[1].bonusGain,
  }

  const readStates = (): SealStateMap =>
    JSON.parse(localStorage.getItem('ladmo-seal-state-v2')!)
  const storage = () =>
    Object.fromEntries(
      Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])
    )

  async function mount() {
    // Fixture determinística: utiliza as exclusões existentes do jogador,
    // sem mockar o otimizador nem modificar o dataset.
    const states: SealStateMap = Object.fromEntries(
      seals.map(item => [
        item.id,
        item.id === seal.id
          ? { ...initialState }
          : { quantity: 0, hasSeal: false, doNotRecommend: true },
      ])
    )
    localStorage.setItem('ladmo-lang', JSON.stringify('pt'))
    localStorage.setItem('ladmo-seal-state-v2', JSON.stringify(states))
    localStorage.setItem(
      'ladmo-tamer-goals-v1',
      JSON.stringify({ version: 1, goals: [goal] })
    )
    localStorage.setItem('external-test-key', 'preserve')
    window.history.replaceState(null, '', '#tamer')
    await act(async () => root.render(<App/>))
  }

  async function planFromMyTamer() {
    const summary = host.querySelector<HTMLElement>(
      'section[aria-labelledby="tamer-goals-summary"] details > summary'
    )!
    expect(summary).toBeTruthy()
    await act(async () => {
      const details = summary.parentElement as HTMLDetailsElement
      details.open = true
      details.dispatchEvent(new Event('toggle'))
    })

    const card = host.querySelector<HTMLElement>('.tamer-goal-card')!
    expect(card).toBeTruthy()
    expect([...card.querySelectorAll('summary')].some(
      item => item.textContent === 'Informações complementares'
    )).toBe(false)

    const button = [...card.querySelectorAll('button')].find(
      item => item.textContent === tamerGoalsCopy.pt.tgPlan
    )!
    expect(button).toBeTruthy()
    await act(async () => button.click())
    expect(window.location.hash).toBe('#goal/seals?goal=context-goal')
  }

  function expectedRecommendation() {
    const states = readStates()
    const remaining = deriveTamerGoal(goal, goalTotals(states, {}), {})!.remaining
    const progressById = Object.fromEntries(
      seals.map(item => [
        item.id,
        {
          quantity: states[item.id]?.quantity ?? 0,
          doNotRecommend: states[item.id]?.doNotRecommend ?? false,
        },
      ])
    )
    const plan = sealEngine.optimizeGoal(
      'HT', remaining, seals, progressById, 'cheap'
    )
    expect(plan).not.toBeNull()
    expect(plan!.recommendations).toHaveLength(1)
    const recommendation = plan!.recommendations[0]
    expect(recommendation.seal.id).toBe(seal.id)
    return recommendation
  }

  async function openRecommendation(destination: number) {
    const button = [
      ...host.querySelectorAll<HTMLButtonElement>(
        '.plan-row button[data-seal-id]'
      ),
    ].find(item => item.dataset.sealId === seal.id)!
    expect(button).toBeTruthy()
    expect(button.dataset.destination).toBe(String(destination))
    expect(button.disabled).toBe(false)
    await act(async () => button.click())

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain(localizedSealName(seal, 'pt'))
    expect(input().value).toBe(String(destination))
  }

  it('edits an optimized recommendation by stable ID and total, updates the goal and restores after reload', async () => {
    await mount()
    await planFromMyTamer()

    const recommendation = expectedRecommendation()
    expect(recommendation.finalQuantity).not.toBe(recommendation.additionalSeals)
    expect(partialQuantity).toBeLessThan(recommendation.finalQuantity)

    const engine = vi.spyOn(sealEngine, 'optimizeGoal')
    await click(t.ppCalculateSeal)
    expect(engine).toHaveBeenCalledTimes(1)

    const storageBefore = storage()
    const summaryBefore = host.querySelector('.progression-goal-summary')!.textContent
    await openRecommendation(recommendation.finalQuantity)
    expect(storage()).toEqual(storageBefore)

    await edit(String(partialQuantity))
    await click(t.seReview)
    expect(storage()).toEqual(storageBefore)
    await click(t.seConfirm)

    const states = readStates()
    expect(states[seal.id]).toEqual({
      quantity: partialQuantity, hasSeal: true, doNotRecommend: false,
    })
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(window.location.hash).toBe('#goal/seals?goal=context-goal')
    expect(host.querySelector('.progression-goal-summary')!.textContent)
      .not.toBe(summaryBefore)

    const result = deriveTamerGoal(goal, goalTotals(states, {}), {})!
    expect(result.complete).toBe(false)
    expect(host.querySelector('.progression-goal-summary')!.textContent)
      .toContain(result.remaining.toLocaleString('pt-BR'))
    expect(host.querySelector<HTMLInputElement>('#seal-target')!.value)
      .toBe(String(result.remaining))

    // A confirmação própria conserva a rota e seu destino total original.
    expect(host.querySelectorAll('.plan-row')).toHaveLength(1)
    const retainedButton=host.querySelector<HTMLButtonElement>('.plan-row button[data-seal-id]')!
    expect(retainedButton.dataset.sealId).toBe(seal.id)
    expect(retainedButton.dataset.destination).toBe(String(recommendation.finalQuantity))
    expect(retainedButton.disabled).toBe(false)
    expect(host.querySelector<HTMLButtonElement>('.plan-row .recommendation-add')!.disabled).toBe(false)
    expect(engine).toHaveBeenCalledTimes(1)
    Object.entries(storageBefore)
      .filter(([key]) => key !== 'ladmo-seal-state-v2')
      .forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value))
    Object.entries(states)
      .filter(([id]) => id !== seal.id)
      .forEach(([id, state]) =>
        expect(state).toEqual(
          JSON.parse(storageBefore['ladmo-seal-state-v2']!)[id]
        )
      )

    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(<App/>))
    expect(readStates()[seal.id].quantity).toBe(partialQuantity)
    expect(host.querySelector<HTMLInputElement>('#seal-target')!.value)
      .toBe(String(result.remaining))
    expect(host.querySelectorAll('.plan-row')).toHaveLength(0)
    expect(engine).toHaveBeenCalledTimes(1)

    const restoredRecommendation = expectedRecommendation()
    await click(t.ppCalculateSeal)
    await openRecommendation(restoredRecommendation.finalQuantity)
    expect(host.querySelector('[role="dialog"]')!.textContent)
      .toContain(partialQuantity.toLocaleString('pt-BR'))

    const beforeCancel = storage()
    const callsBeforeCancel = engine.mock.calls.length
    await edit('0')
    await click(t.seCancel)
    expect(storage()).toEqual(beforeCancel)
    expect(engine).toHaveBeenCalledTimes(callsBeforeCancel)
    expect(window.location.hash).toBe('#goal/seals?goal=context-goal')
  })

  it('plans from My Tamer and cancels contextual editing without changing the route or saved data', async () => {
    await mount()
    await planFromMyTamer()

    const recommendation = expectedRecommendation()
    const engine = vi.spyOn(sealEngine, 'optimizeGoal')
    await click(t.ppCalculateSeal)
    const before = storage()
    const targetBefore = host.querySelector<HTMLInputElement>('#seal-target')!.value
    const strategyBefore = host.querySelector<HTMLSelectElement>('#seal-strategy')!.value

    await openRecommendation(recommendation.finalQuantity)
    await edit(String(partialQuantity))
    await click(t.seReview)
    expect(storage()).toEqual(before)
    await click(t.seCancel)

    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(storage()).toEqual(before)
    expect(window.location.hash).toBe('#goal/seals?goal=context-goal')
    expect(host.querySelector<HTMLInputElement>('#seal-target')!.value)
      .toBe(targetBefore)
    expect(host.querySelector<HTMLSelectElement>('#seal-strategy')!.value)
      .toBe(strategyBefore)
    expect(engine).toHaveBeenCalledTimes(1)
    expect(host.querySelector('.plan-row button[data-seal-id]')).not.toBeNull()

    // A recomendação continua utilizável após cancelar.
    await openRecommendation(recommendation.finalQuantity)
    const callsBeforeSave = engine.mock.calls.length
    await edit(String(partialQuantity))
    await click(t.seReview)
    expect(storage()).toEqual(before)
    await click(t.seConfirm)

    expect(readStates()[seal.id].quantity).toBe(partialQuantity)
    expect(window.location.hash).toBe('#goal/seals?goal=context-goal')
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(engine).toHaveBeenCalledTimes(callsBeforeSave)
    expect(localStorage.getItem('ladmo-tamer-goals-v1'))
      .toBe(before['ladmo-tamer-goals-v1'])
    expect(localStorage.getItem('external-test-key')).toBe('preserve')
  })
})
