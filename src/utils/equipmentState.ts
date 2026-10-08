import { equipmentProgressById, loaderStages } from '../data/equipmentProgressCatalog'
export const equipmentProgressKey = 'ladmo-equipment-progress-v1'
export interface EquipmentEntry { owned: true; stageId?: string }
export interface EquipmentProgressState { version: 1; items: Record<string, EquipmentEntry> }
export interface EquipmentLoad { state: EquipmentProgressState; error?: 'invalid' | 'version' | 'storage' }
export const emptyEquipmentProgress = (): EquipmentProgressState => ({ version: 1, items: {} })
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const stageIds = new Set<string>(loaderStages.map(stage => stage.id))
export function sanitizeEquipmentProgress(raw: unknown): { state: EquipmentProgressState; ignored: number } | null {
  if (!object(raw) || raw.version !== 1 || !object(raw.items)) return null
  const state = emptyEquipmentProgress()
  let ignored = 0
  for (const [id, entry] of Object.entries(raw.items)) {
    const item = equipmentProgressById.get(id)
    if (!item || !object(entry) || entry.owned !== true || (entry.stageId !== undefined && (item.kind !== 'loader' || typeof entry.stageId !== 'string' || !stageIds.has(entry.stageId)))) { ignored++; continue }
    state.items[id] = { owned: true, ...(entry.stageId === undefined ? {} : { stageId: entry.stageId as string }) }
  }
  return { state, ignored }
}
/** Reading never repairs storage. Invalid/unknown records block writes and export. */
export function readEquipmentProgress(storage: Pick<Storage, 'getItem'>): EquipmentLoad {
  try {
    const text = storage.getItem(equipmentProgressKey)
    if (text === null) return { state: emptyEquipmentProgress() }
    let raw: unknown
    try { raw = JSON.parse(text) } catch { return { state: emptyEquipmentProgress(), error: 'invalid' } }
    if (object(raw) && raw.version !== 1) return { state: emptyEquipmentProgress(), error: 'version' }
    const clean = sanitizeEquipmentProgress(raw)
    if (!clean) return { state: emptyEquipmentProgress(), error: 'invalid' }
    return { state: clean.state, ...(clean.ignored ? { error: 'invalid' as const } : {}) }
  } catch { return { state: emptyEquipmentProgress(), error: 'storage' } }
}
export function updateEquipmentProgress(state: EquipmentProgressState, id: string, owned: boolean, stageId?: string): EquipmentProgressState {
  const items = { ...state.items }
  if (!owned) delete items[id]
  else items[id] = { owned: true, ...(stageId === undefined ? {} : { stageId }) }
  const next = sanitizeEquipmentProgress({ version: 1, items })
  if (!equipmentProgressById.has(id) || !next || next.ignored) throw new Error('Invalid equipment progress')
  return next.state
}
export function summarizeEquipmentProgress(state: EquipmentProgressState) {
  let equipment = 0, mdgPieces = 0
  for (const id of Object.keys(state.items)) {
    if (equipmentProgressById.get(id)?.kind === 'mdg-piece') mdgPieces++
    else if (equipmentProgressById.has(id)) equipment++
  }
  return { equipment, mdgPieces, loaderStage: state.items['susanoomon-loader']?.stageId }
}
