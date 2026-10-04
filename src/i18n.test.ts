import { describe, expect, it } from 'vitest'
import { translationGroups } from './App'
import { goalPlannerRegistrationTab } from './components/GoalPlanner'
import { dUnitConditionCount, dUnitSetCount, supportedLanguageCount } from './components/Home'
import { dUnitSets } from './data/dUnitAudit'
import { updates } from './data/updates'

const groups = translationGroups

describe('translation coverage', () => {
  it.each(Object.entries(groups))('%s has the same keys in PT-BR, EN, ES, and KO', (_, group) => {
    const expected = Object.keys(group.pt).sort()
    expect(Object.keys(group.en).sort()).toEqual(expected)
    expect(Object.keys(group.es).sort()).toEqual(expected)
    expect(Object.keys(group.ko).sort()).toEqual(expected)
    expect(Object.values(group.ko).every(Boolean)).toBe(true)
  })

  it('directs Goal Planner users to register Seals in Seal Codex in every language', () => {
    const expected = {
      pt: 'Cadastre primeiro no Seal Codex',
      en: 'register the Seals you own and their quantities in Seal Codex',
      es: 'registra en Seal Codex',
      ko: 'Seal Codex에서 보유한 Seal과 수량을 등록하세요',
    }
    Object.entries(expected).forEach(([lang, text]) => {
      const copy = translationGroups.uiCopy[lang as keyof typeof translationGroups.uiCopy]
      expect(copy.goalTip).toContain(text)
      expect(copy.goToMine).toContain('Seal Codex')
      expect(copy.goalTip).not.toContain('Meus Selos')
    })
  })

  it('keeps the Goal Planner CTA on the internal Seal Codex route', () => {
    expect(goalPlannerRegistrationTab).toBe('codex')
  })

  it('shows the four supported languages on Home in every translation', () => {
    expect(supportedLanguageCount).toBe(4)
    for (const language of ['pt', 'en', 'es', 'ko'] as const) expect(translationGroups.extraCopy[language].languages).toBeTruthy()
  })

  it('derives the D-Unit Home totals from the registered set data', () => {
    expect(dUnitSetCount).toBe(dUnitSets.length)
    expect(dUnitConditionCount).toBe(dUnitSets.reduce((total,set)=>total+set.conditions.length,0))
  })

  it('keeps the Equipment, D-Unit V1, September 18 D-Unit, and September 16 Buff Deck changelog entries ahead of the previous entries in every language', () => {
    expect(updates.map(update => update.date)).toEqual(['04/10/2026', '26/09/2026', '18/09/2026', '16/09/2026', '15/09/2026', '13/09/2026'])
    expect(updates.filter(update=>update.date==='04/10/2026')).toHaveLength(1)
    expect(updates[0]).toMatchObject({titleKey:'equipmentUpdateTitle',changes:['updateTwentyTwo','updateTwentyThree','updateTwentyFour','updateTwentyFive','updateTwentySix','updateTwentySeven','updateTwentyEight']})
    expect(updates.filter(update=>update.date==='26/09/2026')).toHaveLength(1)
    expect(updates[1]).toMatchObject({titleKey:'dunitV1UpdateTitle',changes:['updateEighteen','updateNineteen','updateTwenty','updateTwentyOne']})
    for (const language of ['pt', 'en', 'es', 'ko'] as const) {
      const copy = translationGroups.roundCopy[language]
      const dunitCopy = translationGroups.dunitUpdateCopy[language]
      expect(['updateFive', 'updateSix', 'updateSeven', 'updateEight'].every(key => Boolean(copy[key as keyof typeof copy]))).toBe(true)
      expect(['updateNine', 'updateTen', 'updateEleven', 'updateTwelve'].every(key => Boolean(copy[key as keyof typeof copy]))).toBe(true)
      expect(['updateThirteen', 'updateFourteen', 'updateFifteen', 'updateSixteen', 'updateSeventeen'].every(key => Boolean(dunitCopy[key as keyof typeof dunitCopy]))).toBe(true)
      expect(['updateEighteen', 'updateNineteen', 'updateTwenty', 'updateTwentyOne'].every(key => Boolean(dunitCopy[key as keyof typeof dunitCopy]))).toBe(true)
      expect(['updateTwentyTwo', 'updateTwentyThree', 'updateTwentyFour', 'updateTwentyFive', 'updateTwentySix', 'updateTwentySeven', 'updateTwentyEight'].every(key => Boolean(dunitCopy[key as keyof typeof dunitCopy]))).toBe(true)
      expect((dunitCopy as Record<string,string>).dunitV1UpdateTitle).toBeTruthy()
      expect((dunitCopy as Record<string,string>).equipmentUpdateTitle).toBeTruthy()
      expect(copy.updateNine).toMatch(/resources|recursos|자원이 있어요/i)
      expect(copy.updateTen).toMatch(/Rank U/)
      expect(copy.updateTwelve).toMatch(/SSS\+/)
    }
  })
})
