import { describe, expect, it } from 'vitest'
import { confirmAndClearLadmoStorage, ladmoStorageKeys } from './localData'

const storageWith = (entries: Record<string, string>) => ({
  removeItem: (key: string) => { delete entries[key] },
})

describe('LADMO local-data reset', () => {
  it('removes only LADMO keys and preserves unrelated local data', () => {
    const entries = Object.fromEntries(ladmoStorageKeys.map(key => [key, 'saved']))
    entries['another-app-setting'] = 'keep'

    expect(confirmAndClearLadmoStorage(storageWith(entries), () => true, 'confirm')).toBe(true)
    expect(ladmoStorageKeys.every(key => entries[key] === undefined)).toBe(true)
    expect(entries['another-app-setting']).toBe('keep')
  })

  it('does not remove anything when confirmation is cancelled', () => {
    const entries = { 'ladmo-dunit-progress-v1': 'saved', 'another-app-setting': 'keep' }

    expect(confirmAndClearLadmoStorage(storageWith(entries), () => false, 'confirm')).toBe(false)
    expect(entries).toEqual({ 'ladmo-dunit-progress-v1': 'saved', 'another-app-setting': 'keep' })
  })
})
