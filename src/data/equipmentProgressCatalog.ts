export type EquipmentLanguage = 'pt' | 'en' | 'es' | 'ko'
type Names = Record<EquipmentLanguage, string>
export interface EquipmentProgressItem { id: string; names: Names; dungeonId: string; modelId?: string; kind: 'equipment' | 'loader' | 'mdg-piece' }

/** Explicit identity associations. Model IDs are opaque; grouped model cards are excluded. */
export const equipmentProgressCatalog: readonly EquipmentProgressItem[] = [
  { id: 'chimairamon-earring', modelId: 'chimairamon-earring', dungeonId: 'chimairamon', kind: 'equipment', names: { pt: 'Brinco Luxuoso da Bondade', en: 'Luxurious Kindness Earring', es: 'Pendiente Lujoso de la Bondad', ko: '친절의 고급 귀걸이' } },
  { id: 'luxury-kindness-earring', modelId: 'luxury-kindness-earring', dungeonId: 'dark-web', kind: 'equipment', names: { pt: 'Colar Radiante do Milagre', en: 'Radiant Miracle Necklace', es: 'Collar Radiante del Milagro', ko: '기적의 빛나는 목걸이' } },
  { id: 'vital-bracelet-digivice', modelId: 'vital-bracelet-digivice', dungeonId: 'shopping-center', kind: 'equipment', names: { pt: 'Vital Bracelet DigiVice', en: 'Vital Bracelet DigiVice', es: 'Vital Bracelet DigiVice', ko: '바이탈 브레스 디지바이스' } },
  { id: 'shiny-arena-ring', modelId: 'shiny-arena-ring', dungeonId: 'arena-hard', kind: 'equipment', names: { pt: 'Anel de Arena Brilhante', en: 'Shiny Arena Ring', es: 'Anillo Brillante de Arena', ko: '빛나는 아레나 반지' } },
  { id: 'radiant-hope-ring', modelId: 'radiant-hope-ring', dungeonId: 'nightmare', kind: 'equipment', names: { pt: 'Anel da Esperança Radiante', en: 'Radiant Hope Ring', es: 'Anillo de la Esperanza Radiante', ko: '빛나는 희망의 반지' } },
  { id: 'courage-friendship-digiaura', dungeonId: 'eosmon', kind: 'equipment', names: { pt: 'DigiAura da Coragem e Amizade', en: 'Courage and Friendship DigiAura', es: 'DigiAura del Valor y la Amistad', ko: '용기와 우정의 디지오라' } },
  { id: 'first-digivice-1', dungeonId: 'eosmon', kind: 'equipment', names: { pt: 'Primeiro Digivice Nv.1', en: 'First Digivice Lv.1', es: 'Primer Digivice Nv.1', ko: '첫 번째 디지바이스 Lv.1' } },
  { id: 'susanoomon-loader', dungeonId: 'sdg', kind: 'loader', names: { pt: 'Loader', en: 'Loader', es: 'Loader', ko: '로더' } },
]
// Stable codes for collection + piece, independent of positions and translated names.
const collections = [{ id: 'davies', name: 'Davies' }, { id: 'yolei', name: 'Yolei' }, { id: 'tk', name: 'TK' }] as const
const parts: readonly { id: string; names: Names }[] = [
  { id: 'helmet', names: { pt: 'Capacete', en: 'Helmet', es: 'Casco', ko: '모자' } },
  { id: 'accessory', names: { pt: 'Acessório', en: 'Accessory', es: 'Accesorio', ko: '액세서리' } },
  { id: 'shirt', names: { pt: 'Camisa', en: 'Shirt', es: 'Camisa', ko: '상의' } },
  { id: 'pants', names: { pt: 'Calça', en: 'Pants', es: 'Pantalones', ko: '하의' } },
  { id: 'gloves', names: { pt: 'Luva', en: 'Gloves', es: 'Guantes', ko: '장갑' } },
  { id: 'boots', names: { pt: 'Bota', en: 'Boots', es: 'Botas', ko: '신발' } },
]
export const mdgProgressCatalog: readonly EquipmentProgressItem[] = collections.flatMap(collection => parts.map(part => ({
  id: `mdg-${collection.id}-${part.id}`, dungeonId: 'mdg', kind: 'mdg-piece' as const,
  names: Object.fromEntries(Object.entries(part.names).map(([lang, name]) => [lang, `${collection.name} — ${name}`])) as Names,
})))
export const allEquipmentProgressItems = [...equipmentProgressCatalog, ...mdgProgressCatalog]
export const equipmentProgressById = new Map(allEquipmentProgressItems.map(item => [item.id, item]))
/** Only the current stage is persisted, never recipe indices or prior stages. */
export const loaderStages = [
  { id: 'loader-lv-0', level: 0 }, { id: 'loader-lv-1', level: 1 }, { id: 'loader-lv-2', level: 2 },
  { id: 'loader-lv-3', level: 3 }, { id: 'loader-lv-4', level: 4 }, { id: 'loader-lv-5', level: 5 },
  { id: 'loader-lv-6', level: 6 }, { id: 'loader-lv-7', level: 7 }, { id: 'loader-lv-8', level: 8 },
  { id: 'loader-lv-9', level: 9 }, { id: 'loader-lv-10', level: 10 }, { id: 'loader-complete', level: 11 },
] as const
