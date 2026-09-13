import type { Seal } from '../types'
import type { Lang } from '../App'

/** Entries are limited to names verified in Korean Digimon Masters material. */
export const localizedSealNames: Record<string, { ko: string }> = {
  'seal-16354': { ko: '가오몬' },
  'seal-17712': { ko: '길몬' },
  'seal-19093': { ko: '아구몬' },
  'seal-22415': { ko: '레나몬' },
}

export function localizedSealName(seal: Pick<Seal, 'id' | 'name'>, lang: Lang) {
  return lang === 'ko' ? localizedSealNames[seal.id]?.ko ?? seal.name : seal.name
}

export function matchesLocalizedSealName(seal: Pick<Seal, 'id' | 'name'>, query: string, lang: Lang) {
  const normalized = query.trim().toLocaleLowerCase()
  return !normalized || seal.name.toLocaleLowerCase().includes(normalized) || localizedSealName(seal, lang).toLocaleLowerCase().includes(normalized)
}
