// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoalClassificationDetails } from './GoalClassificationDetails'
import { myTamerCopy } from '../data/myTamerCopy'
import { seals } from '../data/seals'
import { localizedSealName } from '../data/localizedSealNames'
import { dUnitSets } from '../data/dUnitAudit'
import * as integration from '../utils/goalClassificationIntegration'
import * as dunit from '../utils/dUnit'
import { knownMembersForDUnitSet } from '../utils/dUnitRouteWork'
import type { TamerGoal } from '../utils/tamerGoals'

type Props = ComponentProps<typeof GoalClassificationDetails>
type Result = ReturnType<typeof integration.integrateGoalClassifications>[number]

const integrate = integration.integrateGoalClassifications
const seal = seals.find(item => item.attribute === 'HT')!
const set = dUnitSets.find(item => item.id === 'dunit-34')!

const goal: TamerGoal = {
  id: 'stable-goal',
  type: 'attribute',
  metric: { system: 'seals', attribute: 'HT' },
  baseline: 0,
  desiredGain: 10000,
}
const setGoal: TamerGoal = {
  id: 'stable-set-goal',
  type: 'dunit-set',
  setId: set.id,
}

function props(): Props {
  return {
    goal,
    lang: 'pt',
    t: {
      ...myTamerCopy.pt,
      tickets: 'Tickets', openers: 'Abridores',
      tgConditions: 'condições', ppPoints: 'pontos',
      destination: 'Destino', newSeals: 'Selos adicionais',
      pvShowing: 'Exibindo', tgRemaining: 'Restante',
      details: 'Detalhes', ppStepDone: 'Concluído',
      pvPending: 'Pendente', pvMatching: 'Condições do atributo',
      pvOtherConditions: 'Outras condições',
      tgComplete: 'Meta concluída', ppNoOptions: 'Nenhuma opção',
    },
    sealStates: {
      [seal.id]: { quantity: 0, hasSeal: false, doNotRecommend: false },
    },
    progress: {},
  }
}

let host: HTMLDivElement
let root: Root

async function render(p: Props) {
  await act(async () => {
    root.render(<GoalClassificationDetails {...p}/>)
  })
}

async function toggle(open: boolean) {
  const details = host.querySelector('details')
  if (!details) throw new Error('Missing complementary details')
  await act(async () => {
    details.open = open
    details.dispatchEvent(new Event('toggle'))
  })
}

async function loadMore(label: string) {
  const button = [...host.querySelectorAll('button')]
    .find(item => item.textContent === label)
  if (!button) throw new Error('Missing pagination button')
  await act(async () => { button.click() })
}

const articles = () => [...host.querySelectorAll('article')]
const content = () => host.textContent ?? ''

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Complementary information with real React rendering', () => {
  it('classifies only on opening and unmounts content on closing', async () => {
    const classify = vi.spyOn(integration, 'integrateGoalClassifications')
    const search = vi.spyOn(dunit, 'calculateDUnitGoalRoute')
    const p = props()

    await render(p)
    expect(classify).not.toHaveBeenCalled()
    expect(articles()).toHaveLength(0)

    await toggle(true)
    expect(classify).toHaveBeenCalledTimes(1)
    expect(articles().length).toBeGreaterThan(0)
    const mountedArticle = articles()[0]

    await toggle(false)
    expect(mountedArticle.isConnected).toBe(false)
    expect(articles()).toHaveLength(0)

    await render({ ...p, progress: {} })
    expect(classify).toHaveBeenCalledTimes(1)

    await toggle(true)
    expect(classify).toHaveBeenCalledTimes(2)
    expect(articles()[0]).not.toBe(mountedArticle)
    expect(search).not.toHaveBeenCalled()
  })

  it('paginates mixed origins with one shared limit and keeps every result accessible', async () => {
    const p = props()
    const context = {
      contextKey: `goal:${goal.id}`,
      sealStates: p.sealStates,
      progress: p.progress,
      inventory: {},
    }
    const sealResult = integrate([goal], context)[0]
    const dunitResult = integrate([setGoal], context)[0]

    // Defensive presentation fixture, not a composite goal or a new search.
    const mixed: Result = {
      ...sealResult,
      sealAlternatives: sealResult.sealAlternatives.slice(0, 7),
      dUnitSets: dunitResult.dUnitSets,
    }
    expect(mixed.sealAlternatives).toHaveLength(7)
    expect(mixed.dUnitSets).toHaveLength(1)

    vi.spyOn(integration, 'integrateGoalClassifications')
      .mockReturnValue([mixed])

    await render(p)
    await toggle(true)

    expect(articles()).toHaveLength(6)
    expect(content()).toContain('6 / 8')
    expect(
      [...host.querySelectorAll('button')]
        .some(button => button.textContent === p.t.gcMore),
    ).toBe(true)

    await loadMore(p.t.gcMore)

    expect(articles()).toHaveLength(8)
    expect(content()).toContain('8 / 8')
    expect(content()).toContain(set.name)
    expect(host.querySelector('button')).toBeNull()

    const headings = articles().map(article =>
      article.querySelector('h4')?.textContent,
    )
    expect(headings).toEqual([
      ...mixed.sealAlternatives.map(item => localizedSealName(
        seals.find(candidate => candidate.id === item.classification.sealId)!, p.lang,
      )),
      set.name,
    ])
    const destinations = articles().slice(0, 7).map(article =>
      article.querySelector('p')?.textContent,
    )
    expect(destinations).toEqual(mixed.sealAlternatives.map(item =>
      `${p.t.destination}: ${item.classification.finalQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${p.t.gcSeals}`,
    ))
  })

  it('keeps all options accessible and resets pagination after input changes', async () => {
    const p = props()
    const classify = vi.spyOn(integration, 'integrateGoalClassifications')

    await render(p)
    await toggle(true)

    const total = classify.mock.results[0].value[0].sealAlternatives.length
    expect(total).toBeGreaterThan(6)
    expect(articles()).toHaveLength(6)

    while (host.querySelector('button'))
      await loadMore(p.t.gcMore)

    expect(articles()).toHaveLength(total)
    expect(content()).toContain(`${total} / ${total}`)

    const changed: Props = {
      ...p,
      goal: { ...goal, desiredGain: 20000 },
    }
    await render(changed)
    expect(articles()).toHaveLength(6)
    expect(classify).toHaveBeenLastCalledWith(
      [changed.goal], expect.anything(),
    )

    const progress: Props['progress'] = {
      [set.id]: { [set.conditions[0].id]: true },
    }
    await render({ ...changed, progress })
    expect(classify).toHaveBeenLastCalledWith(
      [changed.goal], expect.objectContaining({ progress }),
    )

    const inventory: NonNullable<Props['inventory']> = {
      tentomon: { owned: true, level: 120 },
    }
    await render({ ...changed, progress, inventory })
    expect(classify).toHaveBeenLastCalledWith(
      [changed.goal], expect.objectContaining({ progress, inventory }),
    )
    expect(classify).toHaveBeenCalledTimes(4)
  })

  it('uses audited members without treating one owned form as condition completion', async () => {
    const composition = knownMembersForDUnitSet(set.id)
    expect(composition.complete).toBe(true)
    expect(composition.members.map(member => member.digimonId).sort()).toEqual([
      'tentomon',
      'kabuterimon',
      'megakabuterimon',
      'herculeskabuterimon',
      'tyrantkabuterimon',
    ].sort())
    expect(
      composition.members.every(member =>
        member.identityStatus === 'confirmed',
      ),
    ).toBe(true)

    const member = composition.members.find(entry =>
      entry.digimonId === 'tentomon' &&
      entry.portraitIndex === 1 &&
      entry.identityStatus === 'confirmed',
    )
    if (!member?.digimonId)
      throw new Error('Missing audited Tentomon identity')

    const obtained = set.conditions.find(condition =>
      condition.requirement === 'Obtido 5 Digimons',
    )
    if (!obtained)
      throw new Error('Missing original acquisition condition')

    expect(obtained.bonus).toMatchObject({
      attribute: 'EXP', value: 20, unit: 'percent', confirmed: true,
    })

    const p: Props = { ...props(), goal: setGoal }
    const classify = vi.spyOn(integration, 'integrateGoalClassifications')
    const search = vi.spyOn(dunit, 'calculateDUnitGoalRoute')

    const latestCondition = () => {
      const result: Result = classify.mock.results[classify.mock.results.length - 1].value[0]
      const condition = result.dUnitSets[0].classification.conditions
        .find(entry => entry.conditionId === obtained.id)
      if (!condition) throw new Error('Missing classified condition')
      return condition
    }

    await render(p)
    await toggle(true)

    expect(content()).toContain(p.t.gcInventoryUnavailable)
    expect(content()).toContain(p.t.gcRoutesNotEvaluated)
    expect(content()).toContain(p.t.gcCost)
    expect(latestCondition().metrics.registeredOwned.availability)
      .toBe('notRecorded')
    expect(latestCondition().metrics.remainingOwnership.availability)
      .toBe('notRecorded')

    const inventory: NonNullable<Props['inventory']> = {
      [member.digimonId]: { owned: true, level: 120 },
    }
    const inventoryBefore = JSON.stringify(inventory)

    await render({ ...p, inventory })

    expect(content()).not.toContain(p.t.gcInventoryUnavailable)
    expect(latestCondition().completed).toBe(false)
    expect(latestCondition().metrics.registeredOwned).toMatchObject({
      availability: 'known', value: 1,
    })
    // The other four forms have no individual ownership records.
    expect(latestCondition().metrics.remainingOwnership).toMatchObject({
      availability: 'notRecorded', value: null,
    })

    const progress: Props['progress'] = {
      [set.id]: { [obtained.id]: true },
    }
    const progressBefore = JSON.stringify(progress)

    await render({ ...p, inventory, progress })

    expect(content()).toContain(p.t.ppStepDone)
    expect(latestCondition().completed).toBe(true)
    // Zero follows the explicit checkbox, not ownership of Tentomon alone.
    expect(latestCondition().metrics.remainingOwnership).toMatchObject({
      availability: 'known', value: 0,
    })
    expect(JSON.stringify(inventory)).toBe(inventoryBefore)
    expect(JSON.stringify(progress)).toBe(progressBefore)
    expect(search).not.toHaveBeenCalled()
  })

  it('distinguishes unregistered Seal metrics from a confirmed zero', async () => {
    const p = props()
    await render({ ...p, sealStates: {} })
    await toggle(true)
    expect(content()).toContain(p.t.gcNotRecorded)

    await render(p)
    expect(content()).toContain(`0 ${p.t.gcSeals}`)
    expect(content()).toContain(p.t.gcConfirmedGain)
    expect(content()).toContain(p.t.gcPartial)
    expect(content()).toContain(p.t.gcResourcesNotice)
  })

  it.each(['pt', 'en', 'es', 'ko'] as const)(
    'renders localized explanations in %s', async lang => {
      const p = props()
      const copy = myTamerCopy[lang]
      await render({
        ...p, goal: setGoal, lang, t: { ...p.t, ...copy },
      })
      expect(content()).toContain(copy.gcDetails)
      await toggle(true)
      expect(content()).toContain(copy.gcRoutesNotEvaluated)
      expect(content()).toContain(copy.gcInventoryUnavailable)
      expect(content()).toContain(copy.gcCost)
    },
  )
})
