import { describe, expect, it } from 'vitest'
import { translationGroups } from './App'
import { goalPlannerRegistrationTab } from './components/GoalPlanner'
import { supportedLanguageCount } from './components/Home'
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

  it('keeps the September 15 changelog ahead of September 13 in every language', () => {
    expect(updates.map(update => update.date)).toEqual(['15/09/2026', '13/09/2026'])
    for (const language of ['pt', 'en', 'es', 'ko'] as const) {
      const copy = translationGroups.roundCopy[language]
      expect(['updateFive', 'updateSix', 'updateSeven', 'updateEight'].every(key => Boolean(copy[key as keyof typeof copy]))).toBe(true)
    }
  })
})
