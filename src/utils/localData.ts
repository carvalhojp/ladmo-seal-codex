export const ladmoStorageKeys = [
  'ladmo-equipment-progress-v1',
  'ladmo-tamer-goals-v1',
  'ladmo-lang',
  'ladmo-seal-state-v2',
  'ladmo-owned',
  'ladmo-dunit-progress-v1',
  'ladmo-dunit-inventory-v1',
  'ladmo-tickets',
  'ladmo-openers',
] as const

export const clearLadmoStorage = (storage: Pick<Storage, 'removeItem'>) =>
  ladmoStorageKeys.forEach(key => storage.removeItem(key))

export const confirmAndClearLadmoStorage = (
  storage: Pick<Storage, 'removeItem'>,
  confirm: (message: string) => boolean,
  message: string,
) => {
  if (!confirm(message)) return false
  clearLadmoStorage(storage)
  return true
}
