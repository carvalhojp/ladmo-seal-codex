import { readSealStates, sealStateKey, type SealStateMap } from './sealState'
import { dUnitInventoryKey, dUnitProgressKey, readDUnitInventory, readDUnitProgress, type DUnitInventory, type DUnitProgress } from './dUnit'
import { applyLadmoSave, type LadmoSaveV1 } from './saveBackup'
import { clearLadmoStorage } from './localData'

type Language = LadmoSaveV1['preferences']['language']
type LocalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface PlayerLocalState {
  language: Language
  seals: SealStateMap
  dUnitProgress: DUnitProgress
  dUnitInventory: DUnitInventory
  ticketBudget: number
  openerBudget: number
}

export interface PlayerDataRepository {
  loadLocalState(): PlayerLocalState
  saveSealState(states: SealStateMap): void
  saveDUnitProgress(progress: DUnitProgress): void
  saveDUnitInventory(inventory: DUnitInventory): void
  saveLanguage(language: Language): void
  saveTicketBudget(value: number): void
  saveOpenerBudget(value: number): void
  replaceSaveData(save: LadmoSaveV1): void
  clearLocalData(): void
}

export const createLocalPlayerDataRepository = (
  getStorage: () => LocalStorage = () => localStorage,
): PlayerDataRepository => {
  // Preserve the previous App reader's parsing and fallback semantics.
  const stored = <T>(key: string, fallback: T): T => {
    try { return JSON.parse(getStorage().getItem(key) || '') } catch { return fallback }
  }
  const write = (key: string, value: unknown) => getStorage().setItem(key, JSON.stringify(value))
  return {
    loadLocalState: () => ({
      language: stored<Language>('ladmo-lang', 'pt'),
      seals: readSealStates(getStorage()),
      dUnitProgress: readDUnitProgress(getStorage()),
      dUnitInventory: readDUnitInventory(getStorage()),
      ticketBudget: stored('ladmo-tickets', 500),
      openerBudget: stored('ladmo-openers', 20),
    }),
    saveSealState: states => write(sealStateKey, states),
    saveDUnitProgress: progress => write(dUnitProgressKey, progress),
    saveDUnitInventory: inventory => write(dUnitInventoryKey, inventory),
    saveLanguage: language => write('ladmo-lang', language),
    saveTicketBudget: value => write('ladmo-tickets', value),
    saveOpenerBudget: value => write('ladmo-openers', value),
    replaceSaveData: save => applyLadmoSave(getStorage(), save),
    clearLocalData: () => clearLadmoStorage(getStorage()),
  }
}

export const playerDataRepository = createLocalPlayerDataRepository()
