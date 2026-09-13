import { describe, expect, it } from 'vitest'
import { translationGroups } from './App'

const groups = translationGroups

describe('translation coverage', () => {
  it.each(Object.entries(groups))('%s has the same keys in PT-BR, EN, ES, and KO', (_, group) => {
    const expected = Object.keys(group.pt).sort()
    expect(Object.keys(group.en).sort()).toEqual(expected)
    expect(Object.keys(group.es).sort()).toEqual(expected)
    expect(Object.keys(group.ko).sort()).toEqual(expected)
    expect(Object.values(group.ko).every(Boolean)).toBe(true)
  })
})
